// ── shared geometry helpers ───────────────────────────────────────────────────

/// Trait used by `gpair` to convert a coordinate from `u16` to a numeric type.
///
/// This is intentionally implemented using `as` casts so that it mirrors the
/// behavior of previous `gx(..) as T` / `gy(..) as T` patterns used elsewhere.
pub(crate) trait FromU16 {
    fn from_u16(x: u16) -> Self;
}

macro_rules! impl_from_u16 {
    ($($t:ty),*) => {
        $(
            impl FromU16 for $t {
                #[inline]
                fn from_u16(x: u16) -> Self {
                    x as $t
                }
            }
        )*
    };
}

// Add any additional numeric types if needed.
impl_from_u16!(u8, u16, u32, usize, i8, i16, i32, isize, f32);

/// Returns the (x, y) pair at a given vertex index, casting to a numeric type.
///
/// This is a generic helper meant to replace the old `gx(..)`/`gy(..)` helpers.
#[inline]
pub(crate) fn gpair<T>(pts: &[u16], i: usize) -> (T, T)
where
    T: FromU16,
{
    let base = i * 2;
    (T::from_u16(pts[base]), T::from_u16(pts[base + 1]))
}

#[inline]
pub(crate) fn orient_poly(pts1: &[u16], pts2: &[u16], a: usize, b: usize, c: usize) -> i32 {
    let (ax, ay): (i32, i32) = gpair(pts1, a);
    let (bx, by): (i32, i32) = gpair(pts1, b);
    let (cx, cy): (i32, i32) = gpair(pts2, c);

    let (dx_ab, dy_ab) = (bx - ax, by - ay);
    let (dx_ac, dy_ac) = (cx - ax, cy - ay);
    dx_ab * dy_ac - dy_ab * dx_ac
}

#[inline]
pub(crate) fn dist2i(pts: &[u16], a: usize, b: usize) -> i32 {
    let (ax, ay): (i32, i32) = gpair(pts, a);
    let (bx, by): (i32, i32) = gpair(pts, b);
    let dx = bx - ax;
    let dy = by - ay;
    dx * dx + dy * dy
}

/// Normalize a closed contour: remove duplicate last==first vertex if present.
///
/// This is used by both polygon simplification and sliding-edge refinement.
pub(crate) fn normalize_contour(pts: &[u16]) -> Vec<u16> {
    let n = pts.len() / 2;
    if n > 1 && gpair::<u16>(pts, 0) == gpair::<u16>(pts, n - 1) {
        pts[..(n - 1) * 2].to_vec()
    } else {
        pts.to_vec()
    }
}

#[inline]
pub(crate) fn cross2(pts1: &[u16], pts2: &[u16], a: usize, b: usize, c: usize) -> i32 {
    let (ax, ay): (i32, i32) = gpair(pts1, a);
    let (bx, by): (i32, i32) = gpair(pts1, b);
    let (cx, cy): (i32, i32) = gpair(pts2, c);
    let (bax, cby) = (bx - ax, cy - by);
    let (bay, cbx) = (by - ay, cx - bx);
    bax * cby - bay * cbx
}

pub(crate) fn segments_intersect(
    a: &[u16],
    a0: usize,
    a1: usize,
    b: &[u16],
    b0: usize,
    b1: usize,
) -> bool {
    #[inline]
    fn on_seg(a: &[u16], a0: usize, a1: usize, b: &[u16], p: usize) -> bool {
        let (ax, ay): (u16, u16) = gpair(a, a0);
        let (bx, by): (u16, u16) = gpair(a, a1);
        let (px, py): (u16, u16) = gpair(b, p);
        px >= ax.min(bx)
            && px <= ax.max(bx)
            && py >= ay.min(by)
            && py <= ay.max(by)
            && orient_poly(a, b, a0, a1, p) == 0
    }

    let o1 = orient_poly(a, b, a0, a1, b0).signum();
    let o2 = orient_poly(a, b, a0, a1, b1).signum();
    let o3 = orient_poly(b, a, b0, b1, a0).signum();
    let o4 = orient_poly(b, a, b0, b1, a1).signum();

    (o1 != o2 && o3 != o4)
        || (o1 == 0 && on_seg(a, a0, a1, b, b0))
        || (o2 == 0 && on_seg(a, a0, a1, b, b1))
        || (o3 == 0 && on_seg(b, b0, b1, a, a0))
        || (o4 == 0 && on_seg(b, b0, b1, a, a1))
}

pub(crate) fn polygon_signed_area2(pts: &[u16]) -> i32 {
    #[cfg(target_arch = "wasm32")]
    // SAFETY: simd128 is enabled globally via .cargo/config.toml for wasm32
    unsafe {
        polygon_signed_area_simd(pts)
    }

    #[cfg(not(target_arch = "wasm32"))]
    polygon_signed_area_scalar(pts)
}

#[cfg(not(target_arch = "wasm32"))]
fn polygon_signed_area_scalar(pts: &[u16]) -> i32 {
    let n = pts.len() / 2;
    let mut sum = 0i32;
    for i in 0..n {
        let j = (i + 1) % n;
        let (xi, yi): (i32, i32) = gpair(pts, i);
        let (xj, yj): (i32, i32) = gpair(pts, j);
        sum += xi * yj - xj * yi;
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
    let (ax, ay): (f32, f32) = gpair(pts, a);
    let (bx, by): (f32, f32) = gpair(pts, b);
    let (cx, cy): (f32, f32) = gpair(pts, c);

    let v1x = bx - ax;
    let v1y = by - ay;
    let v2x = cx - ax;
    let v2y = cy - ay;
    let l1 = (dist2i(pts, a, b) as f32).sqrt();
    let l2 = (dist2i(pts, a, c) as f32).sqrt();
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
    pts: &[u16],
    p: usize,
    a: usize,
    b: usize,
    c: usize,
) -> bool {
    let o1 = orient_poly(pts, pts, a, b, p);
    let o2 = orient_poly(pts, pts, b, c, p);
    let o3 = orient_poly(pts, pts, c, a, p);
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
    let tri_sign = orient_poly(pts, pts, a, b, c);
    if (poly_sign > 0 && tri_sign > 0) || (poly_sign < 0 && tri_sign < 0) {
        (a, b, c)
    } else {
        (a, c, b)
    }
}
