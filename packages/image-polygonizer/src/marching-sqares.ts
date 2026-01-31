// ======================================================
// Outer contour extraction from padded bitmask (LSB-first)
//  - bits: Uint8Array, 1 bit per pixel, 1 = opaque
//  - width/height: padded dims
//  - padding: padding border size in pixels (usually 1)
// Output: Uint16Array[] contours, each as [x0,y0,x1,y1,...] WITHOUT padding
// Notes:
//  - Extracts ONLY outer contours (holes ignored)
//  - Clears each connected component from the bitmask after processing
//  - Designed for images up to 2048x2048 (fits Uint16 coords)
// ======================================================

// ----------------------
// Bit helpers (LSB-first)
// ----------------------

function getBit01(bits: Uint8Array, idx: number): number {
    return (bits[idx >>> 3] >>> (idx & 7)) & 1; // 0|1
}

function setBit1(bits: Uint8Array, idx: number): void {
    bits[idx >>> 3] |= 1 << (idx & 7);
}

function clearBit(bits: Uint8Array, idx: number): void {
    bits[idx >>> 3] &= ~(1 << (idx & 7));
}

// 0|1 for pixel(x,y)
function opaque01(bits: Uint8Array, width: number, x: number, y: number): number {
    const idx = y * width + x;
    return getBit01(bits, idx);
}

// -----------------------
// Square value (0..15)
// -----------------------

function getSquareValue(bits: Uint8Array, width: number, x: number, y: number): number {
    // 2x2:
    // (x-1,y-1)=1, (x,y-1)=2, (x-1,y)=4, (x,y)=8
    const o1 = opaque01(bits, width, x - 1, y - 1);
    const o2 = opaque01(bits, width, x, y - 1);
    const o4 = opaque01(bits, width, x - 1, y);
    const o8 = opaque01(bits, width, x, y);

    // o1 + o2*2 + o4*4 + o8*8, but via shifts
    return o1 + (o2 << 1) + (o4 << 2) + (o8 << 3);
}

// ---------------------------------
// Pair helpers (tuple-like in Rust)
// ---------------------------------

const START_SQ_OFFSETS = new Int16Array([
    0, 0,
    1, 0,
    0, 1,
    1, 1,
]);

const DIR_UP = new Int16Array([0, -1]);
const DIR_DOWN = new Int16Array([0, 1]);
const DIR_LEFT = new Int16Array([-1, 0]);
const DIR_RIGHT = new Int16Array([1, 0]);

function copy2i32(dst: Int32Array, src: Int32Array): void {
    dst[0] = src[0];
    dst[1] = src[1];
}

function set2i16(dst: Int16Array, src: Int16Array): void {
    dst[0] = src[0];
    dst[1] = src[1];
}

function addStep2i32(pos: Int32Array, step: Int16Array): void {
    pos[0] += step[0];
    pos[1] += step[1];
}

function eq2i32(a: Int32Array, b: Int32Array): boolean {
    return a[0] === b[0] && a[1] === b[1];
}

// ----------------------------
// Growable Uint16 [x,y,x,y...]
// ----------------------------

class U16Pairs {
    private buf: Uint16Array;
    private len: number; // u16 count

    constructor(initialPairs = 256) {
        this.buf = new Uint16Array(initialPairs * 2);
        this.len = 0;
    }

    push2(x: number, y: number): void {
        if (this.len + 2 > this.buf.length) {
            const next = new Uint16Array(Math.max(this.buf.length * 2, this.len + 2));
            next.set(this.buf);
            this.buf = next;
        }
        this.buf[this.len++] = x;
        this.buf[this.len++] = y;
    }

    setLast2(x: number, y: number): void {
        if (this.len < 2) return this.push2(x, y);
        this.buf[this.len - 2] = x;
        this.buf[this.len - 1] = y;
    }

    toArray(): Uint16Array {
        return this.buf.slice(0, this.len);
    }
}

// ----------------------------
// Find any opaque seed (interior)
// ----------------------------

function findAnyOpaquePixelInteriorInto(
    bits: Uint8Array,
    width: number,
    boundsMin: Int32Array, // [xMin,yMin]
    boundsMax: Int32Array, // [xMax,yMax]
    outSeed: Int32Array    // [x,y]
): boolean {
    const x0 = boundsMin[0], y0 = boundsMin[1];
    const x1 = boundsMax[0], y1 = boundsMax[1];

    for (let y = y0; y <= y1; y++) {
        const rowBase = y * width;
        for (let x = x0; x <= x1; x++) {
            if (getBit01(bits, rowBase + x)) {
                outSeed[0] = x;
                outSeed[1] = y;
                return true;
            }
        }
    }
    return false;
}

// -------------------------------------
// Collect connected component + clear it
// Track LEFTMOST opaque pixel (min x, then min y)
// (4-connectivity)
// -------------------------------------

