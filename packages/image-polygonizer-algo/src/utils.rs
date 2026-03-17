// ── shared geometry helpers ───────────────────────────────────────────────────

#[inline]
pub(crate) fn gx(pts: &[u16], i: usize) -> u16 {
    pts[i * 2]
}
#[inline]
pub(crate) fn gy(pts: &[u16], i: usize) -> u16 {
    pts[i * 2 + 1]
}

pub(crate) fn orient_raw(ax: u16, ay: u16, bx: u16, by: u16, cx: u16, cy: u16) -> i32 {
    let (dx_ab, dy_ab) = (bx as i16 - ax as i16, by as i16 - ay as i16);
    let (dx_ac, dy_ac) = (cx as i16 - ax as i16, cy as i16 - ay as i16);
    dx_ab as i32 * dy_ac as i32 - dy_ab as i32 * dx_ac as i32
}

#[inline]
pub(crate) fn orient_poly(pts: &[u16], a: usize, b: usize, c: usize) -> i32 {
    orient_raw(
        gx(pts, a),
        gy(pts, a),
        gx(pts, b),
        gy(pts, b),
        gx(pts, c),
        gy(pts, c),
    )
}

#[inline]
pub(crate) fn dist2i(x1: u16, y1: u16, x2: u16, y2: u16) -> i32 {
    let dx = x2 as i16 - x1 as i16;
    let dy = y2 as i16 - y1 as i16;
    dx as i32 * dx as i32 + dy as i32 * dy as i32
}

#[inline]
pub(crate) fn dist2i_poly(pts: &[u16], a: usize, b: usize) -> i32 {
    dist2i(gx(pts, a), gy(pts, a), gx(pts, b), gy(pts, b))
}

pub(crate) fn polygon_signed_area2(pts: &[u16]) -> i32 {
    #[cfg(target_arch = "wasm32")]
    // SAFETY: simd128 is enabled globally via .cargo/config.toml for wasm32
    unsafe { polygon_signed_area_simd(pts) }

    #[cfg(not(target_arch = "wasm32"))]
    polygon_signed_area_scalar(pts)
}

#[cfg(not(target_arch = "wasm32"))]
fn polygon_signed_area_scalar(pts: &[u16]) -> i32 {
    let n = pts.len() / 2;
    let mut sum = 0i32;
    for i in 0..n {
        let j = (i + 1) % n;
        sum += gx(pts, i) as i32 * gy(pts, j) as i32 - gx(pts, j) as i32 * gy(pts, i) as i32;
    }
    sum
}

// ── SIMD implementation (wasm32 simd128) ─────────────────────────────────────
//
// Processes 2 shoelace terms per iteration using i32x4_extmul_low_i16x8:
//   a     = [-y0,  x0, -y1,  x1, 0, 0, 0, 0]  (i16x8, wrapping negation)
//   b     = [ x1,  y1,  x2,  y2, 0, 0, 0, 0]  (i16x8)
//   terms = [-y0·x1, x0·y1, -y1·x2, x1·y2]    (i32x4 via extmul_low, exact)
//   sum   = (x0·y1 - y0·x1) + (x1·y2 - y1·x2) ← two shoelace cross terms
//
// All coords < 4096, so |term| ≤ 4096² ≈ 16M, well within i32 range.
// Accumulation stays in i32 throughout — no i64 widening needed.
// If n is odd the final edge (vertex n-1 → vertex 0) is handled in scalar.

