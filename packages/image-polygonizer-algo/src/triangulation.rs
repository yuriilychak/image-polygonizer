// ── triangulation ─────────────────────────────────────────────────────────────

use crate::utils::{
    gx, gy, orient_raw, orient_triangle_like_polygon, point_in_triangle_or_on_edge,
    polygon_signed_area, triangle_max_angle, triangle_min_angle,
};

/// Triangulate a simple polygon (flat [x0,y0,...] u16 slice) using ear-clipping
/// (port of `triangulateSimplePolygonAvoidSlivers`), then run two edge-flip passes:
///   1. Basic Lawson flip  (port of `optimizeTrianglesByEdgeFlip` in triangulate.ts)
///   2. Advanced 3-criterion flip (port of `optimizeTrianglesByEdgeFlipRepeated` in triangle-retopology.ts)
///
/// Returns flat u16 slice of triangle vertex indices [a0,b0,c0, ...].
pub(crate) fn triangulate_polygon(polygon: &[u16]) -> Vec<u16> {
    // ── normalise: remove duplicate closing vertex ────────────────────────────
    let raw_n = polygon.len() / 2;
    let pts: &[u16] = if raw_n > 1
        && polygon[0] == polygon[(raw_n - 1) * 2]
        && polygon[1] == polygon[(raw_n - 1) * 2 + 1]
    {
        &polygon[..(raw_n - 1) * 2]
    } else {
        polygon
    };
    let n = pts.len() / 2;

    if n < 3 {
        return Vec::new();
    }
    if n == 3 {
        return vec![0, 1, 2];
    }

    let poly_sign = polygon_signed_area(pts).signum();

    // ── linked list ───────────────────────────────────────────────────────────
    let mut prev = (0..n)
        .map(|i| if i == 0 { n - 1 } else { i - 1 })
        .collect::<Vec<_>>();
    let mut next = (0..n)
        .map(|i| if i == n - 1 { 0 } else { i + 1 })
        .collect::<Vec<_>>();
    let mut alive = vec![true; n];
    let mut active = n;

    let mut tris: Vec<usize> = Vec::with_capacity((n - 2) * 3);

    // ── ear-clipping ──────────────────────────────────────────────────────────
    while active > 3 {
        let start = alive.iter().position(|&a| a).unwrap_or(0);

        let mut best_ear: Option<usize> = None;
        let mut best_score = f64::NEG_INFINITY;

        let mut i = start;
        loop {
            if alive[i] && is_ear(pts, i, &prev, &next, &alive, poly_sign) {
                let score = ear_score(pts, prev[i], i, next[i]);
                if score > best_score {
                    best_score = score;
                    best_ear = Some(i);
                }
            }
            i = next[i];
            if i == start {
                break;
            }
        }

        // fallback: any convex vertex
        if best_ear.is_none() {
            let mut i = start;
            loop {
                if alive[i] && is_convex(pts, prev[i], i, next[i], poly_sign) {
                    best_ear = Some(i);
                    break;
                }
                i = next[i];
                if i == start {
                    break;
                }
            }
        }

        let ear = match best_ear {
            Some(e) => e,
            None => break,
        };

        let a = prev[ear];
        let b = ear;
        let c = next[ear];
        tris.push(a);
        tris.push(b);
        tris.push(c);

        next[a] = c;
        prev[c] = a;
        alive[ear] = false;
        active -= 1;
    }

    // last triangle
    if active == 3 {
        let mut w = alive
            .iter()
            .enumerate()
            .filter(|&(_, &a)| a)
            .map(|(i, _)| i);
        if let (Some(a), Some(b), Some(c)) = (w.next(), w.next(), w.next()) {
            tris.push(a);
            tris.push(b);
            tris.push(c);
        }
    }

    // ── phase 1: basic Lawson flip ────────────────────────────────────────────
    flip_edges_basic(pts, poly_sign, &mut tris);

    // ── phase 2: advanced 3-criterion flip ───────────────────────────────────
    flip_edges_advanced(pts, poly_sign, &mut tris, 10);

    tris.iter().map(|&v| v as u16).collect()
}

// ── ear clipping helpers ──────────────────────────────────────────────────────

fn is_convex(pts: &[u16], a: usize, b: usize, c: usize, poly_sign: f64) -> bool {
    let cross = orient_raw(
        gx(pts, a),
        gy(pts, a),
        gx(pts, b),
        gy(pts, b),
        gx(pts, c),
        gy(pts, c),
    );
    if poly_sign >= 0.0 {
        cross > 0.0
    } else {
        cross < 0.0
    }
}

