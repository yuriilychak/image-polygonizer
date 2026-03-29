import PolygonData from '../polygon-data';

describe('PolygonData', () => {
    const pd = PolygonData.getInstance();

    const defaultConfig = { maxPointCount: 32, alphaThreshold: 128, minimalDistance: 8 };
    const emptyMask = new Uint8Array(0);
    const emptyArrays: Uint16Array[] = [];

    function makeBuf(
        mask = emptyMask,
        contours = emptyArrays,
        polygons = emptyArrays,
        triangles = emptyArrays,
        config = defaultConfig,
        offset = 0,
        outline = 0,
    ): Uint16Array {
        return pd.serialize(mask, contours, polygons, triangles, config, offset, outline);
    }

    // ── Singleton ───────────────────────────────────────────────────

    describe('getInstance', () => {
        it('returns the same instance every time', () => {
            expect(PolygonData.getInstance()).toBe(pd);
        });
    });

    // ── Config round-trip ───────────────────────────────────────────

    describe('deserializeConfig', () => {
        it('round-trips default config values', () => {
            const buf = makeBuf();
            expect(pd.deserializeConfig(buf)).toEqual(defaultConfig);
        });

        it('round-trips maxPointCount boundary values', () => {
            const config = { maxPointCount: 0, alphaThreshold: 0, minimalDistance: 0 };
            expect(pd.deserializeConfig(makeBuf(emptyMask, [], [], [], config))).toEqual(config);
        });

        it('round-trips maxPointCount=255 alphaThreshold=255 minimalDistance=255', () => {
            const config = { maxPointCount: 255, alphaThreshold: 255, minimalDistance: 255 };
            expect(pd.deserializeConfig(makeBuf(emptyMask, [], [], [], config))).toEqual(config);
        });

        it('round-trips arbitrary config', () => {
            const config = { maxPointCount: 64, alphaThreshold: 10, minimalDistance: 3 };
            expect(pd.deserializeConfig(makeBuf(emptyMask, [], [], [], config))).toEqual(config);
        });
    });

    // ── Offset round-trip ───────────────────────────────────────────

    describe('deserializeOffset', () => {
        it.each([0, 1, 128, 255])('round-trips offset=%i', (offset) => {
            expect(pd.deserializeOffset(makeBuf(emptyMask, [], [], [], defaultConfig, offset))).toBe(offset);
        });
    });

    // ── Outline round-trip ──────────────────────────────────────────

    describe('deserializeOutline', () => {
        it.each([0, 42, 255])('round-trips outline=%i', (outline) => {
            expect(pd.deserializeOutline(makeBuf(emptyMask, [], [], [], defaultConfig, 0, outline))).toBe(outline);
        });
    });

    // ── alphaMask round-trip ────────────────────────────────────────

    describe('deserializeAlphaMask', () => {
        it('round-trips an empty mask', () => {
            const buf = makeBuf(new Uint8Array(0));
            expect(pd.deserializeAlphaMask(buf)).toEqual(new Uint8Array(0));
        });

        it('round-trips an even-length mask', () => {
            const mask = new Uint8Array([0, 1, 2, 3, 100, 200]);
            const buf = makeBuf(mask);
            expect(pd.deserializeAlphaMask(buf)).toEqual(mask);
        });

        it('round-trips an odd-length mask', () => {
            const mask = new Uint8Array([10, 20, 30, 40, 50]);
            const buf = makeBuf(mask);
            expect(pd.deserializeAlphaMask(buf)).toEqual(mask);
        });

        it('round-trips a single-byte mask', () => {
            const mask = new Uint8Array([255]);
            const buf = makeBuf(mask);
            expect(pd.deserializeAlphaMask(buf)).toEqual(mask);
        });
    });

    // ── Contours round-trip ─────────────────────────────────────────

    describe('deserializeContours', () => {
        it('returns empty array when no contours', () => {
            const buf = makeBuf();
            expect(pd.deserializeContours(buf)).toEqual([]);
        });

        it('round-trips a single contour array', () => {
            const c = new Uint16Array([1, 2, 3, 4]);
            const buf = makeBuf(emptyMask, [c]);
            const result = pd.deserializeContours(buf);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(c);
        });

        it('round-trips multiple contour arrays', () => {
            const c1 = new Uint16Array([10, 20]);
            const c2 = new Uint16Array([30, 40, 50]);
            const buf = makeBuf(emptyMask, [c1, c2]);
            const result = pd.deserializeContours(buf);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(c1);
            expect(result[1]).toEqual(c2);
        });
    });

    // ── Polygons round-trip ─────────────────────────────────────────

    describe('deserializePolygons', () => {
        it('returns empty array when no polygons', () => {
            const buf = makeBuf();
            expect(pd.deserializePolygons(buf)).toEqual([]);
        });

        it('round-trips a single polygon array', () => {
            const p = new Uint16Array([10, 20, 30, 40]);
            const buf = makeBuf(emptyMask, emptyArrays, [p]);
            const result = pd.deserializePolygons(buf);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(p);
        });

        it('round-trips multiple polygon arrays', () => {
            const p1 = new Uint16Array([1, 2, 3]);
            const p2 = new Uint16Array([4, 5, 6, 7]);
            const buf = makeBuf(emptyMask, emptyArrays, [p1, p2]);
            const result = pd.deserializePolygons(buf);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(p1);
            expect(result[1]).toEqual(p2);
        });
    });

    // ── Triangles round-trip ────────────────────────────────────────

    describe('deserializeTriangles', () => {
        it('returns empty array when no triangles', () => {
            const buf = makeBuf();
            expect(pd.deserializeTriangles(buf)).toEqual([]);
        });

        it('round-trips a single triangle array', () => {
            const t = new Uint16Array([0, 1, 2]);
            const buf = makeBuf(emptyMask, emptyArrays, emptyArrays, [t]);
            const result = pd.deserializeTriangles(buf);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(t);
        });

        it('round-trips multiple triangle arrays', () => {
            const t1 = new Uint16Array([0, 1, 2]);
            const t2 = new Uint16Array([3, 4, 5]);
            const buf = makeBuf(emptyMask, emptyArrays, emptyArrays, [t1, t2]);
            const result = pd.deserializeTriangles(buf);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(t1);
            expect(result[1]).toEqual(t2);
        });
    });

    // ── Full round-trip ─────────────────────────────────────────────

    describe('full serialize/deserialize round-trip', () => {
        it('preserves all fields simultaneously', () => {
            const config = { maxPointCount: 32, alphaThreshold: 1, minimalDistance: 8 };
            const mask = new Uint8Array([0, 1, 2, 3]);
            const polygon = new Uint16Array([10, 20, 30, 40]);
            const tri = new Uint16Array([0, 1, 2]);
            const buf = pd.serialize(mask, [polygon], [polygon], [tri], config, 4, 7);

            expect(pd.deserializeConfig(buf)).toEqual(config);
            expect(pd.deserializeOffset(buf)).toBe(4);
            expect(pd.deserializeOutline(buf)).toBe(7);
            expect(pd.deserializeAlphaMask(buf)).toEqual(mask);
            expect(pd.deserializeContours(buf)[0]).toEqual(polygon);
            expect(pd.deserializePolygons(buf)[0]).toEqual(polygon);
            expect(pd.deserializeTriangles(buf)[0]).toEqual(tri);
        });
    });

    // ── hasAlphaMask ────────────────────────────────────────────────

    describe('hasAlphaMask', () => {
        it('returns false when mask is empty', () => {
            expect(pd.hasAlphaMask(makeBuf(new Uint8Array(0)))).toBe(false);
        });

        it('returns true when mask has bytes', () => {
            expect(pd.hasAlphaMask(makeBuf(new Uint8Array([1, 2, 3])))).toBe(true);
        });
    });

    // ── hasContours ─────────────────────────────────────────────────

    describe('hasContours', () => {
        it('returns false when contours are empty', () => {
            expect(pd.hasContours(makeBuf())).toBe(false);
        });

        it('returns true when contours are non-empty', () => {
            const buf = makeBuf(emptyMask, [new Uint16Array([1, 2, 3])]);
            expect(pd.hasContours(buf)).toBe(true);
        });
    });

    // ── hasPolygons ─────────────────────────────────────────────────

    describe('hasPolygons', () => {
        it('returns false when polygons are empty', () => {
            expect(pd.hasPolygons(makeBuf())).toBe(false);
        });

        it('returns true when polygons are non-empty', () => {
            const buf = makeBuf(emptyMask, emptyArrays, [new Uint16Array([10, 20])]);
            expect(pd.hasPolygons(buf)).toBe(true);
        });
    });

    // ── hasTriangles ────────────────────────────────────────────────

    describe('hasTriangles', () => {
        it('returns false when triangles are empty', () => {
            expect(pd.hasTriangles(makeBuf())).toBe(false);
        });

        it('returns true when triangles are non-empty', () => {
            const buf = makeBuf(emptyMask, emptyArrays, emptyArrays, [new Uint16Array([0, 1, 2])]);
            expect(pd.hasTriangles(buf)).toBe(true);
        });
    });
});
