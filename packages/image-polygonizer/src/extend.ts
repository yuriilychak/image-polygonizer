import { getX, getY, normalizeClosedContour, polygonSignedArea, clampUint16 } from './helpers';

export function extendSimplifiedContourToCoverOriginal(
    originalContour: Uint16Array,
    simplifiedContour: Uint16Array,
): Uint16Array {
    const original = normalizeClosedContour(originalContour);
    const simplified = normalizeClosedContour(simplifiedContour);

    const originalCount = original.length >> 1;
    const simplifiedCount = simplified.length >> 1;

    if (originalCount < 3 || simplifiedCount < 3) {
        return simplified.slice();
    }

    const orientation = polygonSignedArea(simplified) >= 0 ? 1 : -1;
    const originalIndices = mapSimplifiedToOriginalIndicesOrdered(original, simplified);
    const lines = new Array<Line>(simplifiedCount);

    for (let i = 0; i < simplifiedCount; ++i) {
        const j = (i + 1) % simplifiedCount;

        const ax = getX(simplified, i);
        const ay = getY(simplified, i);
        const bx = getX(simplified, j);
        const by = getY(simplified, j);

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);

        if (len === 0) {
            throw new Error(`Degenerate simplified edge at index ${i}`);
        }

        let nx: number;
        let ny: number;

        // Use the old normal logic
        if (orientation > 0) {
            nx = dy / len;
            ny = -dx / len;
        } else {
            nx = -dy / len;
            ny = dx / len;
        }

        const c0 = -(nx * ax + ny * ay);

        const startIndex = originalIndices[i];
        const endIndex = originalIndices[j];

        const delta = computeArcMaxOffset(
            original,
            originalCount,
            startIndex,
            endIndex,
            nx,
            ny,
            c0,
        );

        lines[i] = {
            a: nx,
            b: ny,
            c: c0 - delta,
        };
    }

    const out = new Uint16Array(simplifiedCount << 1);

    for (let i = 0; i < simplifiedCount; ++i) {
        const prev = (i - 1 + simplifiedCount) % simplifiedCount;

        const lineA = lines[prev];
        const lineB = lines[i];

        const intersection = intersectLines(lineA, lineB);

        let x: number;
        let y: number;

        if (intersection !== null) {
            const snapped = snapIntersectionConservative(
                intersection.x,
                intersection.y,
                lineA,
                lineB,
            );

            x = snapped.x;
            y = snapped.y;
        } else {
            const sx = getX(simplified, i);
            const sy = getY(simplified, i);

            const snapped = snapIntersectionConservative(
                sx,
                sy,
                lineA,
                lineB,
            );

            x = snapped.x;
            y = snapped.y;
        }

        out[i << 1] = clampUint16(x);
        out[(i << 1) + 1] = clampUint16(y);
    }

    return out;
}

/* =========================================================
 * Types
 * ========================================================= */

interface Line {
    a: number;
    b: number;
    c: number;
}

/* =========================================================
 * Correct cyclic mapping
 * This is the actual fix for the "last line" problem.
 * ========================================================= */