fn is_ear(
    pts: &[u16],
    i: usize,
    prev: &[usize],
    next: &[usize],
    alive: &[bool],
    poly_sign: f64,
) -> bool {
    let a = prev[i];
    let b = i;
    let c = next[i];
    if !is_convex(pts, a, b, c, poly_sign) {
        return false;
    }
    let (ax, ay) = (gx(pts, a), gy(pts, a));
    let (bx, by) = (gx(pts, b), gy(pts, b));
    let (cx, cy) = (gx(pts, c), gy(pts, c));
    let (min_x, max_x) = (ax.min(bx).min(cx), ax.max(bx).max(cx));
    let (min_y, max_y) = (ay.min(by).min(cy), ay.max(by).max(cy));
    for (p, &al) in alive.iter().enumerate() {
        if !al || p == a || p == b || p == c {
            continue;
        }
        let (px, py) = (gx(pts, p), gy(pts, p));
        if px < min_x || px > max_x || py < min_y || py > max_y {
            continue;
        }
        if point_in_triangle_or_on_edge(px, py, ax, ay, bx, by, cx, cy) {
            return false;
        }
    }
    true
}

fn ear_score(pts: &[u16], a: usize, b: usize, c: usize) -> f64 {
    let min_a = triangle_min_angle(pts, a, b, c);
    let max_a = triangle_max_angle(pts, a, b, c);
    let area2 = orient_raw(
        gx(pts, a),
        gy(pts, a),
        gx(pts, b),
        gy(pts, b),
        gx(pts, c),
        gy(pts, c),
    )
    .abs();
    min_a * 100000.0 - max_a * 10.0 + area2
}

// ── edge-flip helpers ─────────────────────────────────────────────────────────

/// Build an edge list in insertion order.
/// Each entry: (u, v, first_tri_base_idx, second_tri_base_idx).
/// u = min(vertex), v = max(vertex). Second slot is usize::MAX if boundary.
fn build_edge_list(tris: &[usize]) -> Vec<(usize, usize, usize, usize)> {
    let nt = tris.len() / 3;
    let mut edges: Vec<(usize, usize, usize, usize)> = Vec::new();
    for i in 0..nt {
        let ia = i * 3;
        let verts = [tris[ia], tris[ia + 1], tris[ia + 2]];
        for k in 0..3 {
            let (eu, ev) = (verts[k], verts[(k + 1) % 3]);
            let (u, v) = if eu < ev { (eu, ev) } else { (ev, eu) };
            let mut found = false;
            for e in edges.iter_mut() {
                if e.0 == u && e.1 == v {
                    e.3 = ia;
                    found = true;
                    break;
                }
            }
            if !found {
                edges.push((u, v, ia, usize::MAX));
            }
        }
    }
    edges
}

/// Return the vertex in triangle at base index `ia` that is neither `u` nor `v`.
fn third_vertex(tris: &[usize], ia: usize, u: usize, v: usize) -> usize {
    let (a, b, c) = (tris[ia], tris[ia + 1], tris[ia + 2]);
    if a != u && a != v {
        a
    } else if b != u && b != v {
        b
    } else if c != u && c != v {
        c
    } else {
        usize::MAX
    }
}

/// Quad with all 4 consecutive turns matching `poly_sign` (strictly convex).
fn is_convex_quad(pts: &[u16], poly_sign: f64, a: usize, b: usize, c: usize, d: usize) -> bool {
    let o1 = orient_raw(
        gx(pts, a),
        gy(pts, a),
        gx(pts, b),
        gy(pts, b),
        gx(pts, c),
        gy(pts, c),
    );
    let o2 = orient_raw(
        gx(pts, b),
        gy(pts, b),
        gx(pts, c),
        gy(pts, c),
        gx(pts, d),
        gy(pts, d),
    );
    let o3 = orient_raw(
        gx(pts, c),
        gy(pts, c),
        gx(pts, d),
        gy(pts, d),
        gx(pts, a),
        gy(pts, a),
    );
    let o4 = orient_raw(
        gx(pts, d),
        gy(pts, d),
        gx(pts, a),
        gy(pts, a),
        gx(pts, b),
        gy(pts, b),
    );
    if poly_sign > 0.0 {
        o1 > 0.0 && o2 > 0.0 && o3 > 0.0 && o4 > 0.0
    } else {
        o1 < 0.0 && o2 < 0.0 && o3 < 0.0 && o4 < 0.0
    }
}

/// min and max angles across both triangles of a quad diagonal (u,v | w1,w2).
fn pair_angles(pts: &[u16], u: usize, v: usize, w1: usize, w2: usize) -> (f64, f64) {
    let min1 = triangle_min_angle(pts, u, v, w1);
    let max1 = triangle_max_angle(pts, u, v, w1);
    let min2 = triangle_min_angle(pts, v, u, w2);
    let max2 = triangle_max_angle(pts, v, u, w2);
    (min1.min(min2), max1.max(max2))
}

