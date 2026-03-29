import { vi, beforeEach } from 'vitest';
import {
  createBackgroundPatern,
  drawTransparentPixelsOverlay,
  drawContourOverlay,
  drawContoursOverlay,
  drawPolygonDebug,
  drawPolygonsDebug,
  drawTriangulation,
} from '../helpers';

function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(10000) }),
  };
}

// ---------------------------------------------------------------------------
// createBackgroundPatern
// ---------------------------------------------------------------------------
describe('createBackgroundPatern', () => {
  it('returns an OffscreenCanvas with width=128, height=128', () => {
    const result = createBackgroundPatern();
    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
  });

  it('calls fillRect 3 times to produce a checkerboard background', () => {
    const mockFillRect = vi.fn();
    const mockGetContext = vi.spyOn(
      (global as any).OffscreenCanvas.prototype,
      'getContext',
    ).mockReturnValue({ fillStyle: '', fillRect: mockFillRect });

    try {
      createBackgroundPatern();
      // 1× full background fill + 2× checkerboard quadrant fills
      expect(mockFillRect).toHaveBeenCalledTimes(3);
    } finally {
      mockGetContext.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// drawTransparentPixelsOverlay
// ---------------------------------------------------------------------------
describe('drawTransparentPixelsOverlay', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it('returns early without calling ctx methods when scale <= 0', () => {
    const bits = new Uint8Array(10);
    drawTransparentPixelsOverlay(ctx as any, bits, 5, 5, { offsetX: 0, offsetY: 0, scale: 0 });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('returns early when drawW <= 0 due to large padding', () => {
    const bits = new Uint8Array(10);
    drawTransparentPixelsOverlay(ctx as any, bits, 4, 4, { offsetX: 0, offsetY: 0, scale: 1, padding: 3 });
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('calls ctx.drawImage once with valid options', () => {
    const bits = new Uint8Array(Math.ceil(10 * 10 / 8));
    drawTransparentPixelsOverlay(ctx as any, bits, 10, 10, { offsetX: 5, offsetY: 5, scale: 2 });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 5, 5);
  });
});

// ---------------------------------------------------------------------------
// drawContourOverlay
// ---------------------------------------------------------------------------
describe('drawContourOverlay', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it('returns early when scale <= 0', () => {
    const contour = new Uint16Array([0, 0, 10, 10]);
    drawContourOverlay(ctx as any, contour, { offsetX: 0, offsetY: 0, scale: 0 });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('returns early when contour.length < 4', () => {
    const contour = new Uint16Array([0, 0]);
    drawContourOverlay(ctx as any, contour, { offsetX: 0, offsetY: 0, scale: 1 });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('calls save/translate/beginPath/moveTo/lineTo/closePath/fill/stroke/restore for a valid contour', () => {
    const contour = new Uint16Array([0, 0, 10, 0, 10, 10, 0, 10]);
    drawContourOverlay(ctx as any, contour, { offsetX: 2, offsetY: 3, scale: 1 });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.translate).toHaveBeenCalledWith(2, 3);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// drawContoursOverlay
// ---------------------------------------------------------------------------
describe('drawContoursOverlay', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it('does not call any ctx methods when the contours array is empty', () => {
    drawContoursOverlay(ctx as any, [], { offsetX: 0, offsetY: 0, scale: 1 });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('calls save/restore once per contour', () => {
    const contour = new Uint16Array([0, 0, 10, 0, 10, 10]);
    drawContoursOverlay(ctx as any, [contour, contour], { offsetX: 0, offsetY: 0, scale: 1 });
    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// drawPolygonDebug
// ---------------------------------------------------------------------------
describe('drawPolygonDebug', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it('returns early when poly.length < 4', () => {
    const poly = new Uint16Array([0, 0]);
    drawPolygonDebug(ctx as any, poly, { offsetX: 0, offsetY: 0 });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('calls save/beginPath/fill/stroke/fillRect/restore for a valid polygon', () => {
    const poly = new Uint16Array([0, 0, 10, 0, 10, 10, 0, 10]);
    drawPolygonDebug(ctx as any, poly, { offsetX: 0, offsetY: 0 });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// drawPolygonsDebug
// ---------------------------------------------------------------------------
describe('drawPolygonsDebug', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it('does not call any ctx methods for an empty polygons array', () => {
    drawPolygonsDebug(ctx as any, [], { offsetX: 0, offsetY: 0 });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('calls save/restore once per polygon', () => {
    const poly = new Uint16Array([0, 0, 10, 0, 10, 10, 0, 10]);
    drawPolygonsDebug(ctx as any, [poly, poly], { offsetX: 0, offsetY: 0 });
    expect(ctx.save).toHaveBeenCalledTimes(2);
    expect(ctx.restore).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// drawTriangulation
// ---------------------------------------------------------------------------
describe('drawTriangulation', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it('restores strokeStyle, fillStyle and globalAlpha after drawing', () => {
    ctx.strokeStyle = 'blue';
    ctx.fillStyle = 'green';
    ctx.globalAlpha = 0.5;

    const polygon = new Uint16Array([0, 0, 10, 0, 0, 10]);
    const indices = new Uint16Array([0, 1, 2]);
    drawTriangulation(ctx as any, polygon, indices, 'red', 0, 0, 1);

    expect(ctx.strokeStyle).toBe('blue');
    expect(ctx.fillStyle).toBe('green');
    expect(ctx.globalAlpha).toBe(0.5);
  });

  it('calls beginPath once per triangle (indices.length / 3 times)', () => {
    const polygon = new Uint16Array([0, 0, 10, 0, 0, 10, 10, 10]);
    const indices = new Uint16Array([0, 1, 2, 1, 2, 3]); // 2 triangles
    drawTriangulation(ctx as any, polygon, indices, 'red', 0, 0, 1);

    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
  });

  it('calls moveTo, lineTo, closePath, fill and stroke for each triangle', () => {
    const polygon = new Uint16Array([0, 0, 10, 0, 0, 10]);
    const indices = new Uint16Array([0, 1, 2]);
    drawTriangulation(ctx as any, polygon, indices, 'rgba(255,0,0,1)', 5, 5, 2);

    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
