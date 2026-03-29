import { vi, beforeEach } from 'vitest';

// ─── ImageBitmap ─────────────────────────────────────────────────────────────
class MockImageBitmap {
    constructor(
        public width = 10,
        public height = 10,
    ) {}
    close = vi.fn();
}
(global as any).ImageBitmap = MockImageBitmap;

// ─── createImageBitmap ───────────────────────────────────────────────────────
(global as any).createImageBitmap = vi.fn(
    async (source: any, sx?: number, sy?: number, sw?: number, sh?: number) => {
        const width = sw ?? source?.width ?? 10;
        const height = sh ?? source?.height ?? 10;
        return new MockImageBitmap(width, height);
    },
);

// ─── OffscreenCanvas ─────────────────────────────────────────────────────────
class MockOffscreenCanvas {
    constructor(
        public width: number,
        public height: number,
    ) {}

    getContext(_type: string, _options?: any) {
        const self = this;
        const pixels = new Uint8ClampedArray(self.width * self.height * 4);
        return {
            drawImage: vi.fn(),
            clearRect: vi.fn(),
            getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
                data: pixels,
                width: w,
                height: h,
            })),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            clip: vi.fn(),
        };
    }

    transferToImageBitmap() {
        return new MockImageBitmap(this.width, this.height);
    }
}
(global as any).OffscreenCanvas = MockOffscreenCanvas;

// ─── VideoFrame ───────────────────────────────────────────────────────────────
// Force OffscreenCanvas fallback in imageBitmapToRgbaPixels
(global as any).VideoFrame = undefined;

// ─── Worker ──────────────────────────────────────────────────────────────────
class MockWorker {
    static instances: MockWorker[] = [];
    url: string;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor(url: string) {
        this.url = url;
        MockWorker.instances.push(this);
    }

    simulateMessage(data: any) {
        // Use a plain object so currentTarget is writable (Event.currentTarget is read-only in JSDOM).
        const event = { data, currentTarget: this };
        if (this.onmessage) this.onmessage(event as any);
    }

    simulateError(message = 'Worker error') {
        const event = { message, currentTarget: this };
        if (this.onerror) this.onerror(event as any);
    }
}
(global as any).Worker = MockWorker;
(globalThis as any).MockWorker = MockWorker;

beforeEach(() => {
    MockWorker.instances = [];
    vi.mocked((global as any).createImageBitmap).mockImplementation(
        async (source: any, _sx?: number, _sy?: number, sw?: number, sh?: number) => {
            const width = sw ?? source?.width ?? 10;
            const height = sh ?? source?.height ?? 10;
            return new MockImageBitmap(width, height);
        },
    );
});

// ─── navigator.hardwareConcurrency ───────────────────────────────────────────
Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 4,
    configurable: true,
});

// ─── fetch ───────────────────────────────────────────────────────────────────
(global as any).fetch = vi.fn();

// ─── crypto.randomUUID ───────────────────────────────────────────────────────
if (!global.crypto?.randomUUID) {
    Object.defineProperty(global, 'crypto', {
        value: {
            ...global.crypto,
            randomUUID: vi.fn(() => 'test-uuid-1234-5678-9012-345678901234'),
        },
        configurable: true,
    });
}

// ─── self.postMessage ─────────────────────────────────────────────────────────
// Always replace window.postMessage with a mock so worker code that calls
// self.postMessage() works in jsdom without needing a valid target origin.
(global as any).self = global;
(global as any).postMessage = vi.fn();