#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn polygon_signed_area_simd(pts: &[u16]) -> i32 {
    use core::arch::wasm32::*;

    let n = pts.len() / 2;
    if n < 3 {
        return 0;
    }

    let len = pts.len(); // 2*n
    let simd_pairs = n >> 1; // floor(n/2): each iteration covers 2 vertices

    let mut acc = i32x4_splat(0i32);

    for i in 0..simd_pairs {
        let base = i << 2; // i*4 — index of x0 in the flat coords array
        let x0 = pts[base] as i16;
        let y0 = pts[base + 1] as i16;
        let x1 = pts[base + 2] as i16;
        let y1 = pts[base + 3] as i16;
        // (base+4) and (base+5) wrap around at the last pair when n is even
        let x2 = pts[(base + 4) % len] as i16;
        let y2 = pts[(base + 5) % len] as i16;

        let a = i16x8(y0.wrapping_neg(), x0, y1.wrapping_neg(), x1, 0, 0, 0, 0);
        let b = i16x8(x1, y1, x2, y2, 0, 0, 0, 0);
        // i32x4: [-y0·x1, x0·y1, -y1·x2, x1·y2] — exact integer multiply
        let terms = i32x4_extmul_low_i16x8(a, b);
        acc = i32x4_add(acc, terms);
    }

    // Horizontal sum in i32 — safe because coords < 4096
    let mut sum = i32x4_extract_lane::<0>(acc)
        + i32x4_extract_lane::<1>(acc)
        + i32x4_extract_lane::<2>(acc)
        + i32x4_extract_lane::<3>(acc);

    // Scalar remainder for the last edge when n is odd (vertex n-1 → vertex 0)
    if n & 1 != 0 {
        sum += pts[len - 2] as i32 * pts[1] as i32 - pts[len - 1] as i32 * pts[0] as i32;
    }

    sum
}

pub(crate) fn triangle_angle(pts: &[u16], a: usize, b: usize, c: usize) -> f32 {
    let (ax, ay) = (gx(pts, a) as f32, gy(pts, a) as f32);
    let (bx, by) = (gx(pts, b) as f32, gy(pts, b) as f32);
    let (cx, cy) = (gx(pts, c) as f32, gy(pts, c) as f32);

    let v1x = bx - ax;
    let v1y = by - ay;
    let v2x = cx - ax;
    let v2y = cy - ay;
    let l1 = (dist2i_poly(pts, a, b) as f32).sqrt();
    let l2 = (dist2i_poly(pts, a, c) as f32).sqrt();
    if l1 == 0.0 || l2 == 0.0 {
        return 0.0;
    }
    let cos = ((v1x * v2x + v1y * v2y) / (l1 * l2)).clamp(-1.0, 1.0);
    cos.acos()
}

pub(crate) fn triangle_min_angle(pts: &[u16], a: usize, b: usize, c: usize) -> f32 {
    let aa = triangle_angle(pts, a, b, c);
    let ab = triangle_angle(pts, b, a, c);
    let ac = triangle_angle(pts, c, a, b);
    aa.min(ab).min(ac)
}

pub(crate) fn triangle_max_angle(pts: &[u16], a: usize, b: usize, c: usize) -> f32 {
    let aa = triangle_angle(pts, a, b, c);
    let ab = triangle_angle(pts, b, a, c);
    let ac = triangle_angle(pts, c, a, b);
    aa.max(ab).max(ac)
}

pub(crate) fn point_in_triangle_or_on_edge(
    px: u16,
    py: u16,
    ax: u16,
    ay: u16,
    bx: u16,
    by: u16,
    cx: u16,
    cy: u16,
) -> bool {
    let o1 = orient_raw(ax, ay, bx, by, px, py);
    let o2 = orient_raw(bx, by, cx, cy, px, py);
    let o3 = orient_raw(cx, cy, ax, ay, px, py);
    let has_neg = o1 < 0 || o2 < 0 || o3 < 0;
    let has_pos = o1 > 0 || o2 > 0 || o3 > 0;
    !(has_neg && has_pos)
}

pub(crate) fn orient_triangle_like_polygon(
    pts: &[u16],
    poly_sign: i8,
    a: usize,
    b: usize,
    c: usize,
) -> (usize, usize, usize) {
    let tri_sign = orient_poly(pts, a, b, c);
    if (poly_sign > 0 && tri_sign > 0) || (poly_sign < 0 && tri_sign < 0) {
        (a, b, c)
    } else {
        (a, c, b)
    }
}
