import { fileToImageConfig, imageBitmapToRgbaPixels, exportImage, buildExportConfig } from '../helpers';
import PolygonData from '../polygon-data';

const CONFIG = { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 };

function makeBitmap(width = 10, height = 10): ImageBitmap {
    return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

function makePolygonInfo(polygons: Uint16Array[], triangles: Uint16Array[], offset = 0): Uint16Array {
    return PolygonData.getInstance().serialize(
        new Uint8Array(0), [], polygons, triangles, CONFIG, offset, 0,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ── fileToImageConfig ────────────────────────────────────────────────────────

describe('fileToImageConfig', () => {
    it('strips extension and sets all fields correctly', async () => {
        const file = new File([''], 'sprite.png', { type: 'image/png' });
        const result = await fileToImageConfig(file);
        expect(result.label).toBe('sprite');
        expect(result.type).toBe('png');
        expect(result.selected).toBe(false);
        expect(result.outdated).toBe(false);
        expect(result.hasPolygons).toBe(false);
        expect(result.config).toEqual(CONFIG);
        expect(result.polygonInfo).toBeInstanceOf(Uint16Array);
        expect(result.polygonInfo.length).toBe(0);
    });

    it('assigns a non-empty string id from crypto.randomUUID', async () => {
        const file = new File([''], 'img.png', { type: 'image/png' });
        const result = await fileToImageConfig(file);
        expect(typeof result.id).toBe('string');
        expect(result.id.length).toBeGreaterThan(0);
    });

    it('calls createImageBitmap with the file and premultiplyAlpha option', async () => {
        const file = new File([''], 'img.png', { type: 'image/png' });
        await fileToImageConfig(file);
        expect(createImageBitmap).toHaveBeenCalledWith(file, { premultiplyAlpha: 'none' });
    });

    it('sets src to the ImageBitmap returned by createImageBitmap', async () => {
        const file = new File([''], 'img.png', { type: 'image/png' });
        const result = await fileToImageConfig(file);
        expect(result.src).toBeDefined();
        expect(result.src.width).toBe(10);
        expect(result.src.height).toBe(10);
    });

    it('handles multiple dots in filename', async () => {
        const file = new File([''], 'my.image.png', { type: 'image/png' });
        const result = await fileToImageConfig(file);
        expect(result.label).toBe('my.image');
    });

    it('handles filename with no extension', async () => {
        const file = new File([''], 'noextension', { type: 'image/png' });
        const result = await fileToImageConfig(file);
        expect(result.label).toBe('noextension');
    });

    it('strips image/ prefix from MIME type', async () => {
        const file = new File([''], 'anim.gif', { type: 'image/gif' });
        const result = await fileToImageConfig(file);
        expect(result.type).toBe('gif');
    });
});

// ── imageBitmapToRgbaPixels ──────────────────────────────────────────────────

describe('imageBitmapToRgbaPixels', () => {
    it('returns Uint8Array of size width * height * 4', async () => {
        const bitmap = makeBitmap(4, 4);
        const result = await imageBitmapToRgbaPixels(bitmap);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(4 * 4 * 4);
    });

    it('uses OffscreenCanvas fallback when VideoFrame is undefined', async () => {
        const bitmap = makeBitmap(8, 6);
        const result = await imageBitmapToRgbaPixels(bitmap);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(8 * 6 * 4);
    });

    it('returns all-zero bytes for transparent mock canvas', async () => {
        const bitmap = makeBitmap(2, 2);
        const result = await imageBitmapToRgbaPixels(bitmap);
        expect(Array.from(result)).toEqual(new Array(2 * 2 * 4).fill(0));
    });
});

// ── exportImage ──────────────────────────────────────────────────────────────

describe('exportImage', () => {
    it("cropOption='' returns createImageBitmap(src) with cropX=0, cropY=0", async () => {
        const bitmap = makeBitmap();
        const polygonInfo = makePolygonInfo([], []);
        const result = await exportImage(bitmap, polygonInfo, '');
        expect(result.cropX).toBe(0);
        expect(result.cropY).toBe(0);
        expect(result.img).toBeDefined();
        expect(createImageBitmap).toHaveBeenCalledWith(bitmap);
    });

    it("cropOption='none' returns createImageBitmap(src) with cropX=0, cropY=0", async () => {
        const bitmap = makeBitmap();
        const polygonInfo = makePolygonInfo([], []);
        const result = await exportImage(bitmap, polygonInfo, 'none');
        expect(result.cropX).toBe(0);
        expect(result.cropY).toBe(0);
        expect(result.img).toBeDefined();
        expect(createImageBitmap).toHaveBeenCalledWith(bitmap);
    });

    it("cropOption='alpha' with all-transparent pixels returns cropX=0, cropY=0", async () => {
        // Default mock returns zero-filled pixel data (all transparent).
        // cropToAlpha finds no non-transparent pixels → falls back to createImageBitmap(src).
        const bitmap = makeBitmap();
        const polygonInfo = makePolygonInfo([], []);
        const result = await exportImage(bitmap, polygonInfo, 'alpha');
        expect(result.cropX).toBe(0);
        expect(result.cropY).toBe(0);
        expect(result.img).toBeDefined();
        expect(createImageBitmap).toHaveBeenCalledWith(bitmap);
    });

    it("cropOption='polygon' with empty polygons returns createImageBitmap(src) with cropX=0, cropY=0", async () => {
        const bitmap = makeBitmap();
        const polygonInfo = makePolygonInfo([], []);
        const result = await exportImage(bitmap, polygonInfo, 'polygon');
        expect(result.cropX).toBe(0);
        expect(result.cropY).toBe(0);
        expect(result.img).toBeDefined();
        expect(createImageBitmap).toHaveBeenCalledWith(bitmap);
    });

    it("cropOption='polygon' clips to polygon bounding box", async () => {
        const bitmap = makeBitmap(100, 100);
        // offset=0, polygon coords are image-space
        const polygon = new Uint16Array([10, 10, 50, 10, 50, 50, 10, 50]);
        const triangle = new Uint16Array([0, 1, 2]);
        const polygonInfo = makePolygonInfo([polygon], [triangle], 0);
        const result = await exportImage(bitmap, polygonInfo, 'polygon');
        // cropX/cropY are floor(minX) and floor(minY) of the polygon vertices
        expect(result.cropX).toBe(10);
        expect(result.cropY).toBe(10);
        expect(result.img).toBeDefined();
    });

    it("cropOption='polygon' respects offset when computing crop origin", async () => {
        const bitmap = makeBitmap(100, 100);
        const offset = 4;
        // raw coords include offset: pixel space = raw - offset
        const polygon = new Uint16Array([
            offset + 20, offset + 30,
            offset + 60, offset + 30,
            offset + 60, offset + 70,
        ]);
        const triangle = new Uint16Array([0, 1, 2]);
        const polygonInfo = makePolygonInfo([polygon], [triangle], offset);
        const result = await exportImage(bitmap, polygonInfo, 'polygon');
        expect(result.cropX).toBe(20);
        expect(result.cropY).toBe(30);
    });
});

// ── buildExportConfig ────────────────────────────────────────────────────────

describe('buildExportConfig', () => {
    const offset = 5;
    const cropX = 2;
    const cropY = 3;

    // Polygon vertices in raw buffer coords (include offset).
    // Local coords (after subtracting offset + cropX/Y):
    //   vertex 0: (10, 20), vertex 1: (30, 20), vertex 2: (30, 40)
    const polygon = new Uint16Array([
        offset + cropX + 10, offset + cropY + 20,
        offset + cropX + 30, offset + cropY + 20,
        offset + cropX + 30, offset + cropY + 40,
    ]);
    const triangle = new Uint16Array([0, 1, 2]); // indices into polygon's vertex list

    let polygonInfo: Uint16Array;

    beforeEach(() => {
        polygonInfo = makePolygonInfo([polygon], [triangle], offset);
    });

    it('exports polygons with correct local coords when exportPolygons=true', () => {
        const result = buildExportConfig(
            polygonInfo, cropX, cropY, { exportPolygons: true, exportTriangles: false },
        ) as any;
        expect(result.polygons).toBeDefined();
        expect(result.triangles).toBeUndefined();
        expect(result.polygons[0]).toEqual([10, 20, 30, 20, 30, 40]);
    });

    it('exports triangles as expanded vertex coords when exportPolygons=false', () => {
        const result = buildExportConfig(
            polygonInfo, cropX, cropY, { exportPolygons: false, exportTriangles: true },
        ) as any;
        expect(result.polygons).toBeUndefined();
        expect(result.triangles).toBeDefined();
        // idx 0 → (10,20), idx 1 → (30,20), idx 2 → (30,40)
        expect(result.triangles[0]).toEqual([10, 20, 30, 20, 30, 40]);
    });

    it('exports triangles as raw index arrays when exportPolygons=true and exportTriangles=true', () => {
        const result = buildExportConfig(
            polygonInfo, cropX, cropY, { exportPolygons: true, exportTriangles: true },
        ) as any;
        expect(result.polygons).toBeDefined();
        expect(result.triangles).toBeDefined();
        expect(result.triangles[0]).toEqual([0, 1, 2]);
    });

    it('returns empty config object when both flags are false', () => {
        const result = buildExportConfig(
            polygonInfo, cropX, cropY, { exportPolygons: false, exportTriangles: false },
        );
        expect(result).toEqual({});
    });

    it('applies cropX/cropY offset to polygon coords', () => {
        const result = buildExportConfig(
            polygonInfo, 0, 0, { exportPolygons: true, exportTriangles: false },
        ) as any;
        // With cropX=0, cropY=0 the local coord = raw - offset
        const p = result.polygons[0];
        expect(p[0]).toBe(cropX + 10); // (offset + cropX + 10) - offset - 0
        expect(p[1]).toBe(cropY + 20);
    });
});