fn diag_len_sq(pts: &[u16], a: usize, b: usize) -> f64 {
    let dx = gx(pts, a) - gx(pts, b);
    let dy = gy(pts, a) - gy(pts, b);
    dx * dx + dy * dy
}

// ── Phase 1: basic Lawson flip ────────────────────────────────────────────────
// Port of `optimizeTrianglesByEdgeFlip` in triangulate.ts.
fn flip_edges_basic(pts: &[u16], poly_sign: f64, tris: &mut Vec<usize>) {
    if tris.len() < 6 {
        return;
    }
    let mut changed = true;
    let mut guard = 0u32;
    while changed && guard < 1000 {
        changed = false;
        guard += 1;
        let edges = build_edge_list(tris);
        'el: for &(eu, ev, ia, ib) in &edges {
            if ib == usize::MAX {
                continue;
            }
            let w1 = third_vertex(tris, ia, eu, ev);
            let w2 = third_vertex(tris, ib, eu, ev);
            if w1 == usize::MAX || w2 == usize::MAX || w1 == w2 {
                continue;
            }
            if !is_convex_quad(pts, poly_sign, w1, eu, w2, ev) {
                continue;
            }
            let score_before =
                triangle_min_angle(pts, eu, ev, w1).min(triangle_min_angle(pts, ev, eu, w2));
            let score_after =
                triangle_min_angle(pts, w1, w2, eu).min(triangle_min_angle(pts, w2, w1, ev));
            if score_after <= score_before {
                continue;
            }
            let (f1a, f1b, f1c) = orient_triangle_like_polygon(pts, poly_sign, w1, w2, eu);
            let (f2a, f2b, f2c) = orient_triangle_like_polygon(pts, poly_sign, w2, w1, ev);
            tris[ia] = f1a;
            tris[ia + 1] = f1b;
            tris[ia + 2] = f1c;
            tris[ib] = f2a;
            tris[ib + 1] = f2b;
            tris[ib + 2] = f2c;
            changed = true;
            break 'el;
        }
    }
}

// ── Phase 2: advanced 3-criterion flip ───────────────────────────────────────
// Port of `optimizeTrianglesByEdgeFlipRepeated` in triangle-retopology.ts.
fn flip_edges_advanced(pts: &[u16], poly_sign: f64, tris: &mut Vec<usize>, max_passes: u32) {
    if tris.len() < 6 {
        return;
    }
    let mut changed = true;
    let mut pass = 0u32;
    while changed && pass < max_passes {
        changed = false;
        pass += 1;
        let edges = build_edge_list(tris);
        'el: for &(eu, ev, ia, ib) in &edges {
            if ib == usize::MAX {
                continue;
            }
            let w1 = third_vertex(tris, ia, eu, ev);
            let w2 = third_vertex(tris, ib, eu, ev);
            if w1 == usize::MAX || w2 == usize::MAX || w1 == w2 {
                continue;
            }
            let convex = [
                (w1, eu, w2, ev),
                (w1, ev, w2, eu),
                (w2, eu, w1, ev),
                (w2, ev, w1, eu),
            ]
            .iter()
            .any(|&(a, b, c, d)| is_convex_quad(pts, poly_sign, a, b, c, d));
            if !convex {
                continue;
            }
            let (min_b, max_b) = pair_angles(pts, eu, ev, w1, w2);
            let (min_a, max_a) = pair_angles(pts, w1, w2, eu, ev);
            let diag_b = diag_len_sq(pts, eu, ev);
            let diag_a = diag_len_sq(pts, w1, w2);
            const EPS: f64 = 1e-9;
            let better = if min_a > min_b + EPS {
                true
            } else if min_a < min_b - EPS {
                false
            } else if max_a < max_b - EPS {
                true
            } else if max_a > max_b + EPS {
                false
            } else {
                diag_a < diag_b
            };
            if !better {
                continue;
            }
            let (f1a, f1b, f1c) = orient_triangle_like_polygon(pts, poly_sign, w1, w2, eu);
            let (f2a, f2b, f2c) = orient_triangle_like_polygon(pts, poly_sign, w2, w1, ev);
            tris[ia] = f1a;
            tris[ia + 1] = f1b;
            tris[ia + 2] = f1c;
            tris[ib] = f2a;
            tris[ib + 1] = f2b;
            tris[ib + 2] = f2c;
            changed = true;
            break 'el;
        }
    }
}
