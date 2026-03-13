import { imageBitmapToRgbaPixels } from './helpers';

import type { ImageConfig } from './types';

/* =========================================================
 * ImageConfig serialization / deserialization
 *
 * Binary layout (all multi-byte values are little-endian):
 *   [2]       id byte length
 *   [n]       id (UTF-8)
 *   [2]       label byte length
 *   [n]       label (UTF-8)
 *   [2]       type byte length
 *   [n]       type (UTF-8)
 *   [1]       flags: bit 0 = selected, bit 1 = hasPolygons, bit 2 = outdated
 *   [8]       config.maxPointCount  (Float64)
 *   [8]       config.alphaThreshold (Float64)
 *   [8]       config.minimalDistance (Float64)
 *   [4]       polygonInfo element count (Uint32)
 *   [count×2] polygonInfo raw bytes (Uint16 elements)
 *   [4]       src width  (Uint32)
 *   [4]       src height (Uint32)
 *   [w×h×4]   src RGBA pixels (Uint8)
 * ========================================================= */

export namespace ImageConfigSerialization {
    export async function serialize(config: ImageConfig): Promise<Uint8Array> {
        const encoder = new TextEncoder();
        const idBytes = encoder.encode(config.id);
        const labelBytes = encoder.encode(config.label);
        const typeBytes = encoder.encode(config.type);

        const { width, height } = config.src;
        const pixels = await imageBitmapToRgbaPixels(config.src);

        const byteLength =
            2 + idBytes.length +
            2 + labelBytes.length +
            2 + typeBytes.length +
            1 +                                    // flags
            8 * 3 +                                // 3 × Float64 config values
            4 + config.polygonInfo.byteLength +    // polygonInfo
            4 + 4 +                                // width, height
            pixels.length;                         // RGBA pixels

        const buf = new ArrayBuffer(byteLength);
        const view = new DataView(buf);
        const out = new Uint8Array(buf);
        let off = 0;

        const writeStr = (bytes: Uint8Array): void => {
            view.setUint16(off, bytes.length, true); off += 2;
            out.set(bytes, off); off += bytes.length;
        };

        writeStr(idBytes);
        writeStr(labelBytes);
        writeStr(typeBytes);

        const flags =
            (config.selected ? 0b001 : 0) |
            (config.hasPolygons ? 0b010 : 0) |
            (config.outdated ? 0b100 : 0);
        view.setUint8(off, flags); off += 1;

        view.setFloat64(off, config.config.maxPointCount, true); off += 8;
        view.setFloat64(off, config.config.alphaThreshold, true); off += 8;
        view.setFloat64(off, config.config.minimalDistance, true); off += 8;

        view.setUint32(off, config.polygonInfo.length, true); off += 4;
        out.set(
            new Uint8Array(config.polygonInfo.buffer, config.polygonInfo.byteOffset, config.polygonInfo.byteLength),
            off,
        );
        off += config.polygonInfo.byteLength;

        view.setUint32(off, width, true); off += 4;
        view.setUint32(off, height, true); off += 4;
        out.set(pixels, off);

        return out;
    }

    export async function deserialize(data: Uint8Array): Promise<ImageConfig> {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let off = 0;

        const decoder = new TextDecoder();
        const readStr = (): string => {
            const len = view.getUint16(off, true); off += 2;
            const str = decoder.decode(new Uint8Array(data.buffer, data.byteOffset + off, len));
            off += len;
            return str;
        };

        const id = readStr();
        const label = readStr();
        const type = readStr();

        const flags = view.getUint8(off); off += 1;
        const selected = (flags & 0b001) !== 0;
        const hasPolygons = (flags & 0b010) !== 0;
        const outdated = (flags & 0b100) !== 0;

        const maxPointCount = view.getFloat64(off, true); off += 8;
        const alphaThreshold = view.getFloat64(off, true); off += 8;
        const minimalDistance = view.getFloat64(off, true); off += 8;

        const polygonInfoLen = view.getUint32(off, true); off += 4;
        const polygonInfo = new Uint16Array(
            data.buffer.slice(data.byteOffset + off, data.byteOffset + off + polygonInfoLen * 2),
        );
        off += polygonInfoLen * 2;

        const width = view.getUint32(off, true); off += 4;
        const height = view.getUint32(off, true); off += 4;

        const pixelBytes = new Uint8ClampedArray(data.buffer, data.byteOffset + off, width * height * 4);
        const src = await createImageBitmap(new ImageData(new Uint8ClampedArray(pixelBytes), width, height), { premultiplyAlpha: 'none' });

        return { id, label, type, src, selected, hasPolygons, outdated, config: { maxPointCount, alphaThreshold, minimalDistance }, polygonInfo };
    }

    /**
     * Pack an array of serialized ImageConfig buffers into one Uint8Array.
     *
     * Layout:
     *   [4]        entry count (Uint32 LE)
     *   [4 × n]    byte length of each entry (Uint32 LE)
     *   [...]      entry data concatenated
     */
    export function serializeMany(entries: Uint8Array[]): Uint8Array {
        const totalBytes = 4 + entries.length * 4 + entries.reduce((s, e) => s + e.byteLength, 0);
        const buf = new ArrayBuffer(totalBytes);
        const view = new DataView(buf);
        const out = new Uint8Array(buf);
        let off = 0;

        view.setUint32(off, entries.length, true); off += 4;

        for (const entry of entries) {
            view.setUint32(off, entry.byteLength, true); off += 4;
        }

        for (const entry of entries) {
            out.set(entry, off); off += entry.byteLength;
        }

        return out;
    }

    /**
     * Split a buffer produced by {@link serializeMany} back into individual
     * ImageConfig buffers (suitable for passing to {@link deserialize}).
     */
    export function deserializeMany(data: Uint8Array): Uint8Array[] {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let off = 0;

        const count = view.getUint32(off, true); off += 4;

        const lengths: number[] = [];
        for (let i = 0; i < count; ++i) {
            lengths.push(view.getUint32(off, true)); off += 4;
        }

        return lengths.map((len) => {
            const slice = new Uint8Array(data.buffer, data.byteOffset + off, len);
            off += len;
            return slice;
        });
    }
}
