export function simplifyClosedPixelContourRDPNoSelfIntersections(
    contour: Uint16Array,
    epsilon: number,
): Uint16Array {
    let pointCount = contour.length >> 1;

    if (pointCount < 3) {
        return contour.slice();
    }

    // Remove duplicate last point if the contour is already closed by repeating the first.
    if (
        contour[0] === contour[(pointCount - 1) << 1] &&
        contour[1] === contour[((pointCount - 1) << 1) + 1]
    ) {
        --pointCount;
    }

    if (pointCount < 3) {
        const out = new Uint16Array(pointCount << 1);

        for (let i = 0; i < out.length; ++i) {
            out[i] = contour[i];
        }

        return out;
    }

    const normalized = new Uint16Array(pointCount << 1);

    for (let i = 0; i < normalized.length; ++i) {
        normalized[i] = contour[i];
    }

    const anchor = findAnchorIndex(normalized, pointCount);
    const split = findFarthestPointFromAnchor(normalized, pointCount, anchor);

    // If the contour is degenerate, return it as is.
    if (split === anchor) {
        return normalized;
    }

    // Build two arcs:
    // arc1: anchor -> ... -> split
    // arc2: split -> ... -> anchor
    const arc1 = buildArcIndices(pointCount, anchor, split);
    const arc2 = buildArcIndices(pointCount, split, anchor);

    const keep1 = simplifyOpenPolylineRDPByLineDistance(
        normalized,
        arc1,
        epsilon,
    );
    const keep2 = simplifyOpenPolylineRDPByLineDistance(
        normalized,
        arc2,
        epsilon,
    );

    const kept = mergeKeptArcs(arc1, keep1, arc2, keep2);

    if (kept.length < 3) {
        return normalized;
    }

    resolveClosedContourSelfIntersections(normalized, kept, epsilon);

    if (kept.length < 3) {
        return normalized;
    }

    cleanupRedundantVertices(normalized, kept, epsilon * epsilon);

    if (kept.length < 3) {
        return normalized;
    }

    return materializeContour(normalized, kept);
}

/* =========================================================
 * Basic utilities
 * ========================================================= */

function getX(contour: Uint16Array, pointIndex: number): number {
    return contour[pointIndex << 1];
}

function getY(contour: Uint16Array, pointIndex: number): number {
    return contour[(pointIndex << 1) + 1];
}

function findAnchorIndex(contour: Uint16Array, pointCount: number): number {
    let anchor = 0;
    let minX = getX(contour, 0);
    let minY = getY(contour, 0);

    for (let i = 1; i < pointCount; ++i) {
        const x = getX(contour, i);
        const y = getY(contour, i);

        if (x < minX || (x === minX && y < minY)) {
            anchor = i;
            minX = x;
            minY = y;
        }
    }

    return anchor;
}

function findFarthestPointFromAnchor(
    contour: Uint16Array,
    pointCount: number,
    anchor: number,
): number {
    const ax = getX(contour, anchor);
    const ay = getY(contour, anchor);

    let bestIndex = anchor;
    let bestDistSq = -1;

    for (let i = 0; i < pointCount; ++i) {
        if (i === anchor) {
            continue;
        }

        const dx = getX(contour, i) - ax;
        const dy = getY(contour, i) - ay;
        const distSq = dx * dx + dy * dy;

        if (distSq > bestDistSq) {
            bestDistSq = distSq;
            bestIndex = i;
        }
    }

    return bestIndex;
}

function buildArcIndices(
    pointCount: number,
    start: number,
    end: number,
): Uint32Array {
    let len = 1;
    let current = start;

    while (current !== end) {
        current = (current + 1) % pointCount;
        ++len;
    }

    const arc = new Uint32Array(len);
    current = start;

    for (let i = 0; i < len; ++i) {
        arc[i] = current;

        if (current !== end) {
            current = (current + 1) % pointCount;
        }
    }

    return arc;
}

function mergeKeptArcs(
    arc1: Uint32Array,
    keep1: Uint8Array,
    arc2: Uint32Array,
    keep2: Uint8Array,
): number[] {
    const kept: number[] = [];

    for (let i = 0; i < arc1.length; ++i) {
        if (keep1[i] !== 0) {
            kept.push(arc1[i]);
        }
    }

    // In arc2 skip the first and last points,
    // because these are the same split and anchor, already added from arc1.
    for (let i = 1; i < arc2.length - 1; ++i) {
        if (keep2[i] !== 0) {
            kept.push(arc2[i]);
        }
    }

    return kept;
}

