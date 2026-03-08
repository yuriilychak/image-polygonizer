import { getX, getY, normalizeClosedContour, clampUint16, orientRaw, pointBetween, pointOnSegment, segmentsIntersect } from './helpers';

export function refineCoveringContourBySlidingEdgesGreedy(
    originalContour: Uint16Array,
    coveringContour: Uint16Array,
): Uint16Array {
    const witnesses = reduceCollinearClosedContour(originalContour);
    const cover = normalizeClosedContour(coveringContour);

    const count = cover.length >> 1;

    if (count <= 3) {
        return cover;
    }

    const points = new Int32Array(cover.length);

    for (let i = 0; i < cover.length; ++i) {
        points[i] = cover[i];
    }

    let improved = true;

    while (improved) {
        improved = false;

        const vertexCount = points.length >> 1;

        for (let edgeStart = 0; edgeStart < vertexCount; ++edgeStart) {
            const changed = improveSlidingEdgeGreedy(points, edgeStart, witnesses);

            if (changed) {
                improved = true;
            }
        }
    }

    const out = new Uint16Array(points.length);

    for (let i = 0; i < points.length; ++i) {
        out[i] = clampUint16(points[i]);
    }

    return out;
}

/* =========================================================
 * Greedy improvement of one edge
 * ========================================================= */

function improveSlidingEdgeGreedy(
    polygon: Int32Array,
    edgeStart: number,
    witnesses: Uint16Array,
): boolean {
    const count = polygon.length >> 1;

    if (count < 4) {
        return false;
    }

    const i0 = mod(edgeStart - 1, count);
    const i1 = edgeStart;
    const i2 = mod(edgeStart + 1, count);
    const i3 = mod(edgeStart + 2, count);

    const dirA = primitiveDirection(
        getX(polygon, i1) - getX(polygon, i0),
        getY(polygon, i1) - getY(polygon, i0),
    );

    const dirB = primitiveDirection(
        getX(polygon, i2) - getX(polygon, i3),
        getY(polygon, i2) - getY(polygon, i3),
    );

    if ((dirA.dx === 0 && dirA.dy === 0) || (dirB.dx === 0 && dirB.dy === 0)) {
        return false;
    }

    const stepPairs: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
    ];

    let anyImproved = false;

    while (true) {
        const currentArea = Math.abs(polygonSignedAreaInt(polygon));

        let bestArea = currentArea;
        let bestStepA = 0;
        let bestStepB = 0;
        let found = false;

        const oldAx = getX(polygon, i1);
        const oldAy = getY(polygon, i1);
        const oldBx = getX(polygon, i2);
        const oldBy = getY(polygon, i2);

        for (let k = 0; k < stepPairs.length; ++k) {
            const [stepA, stepB] = stepPairs[k];

            const ax = oldAx + dirA.dx * stepA;
            const ay = oldAy + dirA.dy * stepA;
            const bx = oldBx + dirB.dx * stepB;
            const by = oldBy + dirB.dy * stepB;

            if (ax === bx && ay === by) {
                continue;
            }

            setVertex(polygon, i1, ax, ay);
            setVertex(polygon, i2, bx, by);

            if (hasDegenerateLocalEdgesForSliding(polygon, i0, i1, i2, i3)) {
                setVertex(polygon, i1, oldAx, oldAy);
                setVertex(polygon, i2, oldBx, oldBy);
                continue;
            }

            if (wouldCreateSelfIntersectionAfterSlidingEdge(polygon, i1, i2)) {
                setVertex(polygon, i1, oldAx, oldAy);
                setVertex(polygon, i2, oldBx, oldBy);
                continue;
            }

            const area = Math.abs(polygonSignedAreaInt(polygon));

            if (area < bestArea) {
                const bbox = buildLocalBBoxForSlidingEdgeTransition(
                    polygon,
                    oldAx,
                    oldAy,
                    oldBx,
                    oldBy,
                    ax,
                    ay,
                    bx,
                    by,
                    i0,
                    i3,
                );

                if (allWitnessesInsideLocal(polygon, witnesses, bbox)) {
                    bestArea = area;
                    bestStepA = stepA;
                    bestStepB = stepB;
                    found = true;
                }
            }

            setVertex(polygon, i1, oldAx, oldAy);
            setVertex(polygon, i2, oldBx, oldBy);
        }

        if (!found) {
            return anyImproved;
        }

        let moved = false;

        while (true) {
            const curAx = getX(polygon, i1);
            const curAy = getY(polygon, i1);
            const curBx = getX(polygon, i2);
            const curBy = getY(polygon, i2);

            const nextAx = curAx + dirA.dx * bestStepA;
            const nextAy = curAy + dirA.dy * bestStepA;
            const nextBx = curBx + dirB.dx * bestStepB;
            const nextBy = curBy + dirB.dy * bestStepB;

            if (nextAx === nextBx && nextAy === nextBy) {
                break;
            }

            const areaBefore = Math.abs(polygonSignedAreaInt(polygon));

            setVertex(polygon, i1, nextAx, nextAy);
            setVertex(polygon, i2, nextBx, nextBy);

            if (hasDegenerateLocalEdgesForSliding(polygon, i0, i1, i2, i3)) {
                setVertex(polygon, i1, curAx, curAy);
                setVertex(polygon, i2, curBx, curBy);
                break;
            }

            if (wouldCreateSelfIntersectionAfterSlidingEdge(polygon, i1, i2)) {
                setVertex(polygon, i1, curAx, curAy);
                setVertex(polygon, i2, curBx, curBy);
                break;
            }

            const bbox = buildLocalBBoxForSlidingEdgeTransition(
                polygon,
                curAx,
                curAy,
                curBx,
                curBy,
                nextAx,
                nextAy,
                nextBx,
                nextBy,
                i0,
                i3,
            );

            if (!allWitnessesInsideLocal(polygon, witnesses, bbox)) {
                setVertex(polygon, i1, curAx, curAy);
                setVertex(polygon, i2, curBx, curBy);
                break;
            }

            const areaAfter = Math.abs(polygonSignedAreaInt(polygon));

            if (areaAfter >= areaBefore) {
                setVertex(polygon, i1, curAx, curAy);
                setVertex(polygon, i2, curBx, curBy);
                break;
            }

            moved = true;
            anyImproved = true;
        }

        if (!moved) {
            return anyImproved;
        }
    }
}

