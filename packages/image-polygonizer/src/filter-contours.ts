import { getX, getY, normalizeClosedContour, polygonSignedArea, pointOnSegment, segmentsIntersect } from './helpers';

export function filterContoursContainedInOthers(
    contours: Uint16Array[],
): Uint16Array[] {
    const normalized = new Array<Uint16Array>(contours.length);
    const boxes = new Array<BBox>(contours.length);
    const areas = new Array<number>(contours.length);

    for (let i = 0; i < contours.length; ++i) {
        const c = normalizeClosedContour(contours[i]);
        normalized[i] = c;
        boxes[i] = computeBBox(c);
        areas[i] = Math.abs(polygonSignedArea(c));
    }

    const removed = new Uint8Array(contours.length);

    for (let i = 0; i < normalized.length; ++i) {
        if (removed[i] !== 0) {
            continue;
        }

        const a = normalized[i];
        const boxA = boxes[i];
        const areaA = areas[i];

        for (let j = 0; j < normalized.length; ++j) {
            if (i === j || removed[i] !== 0) {
                continue;
            }

            const b = normalized[j];
            const boxB = boxes[j];
            const areaB = areas[j];

            // Only a contour smaller or equal in area can be nested.
            if (areaA > areaB) {
                continue;
            }

            // Quick bounding-box filter.
            if (!bboxContains(boxB, boxA)) {
                continue;
            }

            if (isContourInsideOther(a, b)) {
                removed[i] = 1;
                break;
            }
        }
    }

    const out: Uint16Array[] = [];

    for (let i = 0; i < normalized.length; ++i) {
        if (removed[i] === 0) {
            out.push(normalized[i]);
        }
    }

    return out;
}

/* =========================================================
 * Main pair test: A is fully inside B
 * ========================================================= */

function isContourInsideOther(
    inner: Uint16Array,
    outer: Uint16Array,
): boolean {
    const innerCount = inner.length >> 1;
    const outerCount = outer.length >> 1;

    if (innerCount < 3 || outerCount < 3) {
        return false;
    }

    // 1. If there are edge intersections, inner cannot be completely inside outer.
    if (contoursIntersect(inner, outer)) {
        return false;
    }

    // 2. It's sufficient to check one vertex of inner.
    const px = getX(inner, 0);
    const py = getY(inner, 0);

    return pointInPolygonOrOnEdge(outer, px, py);
}

/* =========================================================
 * Intersections between two simple polygons
 * ========================================================= */

function contoursIntersect(
    a: Uint16Array,
    b: Uint16Array,
): boolean {
    const aCount = a.length >> 1;
    const bCount = b.length >> 1;

    for (let i = 0; i < aCount; ++i) {
        const i2 = (i + 1) % aCount;

        const a0x = getX(a, i);
        const a0y = getY(a, i);
        const a1x = getX(a, i2);
        const a1y = getY(a, i2);

        for (let j = 0; j < bCount; ++j) {
            const j2 = (j + 1) % bCount;

            const b0x = getX(b, j);
            const b0y = getY(b, j);
            const b1x = getX(b, j2);
            const b1y = getY(b, j2);

            if (segmentsIntersect(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y)) {
                return true;
            }
        }
    }

    return false;
}

/* =========================================================
 * Point in polygon / edge
 * ========================================================= */

function pointInPolygonOrOnEdge(
    polygon: Uint16Array,
    px: number,
    py: number,
): boolean {
    const count = polygon.length >> 1;
    let inside = false;

    for (let i = 0, j = count - 1; i < count; j = i++) {
        const xi = getX(polygon, i);
        const yi = getY(polygon, i);
        const xj = getX(polygon, j);
        const yj = getY(polygon, j);

        if (pointOnSegment(xj, yj, xi, yi, px, py)) {
            return true;
        }

        const intersects =
            (yi > py) !== (yj > py) &&
            px <= ((xj - xi) * (py - yi)) / (yj - yi) + xi;

        if (intersects) {
            inside = !inside;
        }
    }

    return inside;
}

/* =========================================================
 * BBox helpers
 * ========================================================= */

interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

function computeBBox(contour: Uint16Array): BBox {
    const count = contour.length >> 1;

    let minX = getX(contour, 0);
    let maxX = minX;
    let minY = getY(contour, 0);
    let maxY = minY;

    for (let i = 1; i < count; ++i) {
        const x = getX(contour, i);
        const y = getY(contour, i);

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    return { minX, minY, maxX, maxY };
}

function bboxContains(outer: BBox, inner: BBox): boolean {
    return (
        inner.minX >= outer.minX &&
        inner.maxX <= outer.maxX &&
        inner.minY >= outer.minY &&
        inner.maxY <= outer.maxY
    );
}

