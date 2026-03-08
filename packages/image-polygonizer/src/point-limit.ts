import {
    getX,
    getY,
    normalizeClosedContour,
    cross2,
    createLinkedState,
    removeVertex,
    findFirstAlive,
    materializeState,
    wouldCreateSelfIntersectionAfterRemoval,
    polygonSignedAreaByState,
} from './helpers';

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

