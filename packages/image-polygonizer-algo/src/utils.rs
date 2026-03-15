// ── shared geometry helpers ───────────────────────────────────────────────────

#[inline]
pub(crate) fn gx(pts: &[u16], i: usize) -> f64 {
    pts[i * 2] as f64
}
#[inline]
pub(crate) fn gy(pts: &[u16], i: usize) -> f64 {
    pts[i * 2 + 1] as f64
}

pub(crate) fn orient_raw(ax: f64, ay: f64, bx: f64, by: f64, cx: f64, cy: f64) -> f64 {
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

pub(crate) fn polygon_signed_area(pts: &[u16]) -> f64 {
    let n = pts.len() / 2;
    let mut sum = 0.0f64;
    for i in 0..n {
        let j = (i + 1) % n;
        sum += gx(pts, i) * gy(pts, j) - gx(pts, j) * gy(pts, i);
    }
    sum * 0.5
}

pub(crate) fn triangle_angle(v1x: f64, v1y: f64, v2x: f64, v2y: f64) -> f64 {
    let l1 = (v1x * v1x + v1y * v1y).sqrt();
    let l2 = (v2x * v2x + v2y * v2y).sqrt();
    if l1 == 0.0 || l2 == 0.0 {
        return 0.0;
    }
    let cos = ((v1x * v2x + v1y * v2y) / (l1 * l2)).clamp(-1.0, 1.0);
    cos.acos()
}

pub(crate) fn triangle_min_angle(pts: &[u16], a: usize, b: usize, c: usize) -> f64 {
    let (ax, ay) = (gx(pts, a), gy(pts, a));
    let (bx, by) = (gx(pts, b), gy(pts, b));
    let (cx, cy) = (gx(pts, c), gy(pts, c));
    let aa = triangle_angle(bx - ax, by - ay, cx - ax, cy - ay);
    let ab = triangle_angle(ax - bx, ay - by, cx - bx, cy - by);
    let ac = triangle_angle(ax - cx, ay - cy, bx - cx, by - cy);
    aa.min(ab).min(ac)
}

pub(crate) fn triangle_max_angle(pts: &[u16], a: usize, b: usize, c: usize) -> f64 {
    let (ax, ay) = (gx(pts, a), gy(pts, a));
    let (bx, by) = (gx(pts, b), gy(pts, b));
    let (cx, cy) = (gx(pts, c), gy(pts, c));
    let aa = triangle_angle(bx - ax, by - ay, cx - ax, cy - ay);
    let ab = triangle_angle(ax - bx, ay - by, cx - bx, cy - by);
    let ac = triangle_angle(ax - cx, ay - cy, bx - cx, by - cy);
    aa.max(ab).max(ac)
}

pub(crate) fn point_in_triangle_or_on_edge(
    px: f64,
    py: f64,
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    cx: f64,
    cy: f64,
) -> bool {
    let o1 = orient_raw(ax, ay, bx, by, px, py);
    let o2 = orient_raw(bx, by, cx, cy, px, py);
    let o3 = orient_raw(cx, cy, ax, ay, px, py);
    let has_neg = o1 < 0.0 || o2 < 0.0 || o3 < 0.0;
    let has_pos = o1 > 0.0 || o2 > 0.0 || o3 > 0.0;
    !(has_neg && has_pos)
}

pub(crate) fn orient_triangle_like_polygon(
    pts: &[u16],
    poly_sign: f64,
    a: usize,
    b: usize,
    c: usize,
) -> (usize, usize, usize) {
    let tri_sign = orient_raw(
        gx(pts, a),
        gy(pts, a),
        gx(pts, b),
        gy(pts, b),
        gx(pts, c),
        gy(pts, c),
    );
    if (poly_sign > 0.0 && tri_sign > 0.0) || (poly_sign < 0.0 && tri_sign < 0.0) {
        (a, b, c)
    } else {
        (a, c, b)
    }
}