function mapSimplifiedToOriginalIndicesOrdered(
    originalContour: Uint16Array,
    simplifiedContour: Uint16Array,
): Uint32Array {
    const originalCount = originalContour.length >> 1;
    const simplifiedCount = simplifiedContour.length >> 1;

    const matches: number[][] = new Array(simplifiedCount);

    for (let i = 0; i < simplifiedCount; ++i) {
        const sx = getX(simplifiedContour, i);
        const sy = getY(simplifiedContour, i);

        const list: number[] = [];

        for (let j = 0; j < originalCount; ++j) {
            if (getX(originalContour, j) === sx && getY(originalContour, j) === sy) {
                list.push(j);
            }
        }

        if (list.length === 0) {
            throw new Error(
                `Simplified point (${sx}, ${sy}) was not found in original contour`,
            );
        }

        matches[i] = list;
    }

    const result = new Uint32Array(simplifiedCount);

    for (let startCandidateIdx = 0; startCandidateIdx < matches[0].length; ++startCandidateIdx) {
        const start = matches[0][startCandidateIdx];
        result[0] = start;

        let prev = start;
        let ok = true;

        for (let i = 1; i < simplifiedCount; ++i) {
            const candidates = matches[i];

            let bestIndex = -1;
            let bestForward = originalCount + 1;

            for (let k = 0; k < candidates.length; ++k) {
                const idx = candidates[k];
                const forward = idx > prev ? idx - prev : idx + originalCount - prev;

                if (forward > 0 && forward < bestForward) {
                    bestForward = forward;
                    bestIndex = idx;
                }
            }

            if (bestIndex < 0) {
                ok = false;
                break;
            }

            result[i] = bestIndex;
            prev = bestIndex;
        }

        if (!ok) {
            continue;
        }

        const closeForward = start > prev ? start - prev : start + originalCount - prev;

        if (closeForward <= 0) {
            continue;
        }

        return result;
    }

    throw new Error("Failed to map simplified contour to original contour in cyclic order");
}

/* =========================================================
 * Arc offset for one simplified edge
 * ========================================================= */

function computeArcMaxOffset(
    original: Uint16Array,
    originalCount: number,
    startIndex: number,
    endIndex: number,
    nx: number,
    ny: number,
    c0: number,
): number {
    let delta = 0;
    let k = startIndex;
    let guard = 0;

    while (true) {
        const px = getX(original, k);
        const py = getY(original, k);
        const value = nx * px + ny * py + c0;

        if (value > delta) {
            delta = value;
        }

        if (k === endIndex) {
            break;
        }

        k = (k + 1) % originalCount;

        ++guard;
        if (guard > originalCount) {
            throw new Error("Arc traversal overflow");
        }
    }

    return delta;
}

/* =========================================================
 * Line intersection
 * ========================================================= */

function intersectLines(l1: Line, l2: Line): { x: number; y: number } | null {
    const det = l1.a * l2.b - l2.a * l1.b;

    if (Math.abs(det) < 1e-12) {
        return null;
    }

    const x = (l1.b * l2.c - l2.b * l1.c) / det;
    const y = (l2.a * l1.c - l1.a * l2.c) / det;

    return { x, y };
}

/* =========================================================
 * Conservative snap
 * ========================================================= */

function snapIntersectionConservative(
    fx: number,
    fy: number,
    lineA: Line,
    lineB: Line,
): { x: number; y: number } {
    const cx = Math.round(fx);
    const cy = Math.round(fy);

    let bestX = cx;
    let bestY = cy;
    let bestDistSq = Number.POSITIVE_INFINITY;

    for (let radius = 0; radius <= 16; ++radius) {
        let found = false;

        for (let dy = -radius; dy <= radius; ++dy) {
            for (let dx = -radius; dx <= radius; ++dx) {
                const x = cx + dx;
                const y = cy + dy;

                if (
                    lineA.a * x + lineA.b * y + lineA.c <= 1e-9 &&
                    lineB.a * x + lineB.b * y + lineB.c <= 1e-9
                ) {
                    const distSq = (x - fx) * (x - fx) + (y - fy) * (y - fy);

                    if (distSq < bestDistSq) {
                        bestDistSq = distSq;
                        bestX = x;
                        bestY = y;
                        found = true;
                    }
                }
            }
        }

        if (found) {
            return { x: bestX, y: bestY };
        }
    }

    const nx = lineA.a + lineB.a;
    const ny = lineA.b + lineB.b;
    const len = Math.hypot(nx, ny);

    if (len > 1e-12) {
        const ux = nx / len;
        const uy = ny / len;

        for (let t = 0; t <= 64; ++t) {
            const x = Math.round(fx + ux * t);
            const y = Math.round(fy + uy * t);

            if (
                lineA.a * x + lineA.b * y + lineA.c <= 1e-9 &&
                lineB.a * x + lineB.b * y + lineB.c <= 1e-9
            ) {
                return { x, y };
            }
        }
    }

    return { x: cx, y: cy };
}