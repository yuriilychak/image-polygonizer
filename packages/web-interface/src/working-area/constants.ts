import type { DrawItem } from "../types";

export const DRAW_ITEMS_TO_CHAR: Record<DrawItem, string> = {
    alpha: 'A',
    contour: '□',
    polygon: '◇',
    triangles: '△'
};