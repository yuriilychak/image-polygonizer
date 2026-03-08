export function removeSmallestPitsUntilMaxPointCount(
    contour: Uint16Array,
    maxPointCount: number,
): Uint16Array {
    const normalized = normalizeClosedContour(contour);
    const pointCount = normalized.length >> 1;

    if (pointCount <= 3 || pointCount <= maxPointCount) {
        return normalized;
    }

    const state = createLinkedState(normalized);
    const signedArea = polygonSignedAreaByState(state);
    const orientationSign = signedArea >= 0 ? 1 : -1;

    while (state.activeCount > 3 && state.activeCount > maxPointCount) {
        let bestIndex = -1;
        let bestArea = Number.POSITIVE_INFINITY;

        let start = findFirstAlive(state.alive);

        if (start < 0) {
            break;
        }

        let curr = start;

        do {
            if (state.alive[curr] !== 0) {
                const prev = state.prev[curr];
                const next = state.next[curr];

                const ax = getX(state.points, prev);
                const ay = getY(state.points, prev);
                const bx = getX(state.points, curr);
                const by = getY(state.points, curr);
                const cx = getX(state.points, next);
                const cy = getY(state.points, next);

                const cross = cross2(ax, ay, bx, by, cx, cy);
                const isConcave = orientationSign > 0 ? cross < 0 : cross > 0;

                if (isConcave) {
                    const area = Math.abs(cross) * 0.5;

                    if (area < bestArea && !wouldCreateSelfIntersectionAfterRemoval(state, curr)) {
                        bestArea = area;
                        bestIndex = curr;
                    }
                }
            }

            curr = state.next[curr];
        } while (curr !== start);

        if (bestIndex < 0) {
            break;
        }

        removeVertex(state, bestIndex);
    }

    return materializeState(state);
}

/* =========================================================
 * Linked state
 * ========================================================= */

interface LinkedContourState {
    points: Uint16Array;
    prev: Int32Array;
    next: Int32Array;
    alive: Uint8Array;
    activeCount: number;
}

function createLinkedState(points: Uint16Array): LinkedContourState {
    const pointCount = points.length >> 1;
    const prev = new Int32Array(pointCount);
    const next = new Int32Array(pointCount);
    const alive = new Uint8Array(pointCount);

    for (let i = 0; i < pointCount; ++i) {
        prev[i] = i === 0 ? pointCount - 1 : i - 1;
        next[i] = i === pointCount - 1 ? 0 : i + 1;
        alive[i] = 1;
    }

    return {
        points,
        prev,
        next,
        alive,
        activeCount: pointCount,
    };
}

function removeVertex(state: LinkedContourState, index: number): void {
    const p = state.prev[index];
    const n = state.next[index];

    state.next[p] = n;
    state.prev[n] = p;
    state.alive[index] = 0;
    --state.activeCount;
}

function findFirstAlive(alive: Uint8Array): number {
    for (let i = 0; i < alive.length; ++i) {
        if (alive[i] !== 0) {
            return i;
        }
    }

    return -1;
}

function materializeState(state: LinkedContourState): Uint16Array {
    const out = new Uint16Array(state.activeCount << 1);

    const start = findFirstAlive(state.alive);

    if (start < 0) {
        return out;
    }

    let current = start;
    let w = 0;

    do {
        out[w] = getX(state.points, current);
        out[w + 1] = getY(state.points, current);
        w += 2;
        current = state.next[current];
    } while (current !== start);

    return out;
}

/* =========================================================
 * Local self-intersection check after removal
 * Only the new edge prev -> next matters.
 * ========================================================= */

function wouldCreateSelfIntersectionAfterRemoval(
    state: LinkedContourState,
    curr: number,
): boolean {
    if (state.activeCount <= 3) {
        return false;
    }

    const prev = state.prev[curr];
    const next = state.next[curr];

    const ax = getX(state.points, prev);
    const ay = getY(state.points, prev);
    const bx = getX(state.points, next);
    const by = getY(state.points, next);

    const start = findFirstAlive(state.alive);

    if (start < 0) {
        return false;
    }

    let e0 = start;

    do {
        const e1 = state.next[e0];

        if (
            e0 === prev ||
            e1 === prev ||
            e0 === curr ||
            e1 === curr ||
            e0 === next ||
            e1 === next
        ) {
            e0 = state.next[e0];
            continue;
        }

        const c0x = getX(state.points, e0);
        const c0y = getY(state.points, e0);
        const c1x = getX(state.points, e1);
        const c1y = getY(state.points, e1);

        if (segmentsIntersect(ax, ay, bx, by, c0x, c0y, c1x, c1y)) {
            return true;
        }

        e0 = state.next[e0];
    } while (e0 !== start);

    return false;
}

/* =========================================================
 * Geometry helpers
 * ========================================================= */

function normalizeClosedContour(contour: Uint16Array): Uint16Array {
    let pointCount = contour.length >> 1;

    if (pointCount === 0) {
        return contour.slice();
    }

    if (
        pointCount > 1 &&
        contour[0] === contour[(pointCount - 1) << 1] &&
        contour[1] === contour[((pointCount - 1) << 1) + 1]
    ) {
        --pointCount;
    }

    const out = new Uint16Array(pointCount << 1);

    for (let i = 0; i < out.length; ++i) {
        out[i] = contour[i];
    }

    return out;
}

function getX(points: Uint16Array, pointIndex: number): number {
    return points[pointIndex << 1];
}

function getY(points: Uint16Array, pointIndex: number): number {
    return points[(pointIndex << 1) + 1];
}

function cross2(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
): number {
    return (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
}

function polygonSignedAreaByState(state: LinkedContourState): number {
    const start = findFirstAlive(state.alive);

    if (start < 0) {
        return 0;
    }

    let sum = 0;
    let i = start;

    do {
        const j = state.next[i];

        sum +=
            getX(state.points, i) * getY(state.points, j) -
            getX(state.points, j) * getY(state.points, i);

        i = j;
    } while (i !== start);

    return sum * 0.5;
}

function orient(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
): number {
    const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

    if (v > 0) return 1;
    if (v < 0) return -1;
    return 0;
}

function onSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number,
): boolean {
    return (
        px >= Math.min(ax, bx) &&
        px <= Math.max(ax, bx) &&
        py >= Math.min(ay, by) &&
        py <= Math.max(ay, by) &&
        orient(ax, ay, bx, by, px, py) === 0
    );
}

function segmentsIntersect(
    a0x: number,
    a0y: number,
    a1x: number,
    a1y: number,
    b0x: number,
    b0y: number,
    b1x: number,
    b1y: number,
): boolean {
    const o1 = orient(a0x, a0y, a1x, a1y, b0x, b0y);
    const o2 = orient(a0x, a0y, a1x, a1y, b1x, b1y);
    const o3 = orient(b0x, b0y, b1x, b1y, a0x, a0y);
    const o4 = orient(b0x, b0y, b1x, b1y, a1x, a1y);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    if (o1 === 0 && onSegment(a0x, a0y, a1x, a1y, b0x, b0y)) return true;
    if (o2 === 0 && onSegment(a0x, a0y, a1x, a1y, b1x, b1y)) return true;
    if (o3 === 0 && onSegment(b0x, b0y, b1x, b1y, a0x, a0y)) return true;
    if (o4 === 0 && onSegment(b0x, b0y, b1x, b1y, a1x, a1y)) return true;

    return false;
}