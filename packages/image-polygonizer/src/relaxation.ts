import { simplifyClosedPixelContourRDPNoSelfIntersections } from './rdp';
import {
    getX,
    getY,
    normalizeClosedContour,
    cross2,
    createLinkedState,
    findFirstAlive,
    wouldCreateSelfIntersectionAfterRemoval,
    removeVertex,
    materializeState,
    polygonSignedAreaByState,
} from './helpers';

export function iterativeRelaxAndSimplifyClosedContourFast(
    contour: Uint16Array,
    percentage: number,
    angleDeg: number,
    holeAngle: number,
    pickAngle: number,
    epsilon: number,
): Uint16Array {
    let current = normalizeClosedContour(contour);

    if ((current.length >> 1) <= 3) {
        return current;
    }

    let previousCount = -1;

    while (true) {
        const currentCount = current.length >> 1;

        if (currentCount === previousCount) {
            return current;
        }

        previousCount = currentCount;

        current = removeSmallPitsFast(current, percentage, holeAngle);
        current = removeObtuseHumpsFast(current, percentage, angleDeg, pickAngle);
        current = simplifyClosedPixelContourRDPNoSelfIntersections(current, epsilon);

        if ((current.length >> 1) <= 3) {
            return current;
        }
    }
}

/* =========================================================
 * 1. Fast removal of pits
 * Criteria:
 * - pit area <= percentage * totalArea
 * - or pit angle > holeAngle
 * ========================================================= */

export function removeSmallPitsFast(
    contour: Uint16Array,
    percentage: number,
    holeAngle: number,
): Uint16Array {
    const normalized = normalizeClosedContour(contour);
    const pointCount = normalized.length >> 1;

    if (pointCount <= 3) {
        return normalized;
    }

    const state = createLinkedState(normalized);
    const signedArea = polygonSignedAreaByState(state);
    const totalArea = Math.abs(signedArea);

    if (totalArea === 0) {
        return normalized;
    }

    const thresholdArea = totalArea * percentage;
    const orientationSign = signedArea >= 0 ? 1 : -1;
    const holeAngleRad = (holeAngle * Math.PI) / 180;

    let changed = true;

    while (changed && state.activeCount > 3) {
        changed = false;

        let i = findFirstAlive(state.alive);

        if (i < 0) {
            break;
        }

        let visited = 0;
        const limit = state.activeCount;

        while (visited < limit && state.activeCount > 3) {
            const curr = i;
            i = state.next[curr];
            ++visited;

            if (state.alive[curr] === 0) {
                continue;
            }

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

            if (!isConcave) {
                continue;
            }

            const pitArea = Math.abs(cross) * 0.5;
            const interiorAngle = interiorAngleRad(ax, ay, bx, by, cx, cy, orientationSign);

            const removeByArea = pitArea <= thresholdArea;
            const removeByAngle = interiorAngle > holeAngleRad;

            if (!removeByArea && !removeByAngle) {
                continue;
            }

            if (wouldCreateSelfIntersectionAfterRemoval(state, curr)) {
                continue;
            }

            removeVertex(state, curr);
            changed = true;
        }
    }

    return materializeState(state);
}

/* =========================================================
 * 2. Fast removal of humps
 * Criteria:
 * - hump angle > angleDeg
 * - or hump area <= percentage * totalArea if angle > pickAngle
 * ========================================================= */

export function removeObtuseHumpsFast(
    contour: Uint16Array,
    percentage: number,
    angleDeg: number,
    pickAngle: number,
): Uint16Array {
    const normalized = normalizeClosedContour(contour);
    const pointCount = normalized.length >> 1;

    if (pointCount <= 3) {
        return normalized;
    }

    const state = createLinkedState(normalized);
    const signedArea = polygonSignedAreaByState(state);
    const totalArea = Math.abs(signedArea);

    if (totalArea === 0) {
        return normalized;
    }

    const thresholdArea = totalArea * percentage;
    const orientationSign = signedArea >= 0 ? 1 : -1;
    const angleThresholdRad = (angleDeg * Math.PI) / 180;
    const pickAngleRad = (pickAngle * Math.PI) / 180;

    let changed = true;

    while (changed && state.activeCount > 3) {
        changed = false;

        let i = findFirstAlive(state.alive);

        if (i < 0) {
            break;
        }

        let visited = 0;
        const limit = state.activeCount;

        while (visited < limit && state.activeCount > 3) {
            const curr = i;
            i = state.next[curr];
            ++visited;

            if (state.alive[curr] === 0) {
                continue;
            }

            const prev = state.prev[curr];
            const next = state.next[curr];

            const ax = getX(state.points, prev);
            const ay = getY(state.points, prev);
            const bx = getX(state.points, curr);
            const by = getY(state.points, curr);
            const cx = getX(state.points, next);
            const cy = getY(state.points, next);

            const cross = cross2(ax, ay, bx, by, cx, cy);
            const isConvex = orientationSign > 0 ? cross > 0 : cross < 0;

            if (!isConvex) {
                continue;
            }

            const humpArea = Math.abs(cross) * 0.5;
            const interiorAngle = interiorAngleRad(ax, ay, bx, by, cx, cy, orientationSign);

            const removeByAngle = interiorAngle > angleThresholdRad;
            const removeByArea = interiorAngle > pickAngleRad && humpArea <= thresholdArea;

            if (!removeByAngle && !removeByArea) {
                continue;
            }

            if (wouldCreateSelfIntersectionAfterRemoval(state, curr)) {
                continue;
            }

            removeVertex(state, curr);
            changed = true;
        }
    }

    return materializeState(state);
}

function interiorAngleRad(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    orientationSign: number,
): number {
    const v1x = ax - bx;
    const v1y = ay - by;
    const v2x = cx - bx;
    const v2y = cy - by;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 === 0 || len2 === 0) {
        return 0;
    }

    let cos = (v1x * v2x + v1y * v2y) / (len1 * len2);

    if (cos > 1) cos = 1;
    else if (cos < -1) cos = -1;

    const smallAngle = Math.acos(cos);
    const cross = cross2(ax, ay, bx, by, cx, cy);
    const isConvex = orientationSign > 0 ? cross > 0 : cross < 0;

    return isConvex ? smallAngle : 2 * Math.PI - smallAngle;
}