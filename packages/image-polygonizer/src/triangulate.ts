import { getX, getY, orientRaw, polygonSignedArea, normalizeClosedContour, findFirstAlive, buildUndirectedEdgeMap, thirdVertexOfTriangle, triangleAngle, orientTriangleLikePolygon } from './helpers';

export function triangulateSimplePolygonAvoidSlivers(
    contour: Uint16Array,
): Uint16Array {
    const normalized = normalizeClosedContour(contour);
    const pointCount = normalized.length >> 1;

    if (pointCount < 3) {
        return new Uint16Array(0);
    }

    if (pointCount === 3) {
        return new Uint16Array([0, 1, 2]);
    }

    const orientationSign = polygonSignedArea(normalized) >= 0 ? 1 : -1;

    const prev = new Int32Array(pointCount);
    const next = new Int32Array(pointCount);
    const alive = new Uint8Array(pointCount);

    for (let i = 0; i < pointCount; ++i) {
        prev[i] = i === 0 ? pointCount - 1 : i - 1;
        next[i] = i === pointCount - 1 ? 0 : i + 1;
        alive[i] = 1;
    }

    const triangles: number[] = [];
    let activeCount = pointCount;

    while (activeCount > 3) {
        let bestEar = -1;
        let bestScore = -Infinity;

        let start = findFirstAlive(alive);
        if (start < 0) {
            break;
        }

        let i = start;

        do {
            if (alive[i] !== 0 && isEar(normalized, i, prev, next, alive, orientationSign)) {
                const a = prev[i];
                const b = i;
                const c = next[i];

                const score = scoreEar(normalized, a, b, c);

                if (score > bestScore) {
                    bestScore = score;
                    bestEar = i;
                }
            }

            i = next[i];
        } while (i !== start);

        if (bestEar < 0) {
            start = findFirstAlive(alive);
            i = start;

            do {
                if (alive[i] !== 0) {
                    const a = prev[i];
                    const b = i;
                    const c = next[i];

                    if (isConvex(normalized, a, b, c, orientationSign)) {
                        bestEar = i;
                        break;
                    }
                }

                i = next[i];
            } while (i !== start);

            if (bestEar < 0) {
                break;
            }
        }

        const a = prev[bestEar];
        const b = bestEar;
        const c = next[bestEar];

        triangles.push(a, b, c);

        const p = prev[bestEar];
        const n = next[bestEar];
        next[p] = n;
        prev[n] = p;
        alive[bestEar] = 0;
        --activeCount;
    }

    if (activeCount === 3) {
        const last = new Uint16Array(3);
        let w = 0;

        for (let i = 0; i < pointCount; ++i) {
            if (alive[i] !== 0) {
                last[w++] = i;
            }
        }

        if (w === 3) {
            triangles.push(last[0], last[1], last[2]);
        }
    }

    optimizeTrianglesByEdgeFlip(normalized, triangles);

    return Uint16Array.from(triangles);
}

/* =========================================================
 * Ear clipping
 * ========================================================= */

function isEar(
    contour: Uint16Array,
    i: number,
    prev: Int32Array,
    next: Int32Array,
    alive: Uint8Array,
    orientationSign: number,
): boolean {
    const a = prev[i];
    const b = i;
    const c = next[i];

    if (!isConvex(contour, a, b, c, orientationSign)) {
        return false;
    }

    const ax = getX(contour, a);
    const ay = getY(contour, a);
    const bx = getX(contour, b);
    const by = getY(contour, b);
    const cx = getX(contour, c);
    const cy = getY(contour, c);

    const minX = Math.min(ax, bx, cx);
    const maxX = Math.max(ax, bx, cx);
    const minY = Math.min(ay, by, cy);
    const maxY = Math.max(ay, by, cy);

    for (let p = 0; p < alive.length; ++p) {
        if (alive[p] === 0 || p === a || p === b || p === c) {
            continue;
        }

        const px = getX(contour, p);
        const py = getY(contour, p);

        if (px < minX || px > maxX || py < minY || py > maxY) {
            continue;
        }

        if (pointInTriangleOrOnEdge(px, py, ax, ay, bx, by, cx, cy)) {
            return false;
        }
    }

    return true;
}

function isConvex(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
    orientationSign: number,
): boolean {
    const cross = orientRaw(
        getX(contour, a),
        getY(contour, a),
        getX(contour, b),
        getY(contour, b),
        getX(contour, c),
        getY(contour, c),
    );

    return orientationSign > 0 ? cross > 0 : cross < 0;
}

function scoreEar(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
): number {
    const minAngle = triangleMinAngle(contour, a, b, c);
    const maxAngle = triangleMaxAngle(contour, a, b, c);
    const area2 = Math.abs(
        orientRaw(
            getX(contour, a), getY(contour, a),
            getX(contour, b), getY(contour, b),
            getX(contour, c), getY(contour, c),
        ),
    );

    return minAngle * 100000 - maxAngle * 10 + area2;
}

/* =========================================================
 * Edge flip optimization
 * ========================================================= */

