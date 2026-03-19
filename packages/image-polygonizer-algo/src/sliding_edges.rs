use crate::utils::{
    cross2, gpair, normalize_contour, orient, polygon_signed_area2, segments_intersect,
};

struct SlidingPoly {
    pts: Vec<u16>,
}

impl SlidingPoly {
    fn new(cover: &[u16]) -> Self {
        SlidingPoly {
            pts: cover.to_vec(),
        }
    }

    fn count(&self) -> usize {
        self.pts.len() / 2
    }

    fn set(&mut self, i: usize, x: i32, y: i32) {
        self.pts[i * 2] = x as u16;
        self.pts[i * 2 + 1] = y as u16;
    }

    fn mod_idx(&self, i: i32) -> usize {
        let n = self.count() as i32;
        ((i % n + n) % n) as usize
    }
}

fn gcd_i(a: i32, b: i32) -> i32 {
    let mut a = a;
    let mut b = b;
    while b != 0 {
        let t = a % b;
        a = b;
        b = t;
    }
    if a == 0 {
        1
    } else {
        a
    }
}

fn primitive_dir(pts: &[u16], a: usize, b: usize) -> (i32, i32) {
    let (ax, ay): (i32, i32) = gpair(pts, a);
    let (bx, by): (i32, i32) = gpair(pts, b);
    let dx = ax - bx;
    let dy = ay - by;
    if dx == 0 && dy == 0 {
        return (0, 0);
    }
    let g = gcd_i(dx.abs(), dy.abs());
    (dx / g, dy / g)
}

fn point_on_seg_i32(poly: &[u16], a: usize, b: usize, witnesses: &[u16], p: usize) -> bool {
    let (ax, ay): (u16, u16) = gpair(poly, a);
    let (bx, by): (u16, u16) = gpair(poly, b);
    let (px, py): (u16, u16) = gpair(witnesses, p);
    cross2(&poly, witnesses, a, b, p) == 0
        && px >= ax.min(bx)
        && px <= ax.max(bx)
        && py >= ay.min(by)
        && py <= ay.max(by)
}

fn point_in_poly_or_on_edge(poly: &SlidingPoly, witnesses: &[u16], witness_idx: usize) -> bool {
    let (px, py): (i32, i32) = gpair(witnesses, witness_idx);

    let n = poly.count();
    let mut inside = false;
    let mut j = n - 1;
    for i in 0..n {
        if point_on_seg_i32(&poly.pts, j, i, witnesses, witness_idx) {
            return true;
        }
        let (xi, yi): (i32, i32) = gpair(&poly.pts, i);
        let (xj, yj): (i32, i32) = gpair(&poly.pts, j);
        if (yi > py) != (yj > py) {
            let t = (xj - xi) as f32 * (py - yi) as f32 / (yj - yi) as f32 + xi as f32;
            if (px as f32) <= t {
                inside = !inside;
            }
        }
        j = i;
    }
    inside
}

fn reduce_collinear(contour: &[u16]) -> Vec<u16> {
    let norm = normalize_contour(contour);
    let n = norm.len() / 2;
    if n <= 3 {
        return norm;
    }
    let mut keep = Vec::new();
    for i in 0..n {
        let prev = (i + n - 1) % n;
        let next = (i + 1) % n;
        let cross = orient(&norm, &norm, prev, i, next);
        let (ax, ay): (u16, u16) = gpair(&norm, prev);
        let (bx, by): (u16, u16) = gpair(&norm, i);
        let (cx, cy): (u16, u16) = gpair(&norm, next);
        let between = bx >= ax.min(cx) && bx <= ax.max(cx) && by >= ay.min(cy) && by <= ay.max(cy);
        if cross != 0 || !between {
            keep.push(i);
        }
    }
    if keep.len() < 3 {
        return norm;
    }
    let mut out = Vec::with_capacity(keep.len() * 2);
    for &k in &keep {
        let (x, y): (u16, u16) = gpair(&norm, k);
        out.push(x);
        out.push(y);
    }
    out
}

fn would_self_intersect_after_slide(poly: &SlidingPoly, i1: usize, i2: usize) -> bool {
    let n = poly.count();
    let i0 = poly.mod_idx(i1 as i32 - 1);
    let i3 = poly.mod_idx(i2 as i32 + 1);
    let changed = [(i0, i1), (i1, i2), (i2, i3)];
    fn shares(a0: usize, a1: usize, b0: usize, b1: usize) -> bool {
        a0 == b0 || a0 == b1 || a1 == b0 || a1 == b1
    }
    fn in_changed(a: usize, b: usize, ch: &[(usize, usize)]) -> bool {
        ch.iter().any(|&(x, y)| x == a && y == b)
    }
    for &(ca, cb) in &changed {
        for i in 0..n {
            let j = (i + 1) % n;
            if !shares(ca, cb, i, j)
                && !in_changed(i, j, &changed)
                && segments_intersect(&poly.pts, ca, cb, &poly.pts, i, j)
            {
                return true;
            }
        }
    }
    for ii in 0..changed.len() {
        let (a0, a1) = changed[ii];
        for jj in (ii + 1)..changed.len() {
            let (b0, b1) = changed[jj];
            if !shares(a0, a1, b0, b1) && segments_intersect(&poly.pts, a0, a1, &poly.pts, b0, b1) {
                return true;
            }
        }
    }
    false
}

fn has_degenerate_local(poly: &SlidingPoly, i0: usize, i1: usize, i2: usize, i3: usize) -> bool {
    gpair::<u16>(&poly.pts, i0) == gpair::<u16>(&poly.pts, i1)
        || gpair::<u16>(&poly.pts, i1) == gpair::<u16>(&poly.pts, i2)
        || gpair::<u16>(&poly.pts, i2) == gpair::<u16>(&poly.pts, i3)
}

