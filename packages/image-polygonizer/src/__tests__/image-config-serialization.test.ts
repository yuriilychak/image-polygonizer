import { ImageConfigSerialization } from '../image-config-serialization';
import type { ImageConfig } from '../types';

// jsdom does not provide ImageData — polyfill it
if (!(global as any).ImageData) {
    (global as any).ImageData = class ImageData {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        colorSpace: string = 'srgb';
        constructor(data: Uint8ClampedArray, width: number, height?: number) {
            this.data = data;
            this.width = width;
            this.height = height ?? data.length / 4 / width;
        }
    };
}

describe('ImageConfigSerialization', () => {
    describe('serializeMany / deserializeMany', () => {
        it('handles empty array', () => {
            const result = ImageConfigSerialization.serializeMany([]);
            expect(result.byteLength).toBe(4);
            const entries = ImageConfigSerialization.deserializeMany(result);
            expect(entries).toHaveLength(0);
        });

        it('round-trips single entry', () => {
            const entry = new Uint8Array([1, 2, 3, 4, 5]);
            const packed = ImageConfigSerialization.serializeMany([entry]);
            const unpacked = ImageConfigSerialization.deserializeMany(packed);
            expect(unpacked).toHaveLength(1);
            expect(Array.from(unpacked[0])).toEqual([1, 2, 3, 4, 5]);
        });

        it('round-trips multiple entries of different sizes', () => {
            const e1 = new Uint8Array([10, 20]);
            const e2 = new Uint8Array([30, 40, 50]);
            const packed = ImageConfigSerialization.serializeMany([e1, e2]);
            const unpacked = ImageConfigSerialization.deserializeMany(packed);
            expect(unpacked).toHaveLength(2);
            expect(Array.from(unpacked[0])).toEqual([10, 20]);
            expect(Array.from(unpacked[1])).toEqual([30, 40, 50]);
        });

        it('handles single empty entry', () => {
            const entry = new Uint8Array(0);
            const packed = ImageConfigSerialization.serializeMany([entry]);
            const unpacked = ImageConfigSerialization.deserializeMany(packed);
            expect(unpacked).toHaveLength(1);
            expect(unpacked[0].byteLength).toBe(0);
        });

        it('preserves byte order for multiple entries', () => {
            const entries = [
                new Uint8Array([0xff]),
                new Uint8Array([0x00, 0x01]),
                new Uint8Array([0xaa, 0xbb, 0xcc]),
            ];
            const packed = ImageConfigSerialization.serializeMany(entries);
            const unpacked = ImageConfigSerialization.deserializeMany(packed);
            for (let i = 0; i < entries.length; i++) {
                expect(Array.from(unpacked[i])).toEqual(Array.from(entries[i]));
            }
        });
    });

    describe('serialize / deserialize round-trip', () => {
        function makeMockBitmap(width = 2, height = 2) {
            return { width, height, close: vi.fn() } as unknown as ImageBitmap;
        }

        function makeConfig(overrides: Partial<ImageConfig> = {}): ImageConfig {
            return {
                id: 'test-id-123',
                label: 'my-sprite',
                type: 'png',
                src: makeMockBitmap(2, 2),
                selected: false,
                hasPolygons: false,
                outdated: false,
                config: { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 },
                polygonInfo: new Uint16Array(0),
                ...overrides,
            };
        }

        it('round-trips id, label, type', async () => {
            const config = makeConfig();
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.id).toBe('test-id-123');
            expect(restored.label).toBe('my-sprite');
            expect(restored.type).toBe('png');
        });

        it('round-trips flags: selected=true, hasPolygons=true, outdated=true', async () => {
            const config = makeConfig({ selected: true, hasPolygons: true, outdated: true });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.selected).toBe(true);
            expect(restored.hasPolygons).toBe(true);
            expect(restored.outdated).toBe(true);
        });

        it('round-trips flags: all false', async () => {
            const config = makeConfig({ selected: false, hasPolygons: false, outdated: false });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.selected).toBe(false);
            expect(restored.hasPolygons).toBe(false);
            expect(restored.outdated).toBe(false);
        });

        it('round-trips flags: selected only', async () => {
            const config = makeConfig({ selected: true, hasPolygons: false, outdated: false });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.selected).toBe(true);
            expect(restored.hasPolygons).toBe(false);
            expect(restored.outdated).toBe(false);
        });

        it('round-trips flags: hasPolygons only', async () => {
            const config = makeConfig({ selected: false, hasPolygons: true, outdated: false });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.selected).toBe(false);
            expect(restored.hasPolygons).toBe(true);
            expect(restored.outdated).toBe(false);
        });

        it('round-trips flags: outdated only', async () => {
            const config = makeConfig({ selected: false, hasPolygons: false, outdated: true });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.selected).toBe(false);
            expect(restored.hasPolygons).toBe(false);
            expect(restored.outdated).toBe(true);
        });

        it('round-trips config values', async () => {
            const config = makeConfig({ config: { maxPointCount: 64, alphaThreshold: 128, minimalDistance: 16 } });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.config.maxPointCount).toBe(64);
            expect(restored.config.alphaThreshold).toBe(128);
            expect(restored.config.minimalDistance).toBe(16);
        });

        it('round-trips fractional config values', async () => {
            const config = makeConfig({ config: { maxPointCount: 1.5, alphaThreshold: 0.25, minimalDistance: 3.14159 } });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.config.maxPointCount).toBeCloseTo(1.5);
            expect(restored.config.alphaThreshold).toBeCloseTo(0.25);
            expect(restored.config.minimalDistance).toBeCloseTo(3.14159);
        });

        it('round-trips polygonInfo', async () => {
            const polygonInfo = new Uint16Array([1, 2, 3, 4, 5]);
            const config = makeConfig({ polygonInfo });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(Array.from(restored.polygonInfo)).toEqual([1, 2, 3, 4, 5]);
        });

        it('round-trips empty polygonInfo', async () => {
            const config = makeConfig({ polygonInfo: new Uint16Array(0) });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.polygonInfo.length).toBe(0);
        });

        it('round-trips non-empty polygonInfo with large values', async () => {
            const polygonInfo = new Uint16Array([0, 65535, 1000, 32768]);
            const config = makeConfig({ polygonInfo });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(Array.from(restored.polygonInfo)).toEqual([0, 65535, 1000, 32768]);
        });

        it('restores src dimensions from width/height', async () => {
            const config = makeConfig({ src: makeMockBitmap(4, 3) });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.src.width).toBe(4);
            expect(restored.src.height).toBe(3);
        });

        it('restores 1x1 src dimensions', async () => {
            const config = makeConfig({ src: makeMockBitmap(1, 1) });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.src.width).toBe(1);
            expect(restored.src.height).toBe(1);
        });

        it('round-trips unicode strings', async () => {
            const config = makeConfig({ id: '日本語', label: 'éàü', type: '🎉' });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);
            expect(restored.id).toBe('日本語');
            expect(restored.label).toBe('éàü');
            expect(restored.type).toBe('🎉');
        });

        it('produces a Uint8Array', async () => {
            const config = makeConfig();
            const serialized = await ImageConfigSerialization.serialize(config);
            expect(serialized).toBeInstanceOf(Uint8Array);
        });

        it('full round-trip preserves all fields together', async () => {
            const polygonInfo = new Uint16Array([10, 20, 30]);
            const config = makeConfig({
                id: 'full-id',
                label: 'full-label',
                type: 'jpg',
                src: makeMockBitmap(3, 5),
                selected: true,
                hasPolygons: true,
                outdated: false,
                config: { maxPointCount: 100, alphaThreshold: 0.5, minimalDistance: 2.5 },
                polygonInfo,
            });
            const serialized = await ImageConfigSerialization.serialize(config);
            const restored = await ImageConfigSerialization.deserialize(serialized);

            expect(restored.id).toBe('full-id');
            expect(restored.label).toBe('full-label');
            expect(restored.type).toBe('jpg');
            expect(restored.selected).toBe(true);
            expect(restored.hasPolygons).toBe(true);
            expect(restored.outdated).toBe(false);
            expect(restored.config.maxPointCount).toBe(100);
            expect(restored.config.alphaThreshold).toBeCloseTo(0.5);
            expect(restored.config.minimalDistance).toBeCloseTo(2.5);
            expect(Array.from(restored.polygonInfo)).toEqual([10, 20, 30]);
            expect(restored.src.width).toBe(3);
            expect(restored.src.height).toBe(5);
        });
    });
});