function optimizeTrianglesByEdgeFlip(
    contour: Uint16Array,
    triangles: number[],
): void {
    if (triangles.length < 6) {
        return;
    }

    let changed = true;
    let guard = 0;

    while (changed && guard < 1000) {
        changed = false;
        ++guard;

        const edgeMap = buildUndirectedEdgeMap(triangles);

        for (const entry of edgeMap.values()) {
            if (entry.tris.length !== 2) {
                continue;
            }

            const tIdx1 = entry.tris[0];
            const tIdx2 = entry.tris[1];

            const t1a = triangles[tIdx1];
            const t1b = triangles[tIdx1 + 1];
            const t1c = triangles[tIdx1 + 2];

            const t2a = triangles[tIdx2];
            const t2b = triangles[tIdx2 + 1];
            const t2c = triangles[tIdx2 + 2];

            const edgeU = entry.u;
            const edgeV = entry.v;

            const w1 = thirdVertexOfTriangle(t1a, t1b, t1c, edgeU, edgeV);
            const w2 = thirdVertexOfTriangle(t2a, t2b, t2c, edgeU, edgeV);

            if (w1 < 0 || w2 < 0 || w1 === w2) {
                continue;
            }

            if (!isConvexQuad(contour, w1, edgeU, w2, edgeV)) {
                continue;
            }

            const beforeScore = pairScore(contour, edgeU, edgeV, w1, w2);
            const afterScore = flippedPairScore(contour, edgeU, edgeV, w1, w2);

            if (afterScore <= beforeScore) {
                continue;
            }

            const flipped1 = orientTriangleLikePolygon(contour, w1, w2, edgeU);
            const flipped2 = orientTriangleLikePolygon(contour, w2, w1, edgeV);

            triangles[tIdx1] = flipped1[0];
            triangles[tIdx1 + 1] = flipped1[1];
            triangles[tIdx1 + 2] = flipped1[2];

            triangles[tIdx2] = flipped2[0];
            triangles[tIdx2 + 1] = flipped2[1];
            triangles[tIdx2 + 2] = flipped2[2];

            changed = true;
            break;
        }
    }
}

function isConvexQuad(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
    d: number,
): boolean {
    const polySign = polygonSignedArea(contour) >= 0 ? 1 : -1;

    const o1 = orientRaw(getX(contour, a), getY(contour, a), getX(contour, b), getY(contour, b), getX(contour, c), getY(contour, c));
    const o2 = orientRaw(getX(contour, b), getY(contour, b), getX(contour, c), getY(contour, c), getX(contour, d), getY(contour, d));
    const o3 = orientRaw(getX(contour, c), getY(contour, c), getX(contour, d), getY(contour, d), getX(contour, a), getY(contour, a));
    const o4 = orientRaw(getX(contour, d), getY(contour, d), getX(contour, a), getY(contour, a), getX(contour, b), getY(contour, b));

    if (polySign > 0) {
        return o1 > 0 && o2 > 0 && o3 > 0 && o4 > 0;
    }

    return o1 < 0 && o2 < 0 && o3 < 0 && o4 < 0;
}

function pairScore(
    contour: Uint16Array,
    u: number,
    v: number,
    w1: number,
    w2: number,
): number {
    const t1Min = triangleMinAngle(contour, u, v, w1);
    const t2Min = triangleMinAngle(contour, v, u, w2);
    return Math.min(t1Min, t2Min);
}

function flippedPairScore(
    contour: Uint16Array,
    u: number,
    v: number,
    w1: number,
    w2: number,
): number {
    const t1Min = triangleMinAngle(contour, w1, w2, u);
    const t2Min = triangleMinAngle(contour, w2, w1, v);
    return Math.min(t1Min, t2Min);
}

/* =========================================================
 * Triangle geometry
 * ========================================================= */

function triangleMinAngle(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
): number {
    const ax = getX(contour, a);
    const ay = getY(contour, a);
    const bx = getX(contour, b);
    const by = getY(contour, b);
    const cx = getX(contour, c);
    const cy = getY(contour, c);

    const angleA = triangleAngle(bx - ax, by - ay, cx - ax, cy - ay);
    const angleB = triangleAngle(ax - bx, ay - by, cx - bx, cy - by);
    const angleC = triangleAngle(ax - cx, ay - cy, bx - cx, by - cy);

    return Math.min(angleA, angleB, angleC);
}

function triangleMaxAngle(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
): number {
    const ax = getX(contour, a);
    const ay = getY(contour, a);
    const bx = getX(contour, b);
    const by = getY(contour, b);
    const cx = getX(contour, c);
    const cy = getY(contour, c);

    const angleA = triangleAngle(bx - ax, by - ay, cx - ax, cy - ay);
    const angleB = triangleAngle(ax - bx, ay - by, cx - bx, cy - by);
    const angleC = triangleAngle(ax - cx, ay - cy, bx - cx, by - cy);

    return Math.max(angleA, angleB, angleC);
}

/* =========================================================
 * Geometry
 * ========================================================= */

function pointInTriangleOrOnEdge(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
): boolean {
    const o1 = orientRaw(ax, ay, bx, by, px, py);
    const o2 = orientRaw(bx, by, cx, cy, px, py);
    const o3 = orientRaw(cx, cy, ax, ay, px, py);

    const hasNeg = o1 < 0 || o2 < 0 || o3 < 0;
    const hasPos = o1 > 0 || o2 > 0 || o3 > 0;

    return !(hasNeg && hasPos);
}