type ComponentInfo = {
    pixels: Uint32Array; // backing buffer
    count: number;       // used length
    left: Int32Array;    // [leftX,leftY]
};

function collectComponentAndClear(
    bits: Uint8Array,
    width: number,
    height: number,
    seed: Int32Array
): ComponentInfo {
    const seedIdx = seed[1] * width + seed[0];
    if (getBit01(bits, seedIdx) === 0) {
        return { pixels: new Uint32Array(0), count: 0, left: new Int32Array([0, 0]) };
    }

    let stack = new Uint32Array(1024);
    let sp = 0;

    let list = new Uint32Array(4096);
    let n = 0;

    const left = new Int32Array([seed[0], seed[1]]);

    const pushStack = (idx: number) => {
        if (sp >= stack.length) {
            const next = new Uint32Array(stack.length * 2);
            next.set(stack);
            stack = next;
        }
        stack[sp++] = idx;
    };

    const pushList = (idx: number) => {
        if (n >= list.length) {
            const next = new Uint32Array(list.length * 2);
            next.set(list);
            list = next;
        }
        list[n++] = idx;
    };

    // mark visited by clearing bit
    clearBit(bits, seedIdx);
    pushStack(seedIdx);
    pushList(seedIdx);

    while (sp) {
        const idx = stack[--sp];
        const y = (idx / width) | 0;
        const x = idx - y * width;

        // update leftmost
        if (x < left[0] || (x === left[0] && y < left[1])) {
            left[0] = x;
            left[1] = y;
        }

        // 4-neighbors
        if (x > 0) {
            const ni = idx - 1;
            if (getBit01(bits, ni)) { clearBit(bits, ni); pushStack(ni); pushList(ni); }
        }
        if (x + 1 < width) {
            const ni = idx + 1;
            if (getBit01(bits, ni)) { clearBit(bits, ni); pushStack(ni); pushList(ni); }
        }
        if (y > 0) {
            const ni = idx - width;
            if (getBit01(bits, ni)) { clearBit(bits, ni); pushStack(ni); pushList(ni); }
        }
        if (y + 1 < height) {
            const ni = idx + width;
            if (getBit01(bits, ni)) { clearBit(bits, ni); pushStack(ni); pushList(ni); }
        }
    }

    return { pixels: list, count: n, left };
}

function restoreComponent(bits: Uint8Array, comp: ComponentInfo): void {
    const { pixels, count } = comp;
    for (let i = 0; i < count; i++) setBit1(bits, pixels[i]);
}

function clearComponentByList(bits: Uint8Array, comp: ComponentInfo): void {
    const { pixels, count } = comp;
    for (let i = 0; i < count; i++) clearBit(bits, pixels[i]);
}

// -------------------------------------
// Find start square near point into outSq
// Needs sv != 0 && sv != 15
// -------------------------------------

function findStartSquareNearInto(
    bits: Uint8Array,
    width: number,
    boundsMin: Int32Array, // [xMin,yMin]
    boundsMax: Int32Array, // [xMax,yMax]
    p: Int32Array,         // [x,y]
    outSq: Int32Array      // [sx,sy]
): boolean {
    const xMin = boundsMin[0], yMin = boundsMin[1];
    const xMax = boundsMax[0], yMax = boundsMax[1];

    const x = p[0], y = p[1];

    // 1) 4 candidates
    for (let i = 0; i < START_SQ_OFFSETS.length; i += 2) {
        const sx = x + START_SQ_OFFSETS[i];
        const sy = y + START_SQ_OFFSETS[i + 1];

        if (sx < xMin || sy < yMin || sx > xMax || sy > yMax) continue;

        const sv = getSquareValue(bits, width, sx, sy);
        if (sv !== 0 && sv !== 15) {
            outSq[0] = sx;
            outSq[1] = sy;
            return true;
        }
    }

    // 2) small local fallback
    const R = 8;
    for (let dy = -R; dy <= R; dy++) {
        const sy = y + dy;
        if (sy < yMin || sy > yMax) continue;

        for (let dx = -R; dx <= R; dx++) {
            const sx = x + dx;
            if (sx < xMin || sx > xMax) continue;

            const sv = getSquareValue(bits, width, sx, sy);
            if (sv !== 0 && sv !== 15) {
                outSq[0] = sx;
                outSq[1] = sy;
                return true;
            }
        }
    }

    return false;
}

// ======================================================
// Toggle bitset helpers (for cases 6 and 9)
// ======================================================

function toggleGet01(toggles: Uint8Array, idx: number): number {
    return (toggles[idx >>> 3] >>> (idx & 7)) & 1;
}

function toggleSet1(toggles: Uint8Array, idx: number): void {
    toggles[idx >>> 3] |= 1 << (idx & 7);
}

