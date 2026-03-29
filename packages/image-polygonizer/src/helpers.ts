import { DEFAULT_CONFIG } from './constants';
import PolygonData from './polygon-data';

import type { ImageConfig, ImageExportConfig, CropOption } from './types';

export const fileToImageConfig = async (file: File): Promise<ImageConfig> => ({
    label: file.name.replace(/\.[^/.]+$/, ''),
    type: file.type.replace('image/', ''),
    src: await createImageBitmap(file, { premultiplyAlpha: 'none' }),
    selected: false,
    outdated: false,
    hasPolygons: false,
    id: crypto.randomUUID(),
    config: { ...DEFAULT_CONFIG },
    polygonInfo: new Uint16Array(0),
});


export async function imageBitmapToRgbaPixels(bitmap: ImageBitmap): Promise<Uint8Array> {
    if (typeof VideoFrame !== "undefined" && VideoFrame && typeof VideoFrame.prototype.copyTo === "function") {
        let frame;

        try {
            frame = new VideoFrame(bitmap, { timestamp: 0 });

            const layout = { format: "RGBA" } as VideoFrameCopyToOptions;

            const size = frame.allocationSize(layout);
            const pixels = new Uint8Array(size);

            await frame.copyTo(pixels, layout);

            return pixels;
        } catch (err) {
        } finally {
            try { frame?.close?.(); } catch { }
        }
    }

    // ---- Fallback: OffscreenCanvas + 2D ----
    const width = bitmap.width;
    const height = bitmap.height;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);

    const img = ctx.getImageData(0, 0, width, height);

    return new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
}

type CropResult = { img: ImageBitmap; cropX: number; cropY: number };

async function cropToAlpha(src: ImageBitmap): Promise<CropResult> {
    const canvas = new OffscreenCanvas(src.width, src.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height);

    let minX = width, maxX = -1, minY = height, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < 0) return { img: await createImageBitmap(src), cropX: 0, cropY: 0 };
    return {
        img: await createImageBitmap(src, minX, minY, maxX - minX + 1, maxY - minY + 1),
        cropX: minX,
        cropY: minY,
    };
}

async function cropToPolygon(src: ImageBitmap, polygonInfo: Uint16Array): Promise<CropResult> {
    const pd = PolygonData.getInstance();
    const polygons = pd.deserializePolygons(polygonInfo);
    const offset = pd.deserializeOffset(polygonInfo);

    if (!polygons.length || !polygons[0].length) return { img: await createImageBitmap(src), cropX: 0, cropY: 0 };

    // Compute bounding box across ALL polygons
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const polygon of polygons) {
        for (let i = 0; i < polygon.length; i += 2) {
            const x = polygon[i] - offset;
            const y = polygon[i + 1] - offset;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    minX = Math.floor(minX);
    minY = Math.floor(minY);
    maxX = Math.ceil(maxX);
    maxY = Math.ceil(maxY);

    const canvas = new OffscreenCanvas(maxX - minX + 1, maxY - minY + 1);
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    for (const polygon of polygons) {
        ctx.moveTo(polygon[0] - offset - minX, polygon[1] - offset - minY);
        for (let i = 2; i < polygon.length; i += 2) {
            ctx.lineTo(polygon[i] - offset - minX, polygon[i + 1] - offset - minY);
        }
        ctx.closePath();
    }
    ctx.clip();

    ctx.drawImage(src, -minX, -minY);

    // Polygon crop: return polygon bbox min as the crop origin in original-image space
    return { img: canvas.transferToImageBitmap(), cropX: minX, cropY: minY };
}

export async function exportImage(src: ImageBitmap, polygonInfo: Uint16Array, cropOption: CropOption): Promise<CropResult> {
    if (cropOption === 'alpha') return cropToAlpha(src);
    if (cropOption === 'polygon') return cropToPolygon(src, polygonInfo);
    return { img: await createImageBitmap(src), cropX: 0, cropY: 0 };
}

export function buildExportConfig(
    polygonInfo: Uint16Array,
    cropX: number,
    cropY: number,
    exportConfig: ImageExportConfig,
): object {
    const pd = PolygonData.getInstance();
    const offset = pd.deserializeOffset(polygonInfo);
    const rawPolygons = pd.deserializePolygons(polygonInfo);
    const rawTriangles = pd.deserializeTriangles(polygonInfo);
    const { exportPolygons, exportTriangles } = exportConfig;

    // Convert a coordinate from extended-image space to cropped-image space
    const toLocalX = (v: number) => v - offset - cropX;
    const toLocalY = (v: number) => v - offset - cropY;

    const config: Record<string, unknown> = {};

    if (exportPolygons) {
        config.polygons = rawPolygons.map(poly => {
            const coords: number[] = [];
            for (let i = 0; i < poly.length; i += 2) {
                coords.push(toLocalX(poly[i]), toLocalY(poly[i + 1]));
            }
            return coords;
        });
    }

    if (exportTriangles) {
        if (exportPolygons) {
            // Keep raw triangle indices — vertices are already exported in polygons
            config.triangles = rawTriangles.map(tri => Array.from(tri));
        } else {
            // No polygon export: expand indices to actual coordinates in cropped-image space
            config.triangles = rawTriangles.map((tri, i) => {
                const vertices = rawPolygons[i] ?? new Uint16Array(0);
                const coords: number[] = [];
                for (const idx of tri) {
                    coords.push(toLocalX(vertices[idx * 2]), toLocalY(vertices[idx * 2 + 1]));
                }
                return coords;
            });
        }
    }

    return config;
}

