type SimplifyOptions = {
    maxPoints: number;
    /** base epsilon in pixels */
    epsilon: number;

    /** contour is closed if last point equals first (x,y). Default: auto-detect */
    closed?: boolean;

    /** Adaptive epsilon */
    adaptive?: {
        /** epsilon = max(epsilon, relToDiag * bboxDiag) */
        relToDiag?: number; // e.g. 0.002 ... 0.01
        /** epsilon = max(epsilon, relToAvgEdge * avgEdgeLen) */
        relToAvgEdge?: number; // e.g. 0.2 ... 1.0
        /** clamp epsilon */
        min?: number;
        max?: number;
    };

    /** Corner preservation */
    corners?: {
        /** Protect points with angle < minAngleDeg (sharp corners). e.g. 30..60 */
        minAngleDeg?: number;
        /**
         * hard = true  => such points are never removed
         * hard = false => apply weight to make them harder to remove
         */
        hard?: boolean;
        /** used only if hard=false; bigger => corners preserved more strongly */
        weight?: number; // e.g. 4..20
    };

    /** Safety cap. Default: width*height*4 equivalent; here: pointsCount*32 */
    maxIterations?: number;
};

type HeapItem = { i: number; d: number };

class MinHeap {
    private a: HeapItem[] = [];
    get size() { return this.a.length; }

    push(v: HeapItem) {
        const a = this.a;
        a.push(v);
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >>> 1;
            if (a[p].d <= a[i].d) break;
            const t = a[p]; a[p] = a[i]; a[i] = t;
            i = p;
        }
    }

    pop(): HeapItem | undefined {
        const a = this.a;
        if (a.length === 0) return undefined;
        const root = a[0];
        const last = a.pop()!;
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (; ;) {
                const l = i * 2 + 1;
                const r = l + 1;
                let m = i;
                if (l < a.length && a[l].d < a[m].d) m = l;
                if (r < a.length && a[r].d < a[m].d) m = r;
                if (m === i) break;
                const t = a[m]; a[m] = a[i]; a[i] = t;
                i = m;
            }
        }
        return root;
    }
}

function pointSegDistSq(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number
): number {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;

    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return apx * apx + apy * apy;

    let t = (apx * abx + apy * aby) / abLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;

    const cx = ax + t * abx;
    const cy = ay + t * aby;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy;
}

function clamp(x: number, a: number, b: number) {
    return x < a ? a : x > b ? b : x;
}

function isClosedU16(points: Uint16Array): boolean {
    const n = points.length;
    if (n < 4) return false;
    return points[0] === points[n - 2] && points[1] === points[n - 1];
}