/* =========================================================
 * Primitive integer direction
 * ========================================================= */

function primitiveDirection(
    dx: number,
    dy: number,
): { dx: number; dy: number } {
    if (dx === 0 && dy === 0) {
        return { dx: 0, dy: 0 };
    }

    const g = gcd(Math.abs(dx), Math.abs(dy));

    return {
        dx: dx / g,
        dy: dy / g,
    };
}

function gcd(a: number, b: number): number {
    while (b !== 0) {
        const t = a % b;
        a = b;
        b = t;
    }

    return a === 0 ? 1 : a;
}

/* =========================================================
 * Local bbox
 * We change only vertices i and i+1, but to be safe we include
 * i-1 and i+2 and both old/new positions of moved vertices.
 * ========================================================= */

interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

function buildLocalBBoxForSlidingEdgeTransition(
    polygon: Int32Array,
    oldAx: number,
    oldAy: number,
    oldBx: number,
    oldBy: number,
    newAx: number,
    newAy: number,
    newBx: number,
    newBy: number,
    i0: number,
    i3: number,
): BBox {
    let minX = getX(polygon, i0);
    let maxX = minX;
    let minY = getY(polygon, i0);
    let maxY = minY;

    includePoint(oldAx, oldAy);
    includePoint(oldBx, oldBy);
    includePoint(newAx, newAy);
    includePoint(newBx, newBy);
    includePoint(getX(polygon, i3), getY(polygon, i3));

    const padding = 2;

    return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
    };

    function includePoint(x: number, y: number): void {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
}

