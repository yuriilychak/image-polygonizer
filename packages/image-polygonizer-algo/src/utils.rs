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
pub(crate) fn orient(pts1: &[u16], pts2: &[u16], a: usize, b: usize, c: usize) -> i32 {
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
            && orient(a, b, a0, a1, p) == 0
    }

    let o1 = orient(a, b, a0, a1, b0).signum();
    let o2 = orient(a, b, a0, a1, b1).signum();
    let o3 = orient(b, a, b0, b1, a0).signum();
    let o4 = orient(b, a, b0, b1, a1).signum();

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
    let o1 = orient(pts, pts, a, b, p);
    let o2 = orient(pts, pts, b, c, p);
    let o3 = orient(pts, pts, c, a, p);
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
    let tri_sign = orient(pts, pts, a, b, c);
    if (poly_sign > 0 && tri_sign > 0) || (poly_sign < 0 && tri_sign < 0) {
        (a, b, c)
    } else {
        (a, c, b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::{FRAC_PI_2, FRAC_PI_4};

    // ── gpair ─────────────────────────────────────────────────────────────────

    #[test]
    fn gpair_u16() {
        let pts: &[u16] = &[3, 7, 11, 13];
        assert_eq!(gpair::<u16>(pts, 0), (3u16, 7u16));
        assert_eq!(gpair::<u16>(pts, 1), (11u16, 13u16));
    }

    #[test]
    fn gpair_i32() {
        let pts: &[u16] = &[3, 7, 11, 13];
        assert_eq!(gpair::<i32>(pts, 0), (3i32, 7i32));
        assert_eq!(gpair::<i32>(pts, 1), (11i32, 13i32));
    }

    #[test]
    fn gpair_f32() {
        let pts: &[u16] = &[3, 7, 11, 13];
        assert_eq!(gpair::<f32>(pts, 0), (3.0f32, 7.0f32));
        assert_eq!(gpair::<f32>(pts, 1), (11.0f32, 13.0f32));
    }

    // ── orient ────────────────────────────────────────────────────────────────

    #[test]
    fn orient_ccw() {
        // (0,0), (10,0), (0,10) — CCW
        let pts: &[u16] = &[0, 0, 10, 0, 0, 10];
        assert!(orient(pts, pts, 0, 1, 2) > 0);
    }

    #[test]
    fn orient_cw() {
        // (0,0), (0,10), (10,0) — CW
        let pts: &[u16] = &[0, 0, 0, 10, 10, 0];
        assert!(orient(pts, pts, 0, 1, 2) < 0);
    }

    #[test]
    fn orient_collinear() {
        let pts: &[u16] = &[0, 0, 5, 5, 10, 10];
        assert_eq!(orient(pts, pts, 0, 1, 2), 0);
    }

    // ── dist2i ────────────────────────────────────────────────────────────────

    #[test]
    fn dist2i_3_4() {
        let pts: &[u16] = &[0, 0, 3, 4];
        assert_eq!(dist2i(pts, 0, 1), 25);
    }

    #[test]
    fn dist2i_zero() {
        let pts: &[u16] = &[5, 5];
        assert_eq!(dist2i(pts, 0, 0), 0);
    }

    #[test]
    fn dist2i_offset() {
        let pts: &[u16] = &[1, 1, 4, 5];
        assert_eq!(dist2i(pts, 0, 1), 25);
    }

    // ── cross2 ────────────────────────────────────────────────────────────────

    #[test]
    fn cross2_collinear_is_zero() {
        // A=(0,0), B=(5,0), C=(10,0) — all on x-axis
        let pts: &[u16] = &[0, 0, 5, 0, 10, 0];
        assert_eq!(cross2(pts, pts, 0, 1, 2), 0);
    }

    #[test]
    fn cross2_known_value() {
        // A=(0,5), B=(0,0), C=(5,0) — right angle at B
        // bax = bx-ax = 0-0 = 0, cby = cy-by = 0-0 = 0
        // bay = by-ay = 0-5 = -5, cbx = cx-bx = 5-0 = 5
        // cross = 0*0 - (-5)*5 = 25
        let pts: &[u16] = &[0, 5, 0, 0, 5, 0];
        assert_eq!(cross2(pts, pts, 0, 1, 2), 25);
    }

    // ── normalize_contour ─────────────────────────────────────────────────────

    #[test]
    fn normalize_contour_removes_duplicate_last() {
        // last vertex equals first
        let pts: &[u16] = &[0, 0, 10, 0, 10, 10, 0, 0];
        let result = normalize_contour(pts);
        assert_eq!(result, vec![0u16, 0, 10, 0, 10, 10]);
    }

    #[test]
    fn normalize_contour_no_duplicate() {
        let pts: &[u16] = &[0, 0, 10, 0, 10, 10];
        let result = normalize_contour(pts);
        assert_eq!(result, pts.to_vec());
    }

    #[test]
    fn normalize_contour_single_vertex() {
        let pts: &[u16] = &[5, 5];
        let result = normalize_contour(pts);
        assert_eq!(result, vec![5u16, 5]);
    }

    #[test]
    fn normalize_contour_two_vertices_same() {
        let pts: &[u16] = &[5, 5, 5, 5];
        let result = normalize_contour(pts);
        assert_eq!(result, vec![5u16, 5]);
    }

    #[test]
    fn normalize_contour_two_vertices_different() {
        let pts: &[u16] = &[5, 5, 6, 6];
        let result = normalize_contour(pts);
        assert_eq!(result, vec![5u16, 5, 6, 6]);
    }

    // ── polygon_signed_area2 ──────────────────────────────────────────────────

    #[test]
    fn polygon_signed_area2_empty() {
        assert_eq!(polygon_signed_area2(&[]), 0);
    }

    #[test]
    fn polygon_signed_area2_single_vertex() {
        assert_eq!(polygon_signed_area2(&[3, 7]), 0);
    }

    #[test]
    fn polygon_signed_area2_two_vertices() {
        assert_eq!(polygon_signed_area2(&[0, 0, 4, 0]), 0);
    }

    #[test]
    fn polygon_signed_area2_square_ccw() {
        // CCW square (0,0),(4,0),(4,4),(0,4): 2×area = 32
        let pts: &[u16] = &[0, 0, 4, 0, 4, 4, 0, 4];
        assert_eq!(polygon_signed_area2(pts), 32);
    }

    #[test]
    fn polygon_signed_area2_triangle() {
        // CCW triangle (0,0),(4,0),(0,3): 2×area = 12
        let pts: &[u16] = &[0, 0, 4, 0, 0, 3];
        assert_eq!(polygon_signed_area2(pts), 12);
    }

    #[test]
    fn polygon_signed_area2_cw_is_negative() {
        // CW — same square reversed
        let pts: &[u16] = &[0, 4, 4, 4, 4, 0, 0, 0];
        assert!(polygon_signed_area2(pts) < 0);
    }

    // ── segments_intersect ────────────────────────────────────────────────────

    #[test]
    fn segments_intersect_crossing_x() {
        let a: &[u16] = &[0, 0, 10, 10];
        let b: &[u16] = &[0, 10, 10, 0];
        assert!(segments_intersect(a, 0, 1, b, 0, 1));
    }

    #[test]
    fn segments_intersect_parallel_horizontal() {
        let a: &[u16] = &[0, 0, 10, 0];
        let b: &[u16] = &[0, 5, 10, 5];
        assert!(!segments_intersect(a, 0, 1, b, 0, 1));
    }

    #[test]
    fn segments_intersect_t_junction() {
        // (0,5)-(10,5) and (5,5)-(5,10): endpoint (5,5) lies on the first segment
        let a: &[u16] = &[0, 5, 10, 5];
        let b: &[u16] = &[5, 5, 5, 10];
        assert!(segments_intersect(a, 0, 1, b, 0, 1));
    }

    #[test]
    fn segments_intersect_shared_endpoint() {
        let a: &[u16] = &[0, 0, 5, 5];
        let b: &[u16] = &[5, 5, 10, 0];
        assert!(segments_intersect(a, 0, 1, b, 0, 1));
    }

    #[test]
    fn segments_intersect_non_overlapping_collinear() {
        let a: &[u16] = &[0, 0, 3, 0];
        let b: &[u16] = &[5, 0, 8, 0];
        assert!(!segments_intersect(a, 0, 1, b, 0, 1));
    }

    // ── triangle_angle ────────────────────────────────────────────────────────

    #[test]
    fn triangle_angle_right_at_origin() {
        // (0,0),(10,0),(0,10) — 90° at vertex 0
        let pts: &[u16] = &[0, 0, 10, 0, 0, 10];
        let angle = triangle_angle(pts, 0, 1, 2);
        assert!(
            (angle - FRAC_PI_2).abs() < 1e-4,
            "expected π/2, got {angle}"
        );
    }

    #[test]
    fn triangle_angle_approx_equilateral() {
        // (0,0),(10,0),(5,9) — roughly equilateral; all angles near π/3
        let pts: &[u16] = &[0, 0, 10, 0, 5, 9];
        let a0 = triangle_angle(pts, 0, 1, 2);
        let a1 = triangle_angle(pts, 1, 0, 2);
        let a2 = triangle_angle(pts, 2, 0, 1);
        let pi_over_3 = std::f32::consts::PI / 3.0;
        assert!(
            (a0 - pi_over_3).abs() < 0.05,
            "angle at 0: got {a0}"
        );
        assert!(
            (a1 - pi_over_3).abs() < 0.05,
            "angle at 1: got {a1}"
        );
        assert!(
            (a2 - pi_over_3).abs() < 0.05,
            "angle at 2: got {a2}"
        );
    }

    #[test]
    fn triangle_angle_degenerate_zero_edge() {
        // vertex a and b are the same point — length is 0
        let pts: &[u16] = &[5, 5, 5, 5, 10, 10];
        let angle = triangle_angle(pts, 0, 1, 2);
        assert_eq!(angle, 0.0);
    }

    // ── triangle_min_angle / triangle_max_angle ───────────────────────────────

    #[test]
    fn triangle_min_max_angle_right_triangle() {
        // Right isosceles (0,0),(10,0),(0,10):
        //   angle at 0 = π/2, at 1 = π/4, at 2 = π/4
        let pts: &[u16] = &[0, 0, 10, 0, 0, 10];
        let min = triangle_min_angle(pts, 0, 1, 2);
        let max = triangle_max_angle(pts, 0, 1, 2);
        assert!(
            (min - FRAC_PI_4).abs() < 1e-4,
            "min expected π/4, got {min}"
        );
        assert!(
            (max - FRAC_PI_2).abs() < 1e-4,
            "max expected π/2, got {max}"
        );
    }

    #[test]
    fn triangle_min_le_max() {
        let pts: &[u16] = &[0, 0, 10, 0, 5, 9];
        assert!(triangle_min_angle(pts, 0, 1, 2) <= triangle_max_angle(pts, 0, 1, 2));
    }

    #[test]
    fn triangle_angles_sum_to_pi() {
        let pts: &[u16] = &[0, 0, 10, 0, 0, 10];
        let sum = triangle_angle(pts, 0, 1, 2)
            + triangle_angle(pts, 1, 0, 2)
            + triangle_angle(pts, 2, 0, 1);
        assert!(
            (sum - std::f32::consts::PI).abs() < 1e-4,
            "angles sum: {sum}"
        );
    }

    // ── point_in_triangle_or_on_edge ─────────────────────────────────────────

    #[test]
    fn point_strictly_inside_triangle() {
        // triangle (0,0),(100,0),(50,100), point (50,50)
        let pts: &[u16] = &[0, 0, 100, 0, 50, 100, 50, 50];
        assert!(point_in_triangle_or_on_edge(pts, 3, 0, 1, 2));
    }

    #[test]
    fn point_outside_triangle() {
        let pts: &[u16] = &[0, 0, 100, 0, 50, 100, 200, 200];
        assert!(!point_in_triangle_or_on_edge(pts, 3, 0, 1, 2));
    }

    #[test]
    fn point_on_edge_of_triangle() {
        // triangle (0,0),(10,0),(0,10), point (5,0) on edge 0-1
        let pts: &[u16] = &[0, 0, 10, 0, 0, 10, 5, 0];
        assert!(point_in_triangle_or_on_edge(pts, 3, 0, 1, 2));
    }

    #[test]
    fn point_at_vertex_of_triangle() {
        // point coincides with vertex 0
        let pts: &[u16] = &[0, 0, 10, 0, 0, 10, 0, 0];
        assert!(point_in_triangle_or_on_edge(pts, 3, 0, 1, 2));
    }

    // ── orient_triangle_like_polygon ──────────────────────────────────────────

    #[test]
    fn orient_triangle_already_ccw_stays() {
        // CCW square [0,0, 10,0, 10,10, 0,10]; tri (0,1,2) is CCW
        let pts: &[u16] = &[0, 0, 10, 0, 10, 10, 0, 10];
        assert_eq!(orient_triangle_like_polygon(pts, 1, 0, 1, 2), (0, 1, 2));
    }

    #[test]
    fn orient_triangle_cw_gets_swapped_for_ccw_poly() {
        // Same square; tri (0,2,1) is CW → swap b,c → (0,1,2)
        let pts: &[u16] = &[0, 0, 10, 0, 10, 10, 0, 10];
        assert_eq!(orient_triangle_like_polygon(pts, 1, 0, 2, 1), (0, 1, 2));
    }

    #[test]
    fn orient_triangle_already_cw_stays_for_cw_poly() {
        // poly_sign=-1 (CW), tri (0,2,1) is CW → stays
        let pts: &[u16] = &[0, 0, 10, 0, 10, 10, 0, 10];
        assert_eq!(orient_triangle_like_polygon(pts, -1, 0, 2, 1), (0, 2, 1));
    }

    #[test]
    fn orient_triangle_ccw_swapped_for_cw_poly() {
        // poly_sign=-1, tri (0,1,2) is CCW → swap → (0,2,1)
        let pts: &[u16] = &[0, 0, 10, 0, 10, 10, 0, 10];
        assert_eq!(orient_triangle_like_polygon(pts, -1, 0, 1, 2), (0, 2, 1));
    }
}