function toggleClear(toggles: Uint8Array, idx: number): void {
    toggles[idx >>> 3] &= ~(1 << (idx & 7));
}

// ----------------------------
// Marching from start square
// Uses bitsets for toggle9/toggle6
// ----------------------------

function marchFromStartSquare(
    bits: Uint8Array,
    width: number,
    height: number,
    padding: number,
    boundsMin: Int32Array,
    boundsMax: Int32Array,
    startSq: Int32Array,      // [sx,sy] padded coords
    maxSteps: number
): Uint16Array {
    const cur = new Int32Array(2);
    const start = new Int32Array(2);
    const outPos = new Int32Array(2);

    copy2i32(cur, startSq);
    copy2i32(start, startSq);

    const step = new Int16Array(2);
    const prev = new Int16Array(2);

    // Bitsets: 1 bit per cell
    const cellCount = width * height;
    const toggle9 = new Uint8Array((cellCount + 7) >>> 3);
    const toggle6 = new Uint8Array((cellCount + 7) >>> 3);

    const out = new U16Pairs(256);

    let steps = 0;
    do {
        if (++steps > maxSteps) break;

        // bounds check
        if (
            cur[0] < boundsMin[0] || cur[1] < boundsMin[1] ||
            cur[0] > boundsMax[0] || cur[1] > boundsMax[1]
        ) break;

        const sv = getSquareValue(bits, width, cur[0], cur[1]);

        switch (sv) {
            case 1:
            case 5:
            case 13:
                set2i16(step, DIR_UP);
                break;

            case 8:
            case 10:
            case 11:
                set2i16(step, DIR_DOWN);
                break;

            case 4:
            case 12:
            case 14:
                set2i16(step, DIR_LEFT);
                break;

            case 2:
            case 3:
            case 7:
                set2i16(step, DIR_RIGHT);
                break;

            case 9: {
                const id = cur[1] * width + cur[0];
                // toggle: first time UP, second time DOWN
                if (toggleGet01(toggle9, id)) {
                    set2i16(step, DIR_DOWN);
                    toggleClear(toggle9, id);
                } else {
                    set2i16(step, DIR_UP);
                    toggleSet1(toggle9, id);
                }
                break;
            }

            case 6: {
                const id = cur[1] * width + cur[0];
                // toggle: first time RIGHT, second time LEFT
                if (toggleGet01(toggle6, id)) {
                    set2i16(step, DIR_LEFT);
                    toggleClear(toggle6, id);
                } else {
                    set2i16(step, DIR_RIGHT);
                    toggleSet1(toggle6, id);
                }
                break;
            }

            default:
                // 0/15/unexpected
                return out.toArray();
        }

        // cur += step
        addStep2i32(cur, step);

        // outPos = cur - padding (coords without padding)
        outPos[0] = cur[0] - padding;
        outPos[1] = cur[1] - padding;

        // merge collinear
        if (step[0] === prev[0] && step[1] === prev[1]) out.setLast2(outPos[0], outPos[1]);
        else out.push2(outPos[0], outPos[1]);

        // prev = step
        prev[0] = step[0];
        prev[1] = step[1];
    } while (!eq2i32(cur, start));

    return out.toArray();
}

// ======================================================
// Public API
// ======================================================

export function extractAllOuterContours(
    inputBits: Uint8Array,   // will be modified (cleared)
    width: number,      // padded width
    height: number,     // padded height
    padding = 1
): Uint16Array[] {
    const bits = inputBits.slice();
    const maxContours = 1_000_000;
    const maxStepsPerContour = (width * height * 4);

    // bounds for safe interior (since mask is padded)
    const boundsMin = new Int32Array([padding, padding]);
    const boundsMax = new Int32Array([width - 1 - padding, height - 1 - padding]);

    const seed = new Int32Array(2);
    const startSq = new Int32Array(2);

    const contours: Uint16Array[] = [];

    for (let k = 0; k < maxContours; k++) {
        // 1) find any seed inside interior
        if (!findAnyOpaquePixelInteriorInto(bits, width, boundsMin, boundsMax, seed)) break;

        // 2) collect component + clear it (visited), also finds leftmost pixel
        const comp = collectComponentAndClear(bits, width, height, seed);
        if (comp.count === 0) continue;

        // 3) restore so marching can read component pixels
        restoreComponent(bits, comp);

        // 4) find start square near leftmost (guarantees OUTER boundary)
        if (findStartSquareNearInto(bits, width, boundsMin, boundsMax, comp.left, startSq)) {
            const contour = marchFromStartSquare(
                bits,
                width,
                height,
                padding,
                boundsMin,
                boundsMax,
                startSq,
                maxStepsPerContour
            );
            contours.push(contour);
        }

        // 5) finally clear whole component (contour + interior) WITHOUT second flood-fill
        clearComponentByList(bits, comp);
    }

    return contours;
}