function pointInBBox(
    x: number,
    y: number,
    bbox: BBox,
): boolean {
    return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

/* =========================================================
 * Local witness containment
 * ========================================================= */

function allWitnessesInsideLocal(
    polygon: Int32Array,
    witnesses: Uint16Array,
    bbox: BBox,
): boolean {
    const count = witnesses.length >> 1;

    for (let i = 0; i < count; ++i) {
        const x = getX(witnesses, i);
        const y = getY(witnesses, i);

        if (!pointInBBox(x, y, bbox)) {
            continue;
        }

        if (!pointInPolygonOrOnEdgeInt(polygon, x, y)) {
            return false;
        }
    }

    return true;
}

function pointInPolygonOrOnEdgeInt(
    polygon: Int32Array,
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
 * Self-intersection after sliding edge
 * Changed edges:
 * [i-1,i], [i,i+1], [i+1,i+2]
 * ========================================================= */

function wouldCreateSelfIntersectionAfterSlidingEdge(
    polygon: Int32Array,
    i1: number,
    i2: number,
): boolean {
    const count = polygon.length >> 1;

    const changedEdges: Array<[number, number]> = [
        [mod(i1 - 1, count), i1],
        [i1, i2],
        [i2, mod(i2 + 1, count)],
    ];

    for (let k = 0; k < changedEdges.length; ++k) {
        const [a, b] = changedEdges[k];

        const a0x = getX(polygon, a);
        const a0y = getY(polygon, a);
        const a1x = getX(polygon, b);
        const a1y = getY(polygon, b);

        for (let i = 0; i < count; ++i) {
            const j = (i + 1) % count;

            if (sharesEndpoint(a, b, i, j)) {
                continue;
            }

            if (edgeIsInChangedSet(i, j, changedEdges)) {
                continue;
            }

            const b0x = getX(polygon, i);
            const b0y = getY(polygon, i);
            const b1x = getX(polygon, j);
            const b1y = getY(polygon, j);

            if (segmentsIntersect(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y)) {
                return true;
            }
        }
    }

    for (let i = 0; i < changedEdges.length; ++i) {
        const [a0, a1] = changedEdges[i];
        const x1 = getX(polygon, a0);
        const y1 = getY(polygon, a0);
        const x2 = getX(polygon, a1);
        const y2 = getY(polygon, a1);

        for (let j = i + 1; j < changedEdges.length; ++j) {
            const [b0, b1] = changedEdges[j];

            if (sharesEndpoint(a0, a1, b0, b1)) {
                continue;
            }

            const x3 = getX(polygon, b0);
            const y3 = getY(polygon, b0);
            const x4 = getX(polygon, b1);
            const y4 = getY(polygon, b1);

            if (segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4)) {
                return true;
            }
        }
    }

    return false;
}

function hasDegenerateLocalEdgesForSliding(
    polygon: Int32Array,
    i0: number,
    i1: number,
    i2: number,
    i3: number,
): boolean {
    return (
        sameVertex(polygon, i0, i1) ||
        sameVertex(polygon, i1, i2) ||
        sameVertex(polygon, i2, i3)
    );
}

function edgeIsInChangedSet(
    a: number,
    b: number,
    changedEdges: Array<[number, number]>,
): boolean {
    for (let i = 0; i < changedEdges.length; ++i) {
        if (changedEdges[i][0] === a && changedEdges[i][1] === b) {
            return true;
        }
    }

    return false;
}

function sharesEndpoint(
    a0: number,
    a1: number,
    b0: number,
    b1: number,
): boolean {
    return a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1;
}

function sameVertex(
    polygon: Int32Array,
    a: number,
    b: number,
): boolean {
    return getX(polygon, a) === getX(polygon, b) &&
        getY(polygon, a) === getY(polygon, b);
}

/* =========================================================
 * Witness reduction
 * ========================================================= */

export function reduceCollinearClosedContour(
    contour: Uint16Array,
): Uint16Array {
    const normalized = normalizeClosedContour(contour);
    const count = normalized.length >> 1;

    if (count <= 3) {
        return normalized;
    }

    const keep = new Uint8Array(count);
    let keptCount = 0;

    for (let i = 0; i < count; ++i) {
        const prev = mod(i - 1, count);
        const next = mod(i + 1, count);

        const ax = getX(normalized, prev);
        const ay = getY(normalized, prev);
        const bx = getX(normalized, i);
        const by = getY(normalized, i);
        const cx = getX(normalized, next);
        const cy = getY(normalized, next);

        const cross = orientRaw(ax, ay, bx, by, cx, cy);

        if (cross !== 0 || !pointBetween(ax, ay, cx, cy, bx, by)) {
            keep[i] = 1;
            ++keptCount;
        }
    }

    if (keptCount < 3) {
        return normalized;
    }

    const out = new Uint16Array(keptCount << 1);
    let w = 0;

    for (let i = 0; i < count; ++i) {
        if (keep[i] !== 0) {
            out[w] = getX(normalized, i);
            out[w + 1] = getY(normalized, i);
            w += 2;
        }
    }

    return out;
}

/* =========================================================
 * Basic helpers
 * ========================================================= */

function setVertex(
    polygon: Int32Array,
    index: number,
    x: number,
    y: number,
): void {
    polygon[index << 1] = x;
    polygon[(index << 1) + 1] = y;
}

function mod(a: number, n: number): number {
    const r = a % n;
    return r < 0 ? r + n : r;
}

function polygonSignedAreaInt(points: Int32Array): number {
    const count = points.length >> 1;
    let sum = 0;

    for (let i = 0; i < count; ++i) {
        const j = (i + 1) % count;

        const xi = getX(points, i);
        const yi = getY(points, i);
        const xj = getX(points, j);
        const yj = getY(points, j);

        sum += xi * yj - xj * yi;
    }

    return sum * 0.5;
}

