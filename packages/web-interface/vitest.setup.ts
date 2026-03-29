import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

afterEach(() => {
    vi.clearAllMocks();
});

// OffscreenCanvas
class MockOffscreenCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    getContext() {
        return {
            fillStyle: '' as string,
            strokeStyle: '' as string,
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
            fillText: vi.fn(),
            putImageData: vi.fn(),
            createImageData: vi.fn().mockReturnValue({
                data: new Uint8ClampedArray(4),
            }),
            createPattern: vi.fn().mockReturnValue({}),
        };
    }
}

// @ts-expect-error – jsdom does not implement OffscreenCanvas
global.OffscreenCanvas = MockOffscreenCanvas;

// Compression APIs
class MockTransformStream {
    readable = {};
    writable = {};
}
// @ts-expect-error
global.CompressionStream = class extends MockTransformStream {};
// @ts-expect-error
global.DecompressionStream = class extends MockTransformStream {};

// URL
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// canvas.toDataURL / convertToBlob
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillStyle: '' as string,
    strokeStyle: '' as string,
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
    fillText: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
    createPattern: vi.fn().mockReturnValue({}),
}) as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
