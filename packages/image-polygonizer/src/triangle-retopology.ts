import { getX, getY, orientRaw, polygonSignedArea, buildUndirectedEdgeMap, thirdVertexOfTriangle, triangleAngle, orientTriangleLikePolygon } from './helpers';

export function optimizeTrianglesByEdgeFlipRepeated(
    contour: Uint16Array,
    indices: Uint16Array,
    maxPasses = 100,
): Uint16Array {
    const triangles = Array.from(indices);

    if (triangles.length < 6) {
        return indices.slice();
    }

    let changed = true;
    let pass = 0;

    while (changed && pass < maxPasses) {
        changed = false;
        ++pass;

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

            const u = entry.u;
            const v = entry.v;

            const w1 = thirdVertexOfTriangle(t1a, t1b, t1c, u, v);
            const w2 = thirdVertexOfTriangle(t2a, t2b, t2c, u, v);

            if (w1 < 0 || w2 < 0 || w1 === w2) {
                continue;
            }

            // The quad must be convex for a correct edge flip.
            const quad = orderQuadAroundSharedEdge(contour, u, v, w1, w2);
            if (quad === null) {
                continue;
            }

            const [q0, q1, q2, q3] = quad;

            if (!isStrictlyConvexQuad(contour, q0, q1, q2, q3)) {
                continue;
            }

            const before = evaluateTrianglePair(contour, u, v, w1, w2);
            const after = evaluateTrianglePairFlipped(contour, u, v, w1, w2);

            // The new configuration must actually improve quality.
            if (!isPairScoreBetter(after, before)) {
                continue;
            }

            const flipped1 = orientTriangleLikePolygon(contour, w1, w2, u);
            const flipped2 = orientTriangleLikePolygon(contour, w2, w1, v);

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

    return Uint16Array.from(triangles);
}

/* =========================================================
 * Pair scoring
 * ========================================================= */

interface PairScore {
    minAngle: number;
    maxAngle: number;
    diagLenSq: number;
}

function evaluateTrianglePair(
    contour: Uint16Array,
    u: number,
    v: number,
    w1: number,
    w2: number,
): PairScore {
    const t1 = triangleAngles(contour, u, v, w1);
    const t2 = triangleAngles(contour, v, u, w2);

    const minAngle = Math.min(t1.minAngle, t2.minAngle);
    const maxAngle = Math.max(t1.maxAngle, t2.maxAngle);

    const ux = getX(contour, u);
    const uy = getY(contour, u);
    const vx = getX(contour, v);
    const vy = getY(contour, v);
    const diagLenSq = sqr(ux - vx) + sqr(uy - vy);

    return { minAngle, maxAngle, diagLenSq };
}

function evaluateTrianglePairFlipped(
    contour: Uint16Array,
    u: number,
    v: number,
    w1: number,
    w2: number,
): PairScore {
    const t1 = triangleAngles(contour, w1, w2, u);
    const t2 = triangleAngles(contour, w2, w1, v);

    const minAngle = Math.min(t1.minAngle, t2.minAngle);
    const maxAngle = Math.max(t1.maxAngle, t2.maxAngle);

    const x1 = getX(contour, w1);
    const y1 = getY(contour, w1);
    const x2 = getX(contour, w2);
    const y2 = getY(contour, w2);
    const diagLenSq = sqr(x1 - x2) + sqr(y1 - y2);

    return { minAngle, maxAngle, diagLenSq };
}

function isPairScoreBetter(
    a: PairScore,
    b: PairScore,
): boolean {
    const eps = 1e-9;

    // 1. Maximize the minimum angle
    if (a.minAngle > b.minAngle + eps) {
        return true;
    }

    if (a.minAngle < b.minAngle - eps) {
        return false;
    }

    // 2. Minimize the maximum angle
    if (a.maxAngle < b.maxAngle - eps) {
        return true;
    }

    if (a.maxAngle > b.maxAngle + eps) {
        return false;
    }

    // 3. Slightly prefer the shorter diagonal,
    // if it doesn't worsen the angles
    return a.diagLenSq < b.diagLenSq;
}

/* =========================================================
 * Quad / adjacency helpers
 * ========================================================= */

function orderQuadAroundSharedEdge(
    contour: Uint16Array,
    u: number,
    v: number,
    w1: number,
    w2: number,
): [number, number, number, number] | null {
    // Quad traversal candidates
    const candidates: Array<[number, number, number, number]> = [
        [w1, u, w2, v],
        [w1, v, w2, u],
        [w2, u, w1, v],
        [w2, v, w1, u],
    ];

    for (let i = 0; i < candidates.length; ++i) {
        const q = candidates[i];
        if (isStrictlyConvexQuad(contour, q[0], q[1], q[2], q[3])) {
            return q;
        }
    }

    return null;
}

function isStrictlyConvexQuad(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
    d: number,
): boolean {
    const polySign = polygonSignedArea(contour) >= 0 ? 1 : -1;

    const o1 = orientRaw(
        getX(contour, a), getY(contour, a),
        getX(contour, b), getY(contour, b),
        getX(contour, c), getY(contour, c),
    );
    const o2 = orientRaw(
        getX(contour, b), getY(contour, b),
        getX(contour, c), getY(contour, c),
        getX(contour, d), getY(contour, d),
    );
    const o3 = orientRaw(
        getX(contour, c), getY(contour, c),
        getX(contour, d), getY(contour, d),
        getX(contour, a), getY(contour, a),
    );
    const o4 = orientRaw(
        getX(contour, d), getY(contour, d),
        getX(contour, a), getY(contour, a),
        getX(contour, b), getY(contour, b),
    );

    if (polySign > 0) {
        return o1 > 0 && o2 > 0 && o3 > 0 && o4 > 0;
    }

    return o1 < 0 && o2 < 0 && o3 < 0 && o4 < 0;
}

/* =========================================================
 * Triangle helpers
 * ========================================================= */

function triangleAngles(
    contour: Uint16Array,
    a: number,
    b: number,
    c: number,
): { minAngle: number; maxAngle: number } {
    const ax = getX(contour, a);
    const ay = getY(contour, a);
    const bx = getX(contour, b);
    const by = getY(contour, b);
    const cx = getX(contour, c);
    const cy = getY(contour, c);

    const angleA = triangleAngle(bx - ax, by - ay, cx - ax, cy - ay);
    const angleB = triangleAngle(ax - bx, ay - by, cx - bx, cy - by);
    const angleC = triangleAngle(ax - cx, ay - cy, bx - cx, by - cy);

    return {
        minAngle: Math.min(angleA, angleB, angleC),
        maxAngle: Math.max(angleA, angleB, angleC),
    };
}


/* =========================================================
 * Basic geometry helpers
 * ========================================================= */

function sqr(v: number): number {
    return v * v;
}