export function simplifyContourU16Advanced(
    pointsIn: Uint16Array,
    opts: SimplifyOptions
): Uint16Array {
    if (pointsIn.length < 6) return pointsIn;

    const closed = opts.closed ?? isClosedU16(pointsIn);

    // Remove duplicated last point if closed
    const src = closed ? pointsIn.subarray(0, pointsIn.length - 2) : pointsIn;

    const nPts = src.length >>> 1;
    if (nPts <= 3) {
        return closed ? new Uint16Array([...src, src[0], src[1]]) : src;
    }

    let maxPoints = opts.maxPoints | 0;
    if (maxPoints < 3) maxPoints = 3;

    const getX = (i: number) => src[(i << 1)];
    const getY = (i: number) => src[(i << 1) + 1];

    // ---- adaptive epsilon ----
    let eps = opts.epsilon;
    if (opts.adaptive) {
        let minX = getX(0), maxX = minX, minY = getY(0), maxY = minY;
        let per = 0;

        for (let i = 1; i < nPts; i++) {
            const x = getX(i), y = getY(i);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        for (let i = 0; i < nPts; i++) {
            const j = (i + 1) % nPts;
            const dx = getX(j) - getX(i);
            const dy = getY(j) - getY(i);
            per += Math.hypot(dx, dy);
        }

        const diag = Math.hypot(maxX - minX, maxY - minY);
        const avgEdge = per / nPts;

        if (opts.adaptive.relToDiag != null) {
            eps = Math.max(eps, opts.adaptive.relToDiag * diag);
        }
        if (opts.adaptive.relToAvgEdge != null) {
            eps = Math.max(eps, opts.adaptive.relToAvgEdge * avgEdge);
        }
        if (opts.adaptive.min != null) eps = Math.max(eps, opts.adaptive.min);
        if (opts.adaptive.max != null) eps = Math.min(eps, opts.adaptive.max);
    }

    const epsSq = eps * eps;

    // ---- corner logic ----
    const minCornerAngleDeg = opts.corners?.minAngleDeg ?? 0; // 0 => disabled
    const minCornerAngleRad = (minCornerAngleDeg * Math.PI) / 180;
    const cornersHard = opts.corners?.hard ?? true;
    const cornerWeight = opts.corners?.weight ?? 10;

    const cornerAngle = (p: number, i: number, q: number): number => {
        // angle between vectors (p->i) and (q->i) (actually i->p and i->q)
        const v1x = getX(p) - getX(i);
        const v1y = getY(p) - getY(i);
        const v2x = getX(q) - getX(i);
        const v2y = getY(q) - getY(i);

        const l1 = Math.hypot(v1x, v1y);
        const l2 = Math.hypot(v2x, v2y);
        if (l1 === 0 || l2 === 0) return 0;

        const cos = clamp((v1x * v2x + v1y * v2y) / (l1 * l2), -1, 1);
        return Math.acos(cos); // 0..pi
    };

    const isProtectedCorner = (p: number, i: number, q: number): boolean => {
        if (minCornerAngleDeg <= 0) return false;
        const a = cornerAngle(p, i, q);
        return a < minCornerAngleRad;
    };

    const applyCornerWeight = (dSq: number, p: number, i: number, q: number): number => {
        if (minCornerAngleDeg <= 0) return dSq;
        const a = cornerAngle(p, i, q);
        if (a >= Math.PI) return dSq;

        // small angle => sharp => increase "cost" of removing (i.e. increase dist)
        // scale = 1 + weight * (1 - a/pi)
        const scale = 1 + cornerWeight * (1 - a / Math.PI);
        return dSq * scale * scale;
    };

    // ---- linked ring ----
    const prev = new Int32Array(nPts);
    const next = new Int32Array(nPts);
    const alive = new Uint8Array(nPts);
    const distKey = new Float64Array(nPts);

    for (let i = 0; i < nPts; i++) {
        prev[i] = (i - 1 + nPts) % nPts;
        next[i] = (i + 1) % nPts;
        alive[i] = 1;
    }

    const heap = new MinHeap();

    const computeKey = (i: number): number => {
        const p = prev[i];
        const q = next[i];

        // hard protect corners
        if (cornersHard && isProtectedCorner(p, i, q)) return Number.POSITIVE_INFINITY;

        const dSq = pointSegDistSq(
            getX(i), getY(i),
            getX(p), getY(p),
            getX(q), getY(q)
        );

        return cornersHard ? dSq : applyCornerWeight(dSq, p, i, q);
    };

    for (let i = 0; i < nPts; i++) {
        const k = computeKey(i);
        distKey[i] = k;
        heap.push({ i, d: k });
    }

    let aliveCount = nPts;
    const maxIterations = opts.maxIterations ?? (nPts * 32);
    let iters = 0;

    const updatePoint = (i: number) => {
        const k = computeKey(i);
        distKey[i] = k;
        heap.push({ i, d: k });
    };

    const removePoint = (i: number) => {
        alive[i] = 0;
        aliveCount--;

        const p = prev[i];
        const q = next[i];

        next[p] = q;
        prev[q] = p;

        updatePoint(p);
        updatePoint(q);
    };

    while (aliveCount > 3 && iters++ < maxIterations) {
        const it = heap.pop();
        if (!it) break;

        const i = it.i;
        if (!alive[i]) continue;
        if (it.d !== distKey[i]) continue; // stale

        // If key is INF => protected corner (hard mode). Skip it.
        if (it.d === Number.POSITIVE_INFINITY) {
            // якщо нам потрібно ще стискати до maxPoints, але всі точки "protected",
            // цикл закінчиться коли heap вичерпається або по maxIterations.
            continue;
        }

        if (aliveCount > maxPoints) {
            // must reduce to maxPoints regardless of epsilon
            removePoint(i);
            continue;
        }

        // after reaching <= maxPoints, keep removing only if it satisfies epsilon
        if (it.d <= epsSq) {
            removePoint(i);
            continue;
        }

        // minimal removable key already > eps => stop
        break;
    }

    // ---- build output ----
    let start = -1;
    for (let i = 0; i < nPts; i++) {
        if (alive[i]) { start = i; break; }
    }
    if (start === -1) return new Uint16Array(0);

    const out: number[] = [];
    let cur = start;
    do {
        out.push(getX(cur), getY(cur));
        cur = next[cur];
    } while (cur !== start);

    if (closed && out.length >= 2) out.push(out[0], out[1]);

    return new Uint16Array(out);
}