function pointLineDistanceSqByIndex(
    contour: Uint16Array,
    pIndex: number,
    aIndex: number,
    bIndex: number,
): number {
    const px = getX(contour, pIndex);
    const py = getY(contour, pIndex);
    const ax = getX(contour, aIndex);
    const ay = getY(contour, aIndex);
    const bx = getX(contour, bIndex);
    const by = getY(contour, bIndex);

    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;

    if (lenSq === 0) {
        const dx = px - ax;
        const dy = py - ay;
        return dx * dx + dy * dy;
    }

    const cross = abx * (py - ay) - aby * (px - ax);
    return (cross * cross) / lenSq;
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

function isSamePointByIndex(
    contour: Uint16Array,
    aIndex: number,
    bIndex: number,
): boolean {
    return (
        getX(contour, aIndex) === getX(contour, bIndex) &&
        getY(contour, aIndex) === getY(contour, bIndex)
    );
}

function isArcAdjacent(edgeA: number, edgeB: number, edgeCount: number): boolean {
    if (edgeA === edgeB) return true;
    if ((edgeA + 1) % edgeCount === edgeB) return true;
    if ((edgeB + 1) % edgeCount === edgeA) return true;
    return false;
}

/* =========================================================
 * RDP for an open polyline
 * ========================================================= */

function simplifyOpenPolylineRDPByLineDistance(
    contour: Uint16Array,
    openIndices: Uint32Array,
    epsilon: number,
): Uint8Array {
    const n = openIndices.length;
    const keep = new Uint8Array(n);
    const epsilonSq = epsilon * epsilon;

    if (n <= 2) {
        for (let i = 0; i < n; ++i) {
            keep[i] = 1;
        }

        return keep;
    }

    keep[0] = 1;
    keep[n - 1] = 1;

    const stackStart = new Uint32Array(n);
    const stackEnd = new Uint32Array(n);
    let stackSize = 0;

    stackStart[stackSize] = 0;
    stackEnd[stackSize] = n - 1;
    ++stackSize;

    while (stackSize > 0) {
        --stackSize;

        const start = stackStart[stackSize];
        const end = stackEnd[stackSize];

        if (end - start <= 1) {
            continue;
        }

        const aIndex = openIndices[start];
        const bIndex = openIndices[end];

        let maxDistSq = -1;
        let maxIndex = -1;

        for (let i = start + 1; i < end; ++i) {
            const pIndex = openIndices[i];
            const distSq = pointLineDistanceSqByIndex(contour, pIndex, aIndex, bIndex);

            if (distSq > maxDistSq) {
                maxDistSq = distSq;
                maxIndex = i;
            }
        }

        if (maxDistSq > epsilonSq) {
            keep[maxIndex] = 1;

            stackStart[stackSize] = start;
            stackEnd[stackSize] = maxIndex;
            ++stackSize;

            stackStart[stackSize] = maxIndex;
            stackEnd[stackSize] = end;
            ++stackSize;
        }
    }

    return keep;
}

/* =========================================================
 * Self intersections
 * ========================================================= */

function resolveClosedContourSelfIntersections(
    contour: Uint16Array,
    kept: number[],
    epsilon: number,
): void {
    const pointCount = contour.length >> 1;
    const epsilonSq = epsilon * epsilon;

    for (let pass = 0; pass < pointCount * 2; ++pass) {
        const intersection = findFirstSelfIntersection(contour, kept);

        if (intersection === null) {
            return;
        }

        const edgeA = intersection.edgeA;
        const edgeB = intersection.edgeB;

        const a0 = kept[edgeA];
        const a1 = kept[(edgeA + 1) % kept.length];
        const b0 = kept[edgeB];
        const b1 = kept[(edgeB + 1) % kept.length];

        const candA = findWorstPointOnClosedArc(contour, a0, a1);
        const candB = findWorstPointOnClosedArc(contour, b0, b1);

        const canInsertA = candA.pointIndex >= 0 && candA.distSq > 0;
        const canInsertB = candB.pointIndex >= 0 && candB.distSq > 0;

        if (!canInsertA && !canInsertB) {
            return;
        }

        if (canInsertA && (!canInsertB || candA.distSq >= candB.distSq)) {
            insertPointIntoKeptAfterEdge(kept, edgeA, candA.pointIndex);
        } else {
            insertPointIntoKeptAfterEdge(kept, edgeB, candB.pointIndex);
        }

        cleanupRedundantVertices(contour, kept, epsilonSq);
    }
}

function findFirstSelfIntersection(
    contour: Uint16Array,
    kept: number[],
): { edgeA: number; edgeB: number } | null {
    const edgeCount = kept.length;

    for (let edgeA = 0; edgeA < edgeCount; ++edgeA) {
        const a0 = kept[edgeA];
        const a1 = kept[(edgeA + 1) % edgeCount];

        const a0x = getX(contour, a0);
        const a0y = getY(contour, a0);
        const a1x = getX(contour, a1);
        const a1y = getY(contour, a1);

        for (let edgeB = edgeA + 1; edgeB < edgeCount; ++edgeB) {
            if (isArcAdjacent(edgeA, edgeB, edgeCount)) {
                continue;
            }

            const b0 = kept[edgeB];
            const b1 = kept[(edgeB + 1) % edgeCount];

            if (
                isSamePointByIndex(contour, a0, b0) ||
                isSamePointByIndex(contour, a0, b1) ||
                isSamePointByIndex(contour, a1, b0) ||
                isSamePointByIndex(contour, a1, b1)
            ) {
                continue;
            }

            const b0x = getX(contour, b0);
            const b0y = getY(contour, b0);
            const b1x = getX(contour, b1);
            const b1y = getY(contour, b1);

            if (
                segmentsIntersect(
                    a0x, a0y, a1x, a1y,
                    b0x, b0y, b1x, b1y,
                )
            ) {
                return { edgeA, edgeB };
            }
        }
    }

    return null;
}

function findWorstPointOnClosedArc(
    contour: Uint16Array,
    startIndex: number,
    endIndex: number,
): { pointIndex: number; distSq: number } {
    const pointCount = contour.length >> 1;

    let current = (startIndex + 1) % pointCount;
    let maxDistSq = -1;
    let maxPointIndex = -1;

    while (current !== endIndex) {
        const distSq = pointLineDistanceSqByIndex(contour, current, startIndex, endIndex);

        if (distSq > maxDistSq) {
            maxDistSq = distSq;
            maxPointIndex = current;
        }

        current = (current + 1) % pointCount;
    }

    return { pointIndex: maxPointIndex, distSq: maxDistSq };
}

function insertPointIntoKeptAfterEdge(
    kept: number[],
    edgeIndex: number,
    pointIndex: number,
): void {
    for (let i = 0; i < kept.length; ++i) {
        if (kept[i] === pointIndex) {
            return;
        }
    }

    kept.splice(edgeIndex + 1, 0, pointIndex);
}

function cleanupRedundantVertices(
    contour: Uint16Array,
    kept: number[],
    epsilonSq: number,
): void {
    if (kept.length <= 3) {
        return;
    }

    let changed = true;

    while (changed && kept.length > 3) {
        changed = false;

        for (let i = 0; i < kept.length; ++i) {
            const prevPos = (i - 1 + kept.length) % kept.length;
            const nextPos = (i + 1) % kept.length;

            const prev = kept[prevPos];
            const curr = kept[i];
            const next = kept[nextPos];

            void curr;

            if (!closedArcFitsEpsilon(contour, prev, next, epsilonSq)) {
                continue;
            }

            const removed = kept.splice(i, 1)[0];

            if (hasSelfIntersection(contour, kept)) {
                kept.splice(i, 0, removed);
                continue;
            }

            changed = true;
            break;
        }
    }
}

function closedArcFitsEpsilon(
    contour: Uint16Array,
    startIndex: number,
    endIndex: number,
    epsilonSq: number,
): boolean {
    const pointCount = contour.length >> 1;
    let current = (startIndex + 1) % pointCount;

    while (current !== endIndex) {
        const distSq = pointLineDistanceSqByIndex(contour, current, startIndex, endIndex);

        if (distSq > epsilonSq) {
            return false;
        }

        current = (current + 1) % pointCount;
    }

    return true;
}

function hasSelfIntersection(
    contour: Uint16Array,
    kept: number[],
): boolean {
    return findFirstSelfIntersection(contour, kept) !== null;
}

/* =========================================================
 * Materialization
 * ========================================================= */

function materializeContour(
    contour: Uint16Array,
    kept: number[],
): Uint16Array {
    const out = new Uint16Array(kept.length << 1);

    for (let i = 0; i < kept.length; ++i) {
        const p = kept[i];
        const j = i << 1;

        out[j] = getX(contour, p);
        out[j + 1] = getY(contour, p);
    }

    return out;
}