fn all_witnesses_inside(poly: &SlidingPoly, witnesses: &[u16], xs: &[i32], ys: &[i32]) -> bool {
    debug_assert_eq!(xs.len(), ys.len());

    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;

    for (&x, &y) in xs.iter().zip(ys.iter()) {
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }

    // add the small safety margin used by the original algorithm
    min_x -= 2;
    min_y -= 2;
    max_x += 2;
    max_y += 2;

    let nw = witnesses.len() / 2;
    for i in 0..nw {
        let (wx, wy): (i32, i32) = gpair(witnesses, i);
        if wx >= min_x
            && wx <= max_x
            && wy >= min_y
            && wy <= max_y
            && !point_in_poly_or_on_edge(poly, witnesses, i)
        {
            return false;
        }
    }
    true
}

fn improve_sliding_edge(poly: &mut SlidingPoly, edge_start: usize, witnesses: &[u16]) -> bool {
    let count = poly.count();
    if count < 4 {
        return false;
    }
    let i0 = poly.mod_idx(edge_start as i32 - 1);
    let i1 = edge_start;
    let i2 = poly.mod_idx(edge_start as i32 + 1);
    let i3 = poly.mod_idx(edge_start as i32 + 2);
    let dir_a = primitive_dir(&poly.pts, i1, i0);
    let dir_b = primitive_dir(&poly.pts, i2, i3);
    if dir_a == (0, 0) || dir_b == (0, 0) {
        return false;
    }

    // i0 and i3 are not affected by sliding — read once.
    let (i0x, i0y): (i32, i32) = gpair(&poly.pts, i0);
    let (i3x, i3y): (i32, i32) = gpair(&poly.pts, i3);

    const STEP_COMBOS: [(i32, i32); 8] = [
        (1, 0),
        (-1, 0),
        (0, 1),
        (0, -1),
        (1, 1),
        (1, -1),
        (-1, 1),
        (-1, -1),
    ];
    let mut any_improved = false;
    loop {
        let (old_ax, old_ay): (i32, i32) = gpair(&poly.pts, i1);
        let (old_bx, old_by): (i32, i32) = gpair(&poly.pts, i2);
        let cur_area = polygon_signed_area2(&poly.pts).abs();
        let mut best_area = cur_area;
        let mut best_step: Option<(i32, i32)> = None;
        for &(sa, sb) in &STEP_COMBOS {
            let ax = old_ax + dir_a.0 * sa;
            let ay = old_ay + dir_a.1 * sa;
            let bx = old_bx + dir_b.0 * sb;
            let by = old_by + dir_b.1 * sb;
            if ax == bx && ay == by {
                continue;
            }
            poly.set(i1, ax, ay);
            poly.set(i2, bx, by);
            if has_degenerate_local(poly, i0, i1, i2, i3)
                || would_self_intersect_after_slide(poly, i1, i2)
            {
                poly.set(i1, old_ax, old_ay);
                poly.set(i2, old_bx, old_by);
                continue;
            }
            let area = polygon_signed_area2(&poly.pts).abs();
            if area < best_area {
                let xs = [i0x, ax, bx, i3x, old_ax, old_bx];
                let ys = [i0y, ay, by, i3y, old_ay, old_by];
                if all_witnesses_inside(poly, witnesses, &xs, &ys) {
                    best_area = area;
                    best_step = Some((sa, sb));
                }
            }
            poly.set(i1, old_ax, old_ay);
            poly.set(i2, old_bx, old_by);
        }
        let Some((sa, sb)) = best_step else {
            return any_improved;
        };

        // Walk in the chosen direction as far as beneficial.
        let mut moved = false;
        let mut area_before = cur_area;
        loop {
            let (cur_ax, cur_ay): (i32, i32) = gpair(&poly.pts, i1);
            let (cur_bx, cur_by): (i32, i32) = gpair(&poly.pts, i2);
            let next_ax = cur_ax + dir_a.0 * sa;
            let next_ay = cur_ay + dir_a.1 * sa;
            let next_bx = cur_bx + dir_b.0 * sb;
            let next_by = cur_by + dir_b.1 * sb;
            if next_ax == next_bx && next_ay == next_by {
                break;
            }
            poly.set(i1, next_ax, next_ay);
            poly.set(i2, next_bx, next_by);
            let area_after = polygon_signed_area2(&poly.pts).abs();
            let xs = [i0x, next_ax, next_bx, i3x, cur_ax, cur_bx];
            let ys = [i0y, next_ay, next_by, i3y, cur_ay, cur_by];

            if has_degenerate_local(poly, i0, i1, i2, i3)
                || would_self_intersect_after_slide(poly, i1, i2)
                || area_after >= area_before
                || !all_witnesses_inside(poly, witnesses, &xs, &ys)
            {
                poly.set(i1, cur_ax, cur_ay);
                poly.set(i2, cur_bx, cur_by);
                break;
            }

            area_before = area_after;
            moved = true;
            any_improved = true;
        }
        if !moved {
            return any_improved;
        }
    }
}

pub(crate) fn refine_by_sliding_edges(original: &[u16], cover: &[u16]) -> Vec<u16> {
    let witnesses = reduce_collinear(original);
    let cover_norm = normalize_contour(cover);
    let count = cover_norm.len() / 2;
    if count <= 3 {
        return cover_norm;
    }
    let mut poly = SlidingPoly::new(&cover_norm);
    let mut improved = true;
    while improved {
        improved = false;
        let vert_count = poly.count();
        for edge in 0..vert_count {
            if improve_sliding_edge(&mut poly, edge, &witnesses) {
                improved = true;
            }
        }
    }
    poly.pts.clone()
}
