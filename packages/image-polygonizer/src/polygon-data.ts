import type { ImageSetting } from "./types";

/**
 * Uint16Array binary layout
 * ─────────────────────────────────────────────────────────────────
 * [0]  (alphaThreshold:u8 << 8) | maxPointCount:u8
 * [1]  (offset:u8       << 8) | minimalDistance:u8
 * [2]  outline:u8  (high byte = 0)
 * [3]  alphaMask byte-length  high word  (bits 31–16)
 * [4]  alphaMask byte-length  low  word  (bits 15–0)
 * [5 .. 5 + ceil(byteLen/2) - 1]
 *      alphaMask bytes packed little-endian: word = (byte[i+1] << 8) | byte[i]
 *
 * After alphaMask – repeated for contours, polygons, triangles:
 *   [k]      array-section count  (number of Uint16Arrays)
 *   [k+1]    array[0].length
 *   [k+2 ..] array[0] data
 *   [k+2+len] array[1].length
 *   …
 * ─────────────────────────────────────────────────────────────────
 */
export default class PolygonData {
    private static instance: PolygonData;

    private constructor() { }

    static getInstance(): PolygonData {
        if (!PolygonData.instance) {
            PolygonData.instance = new PolygonData();
        }
        return PolygonData.instance;
    }

    // ── Serialization ──────────────────────────────────────────────

    serialize(alphaMask: Uint8Array, contours: Uint16Array[], polygons: Uint16Array[], triangles: Uint16Array[], config: ImageSetting, offset: number, outline: number): Uint16Array {
        const alphaMaskWordCount = (alphaMask.byteLength + 1) >>> 1;

        let totalWords = 3 + 2 + alphaMaskWordCount; // header + alphaMask length + alphaMask data

        totalWords += 1; // contours section count
        for (const c of contours) totalWords += 1 + c.length;

        totalWords += 1; // polygons section count
        for (const p of polygons) totalWords += 1 + p.length;

        totalWords += 1; // triangles section count
        for (const t of triangles) totalWords += 1 + t.length;

        const buf = new Uint16Array(totalWords);
        let cursor = 0;

        // Header – 3 packed Uint8 pairs
        buf[cursor++] = ((config.alphaThreshold & 0xff) << 8) | (config.maxPointCount & 0xff);
        buf[cursor++] = ((offset & 0xff) << 8) | (config.minimalDistance & 0xff);
        buf[cursor++] = outline & 0xff;

        // alphaMask byte-length as 32-bit (hi/lo Uint16)
        buf[cursor++] = (alphaMask.byteLength >>> 16) & 0xffff;
        buf[cursor++] = alphaMask.byteLength & 0xffff;

        // alphaMask bytes – two bytes per word, little-endian
        for (let i = 0; i < alphaMask.byteLength; i += 2) {
            buf[cursor++] = ((alphaMask[i + 1] ?? 0) << 8) | alphaMask[i];
        }

        // Helper: write count + (length, data) per array
        const writeSection = (arrays: Uint16Array[]): void => {
            buf[cursor++] = arrays.length;
            for (const arr of arrays) {
                buf[cursor++] = arr.length;
                buf.set(arr, cursor);
                cursor += arr.length;
            }
        };

        writeSection(contours);
        writeSection(polygons);
        writeSection(triangles);

        return buf;
    }

    // ── Field deserialization ───────────────────────────────────────

    deserializeConfig(buf: Uint16Array): ImageSetting {
        return {
            maxPointCount: buf[0] & 0xff,
            alphaThreshold: (buf[0] >>> 8) & 0xff,
            minimalDistance: buf[1] & 0xff,
        };
    }

    deserializeOffset(buf: Uint16Array): number {
        return (buf[1] >>> 8) & 0xff;
    }

    deserializeOutline(buf: Uint16Array): number {
        return buf[2] & 0xff;
    }

    deserializeAlphaMask(buf: Uint16Array): Uint8Array {
        const byteLen = this.readAlphaMaskByteLength(buf);
        const result = new Uint8Array(byteLen);
        for (let i = 0; i < byteLen; i++) {
            const word = buf[5 + (i >>> 1)];
            result[i] = (i & 1) === 0 ? (word & 0xff) : (word >>> 8) & 0xff;
        }
        return result;
    }

    deserializeContours(buf: Uint16Array): Uint16Array[] {
        const cursor = this.afterAlphaMaskCursor(buf);
        return this.readSection(buf, cursor).arrays;
    }

    deserializePolygons(buf: Uint16Array): Uint16Array[] {
        const c0 = this.afterAlphaMaskCursor(buf);
        const { cursor: c1 } = this.readSection(buf, c0);
        return this.readSection(buf, c1).arrays;
    }

    deserializeTriangles(buf: Uint16Array): Uint16Array[] {
        const c0 = this.afterAlphaMaskCursor(buf);
        const { cursor: c1 } = this.readSection(buf, c0);
        const { cursor: c2 } = this.readSection(buf, c1);
        return this.readSection(buf, c2).arrays;
    }

    hasAlphaMask(buf: Uint16Array): boolean {
        return this.deserializeAlphaMask(buf).length > 0;
    }

    hasContours(buf: Uint16Array): boolean {
        const arrays = this.deserializeContours(buf);
        return arrays.length > 0 && arrays.every(a => a.length > 0);
    }

    hasPolygons(buf: Uint16Array): boolean {
        const arrays = this.deserializePolygons(buf);
        return arrays.length > 0 && arrays.every(a => a.length > 0);
    }

    hasTriangles(buf: Uint16Array): boolean {
        const arrays = this.deserializeTriangles(buf);
        return arrays.length > 0 && arrays.every(a => a.length > 0);
    }

    // ── Private helpers ────────────────────────────────────────────

    private readAlphaMaskByteLength(buf: Uint16Array): number {
        return (((buf[3] & 0xffff) << 16) | (buf[4] & 0xffff)) >>> 0;
    }

    private afterAlphaMaskCursor(buf: Uint16Array): number {
        const byteLen = this.readAlphaMaskByteLength(buf);
        const wordCount = (byteLen + 1) >>> 1;
        return 5 + wordCount;
    }

    private readSection(buf: Uint16Array, cursor: number): { arrays: Uint16Array[]; cursor: number } {
        const count = buf[cursor++];
        const arrays: Uint16Array[] = [];
        for (let i = 0; i < count; i++) {
            const len = buf[cursor++];
            arrays.push(buf.slice(cursor, cursor + len));
            cursor += len;
        }
        return { arrays, cursor };
    }
}
