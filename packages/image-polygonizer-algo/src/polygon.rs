// ── polygon simplification and filtering ─────────────────────────────────────

use crate::utils::{dist2i, gx, gy, orient_poly, polygon_signed_area2};

// ── contour_to_polygon ────────────────────────────────────────────────────────

/// Process a raw contour through 5 pipeline steps and return the final polygon:
///   1. RDP simplification with self-intersection removal
///   2. Iterative relax+simplify (removeSmallPits + removeObtuseHumps + RDP loop)
///   3. removeSmallestPitsUntilMaxPointCount
///   4. extendSimplifiedContourToCoverOriginal
///   5. refineCoveringContourBySlidingEdgesGreedy
///
/// `contour` is a flat [x0,y0,...] u16 array, `min_distance` is the RDP epsilon,
/// `max_point_count` is the max vertex count for the output polygon.
pub(crate) fn contour_to_polygon(
    contour: &[u16],
    min_distance: u8,
    max_point_count: u8,
) -> Vec<u16> {
    // ── step 1: RDP simplification ────────────────────────────────────────────
    let step1 = rdp_simplify_no_self_intersections(contour, min_distance);

    if step1.len() < 6 {
        return step1;
    }

    // ── step 2: iterative relax+simplify ─────────────────────────────────────
    let step2 = iterative_relax_and_simplify(
        &step1,
        0.008_f32,
        170.0_f32.to_radians(),
        260.0_f32.to_radians(),
        120.0_f32.to_radians(),
        min_distance,
    );

    if step2.len() < 6 {
        return step2;
    }

    // ── step 3: remove pits until max_point_count ────────────────────────────
    let step3 = remove_smallest_pits_until_max_count(&step2, max_point_count as usize);

    if step3.len() < 6 {
        return step3;
    }

    // ── step 4: extend to cover original ─────────────────────────────────────
    let step4 = extend_to_cover_original(contour, &step3);

    if step4.len() < 6 {
        return step4;
    }

    // ── step 5: refine by sliding edges ──────────────────────────────────────
    refine_by_sliding_edges(contour, &step4)
}

// ── Shared low-level helpers ──────────────────────────────────────────────────

/// Normalize a closed contour: remove duplicate last==first vertex if present.
fn normalize_contour(pts: &[u16]) -> Vec<u16> {
    let n = pts.len() / 2;
    if n > 1 && gx(pts, 0) == gx(pts, n - 1) && gy(pts, 0) == gy(pts, n - 1) {
        pts[..(n - 1) * 2].to_vec()
    } else {
        pts.to_vec()
    }
}

#[inline]
fn cross2(pts1: &[u16], pts2: &[u16], a: usize, b: usize, c: usize) -> i32 {
    let (ax, ay) = (gx(pts1, a), gy(pts1, a));
    let (bx, by) = (gx(pts1, b), gy(pts1, b));
    let (cx, cy) = (gx(pts2, c), gy(pts2, c));

    let (bax, cby) = (bx as i16 - ax as i16, cy as i16 - by as i16);
    let (bay, cbx) = (by as i16 - ay as i16, cx as i16 - bx as i16);
    bax as i32 * cby as i32 - bay as i32 * cbx as i32
}

#[inline]
fn dist2(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x2 - x1;
    let dy = y2 - y1;
    dx * dx + dy * dy
}

/// Segment intersection (proper + collinear endpoint cases).
fn segments_intersect(a: &[u16], a0: usize, a1: usize, b: &[u16], b0: usize, b1: usize) -> bool {
    #[inline]
    fn on_seg(a: &[u16], a0: usize, a1: usize, b: &[u16], p: usize) -> bool {
        let ax = gx(a, a0);
        let ay = gy(a, a0);
        let bx = gx(a, a1);
        let by = gy(a, a1);
        let px = gx(b, p);
        let py = gy(b, p);
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

// ── Linked-list state for contour operations ──────────────────────────────────

struct LinkedState {
    pts: Vec<u16>, // flat [x0,y0,x1,y1,...] original coords
    prev: Vec<usize>,
    next: Vec<usize>,
    alive: Vec<bool>,
    active: usize,
}

impl LinkedState {
    fn new(pts: Vec<u16>) -> Self {
        let n = pts.len() / 2;
        let prev = (0..n).map(|i| if i == 0 { n - 1 } else { i - 1 }).collect();
        let next = (0..n).map(|i| if i == n - 1 { 0 } else { i + 1 }).collect();
        let alive = vec![true; n];
        LinkedState {
            pts,
            prev,
            next,
            alive,
            active: n,
        }
    }

    fn signed_area2(&self) -> i32 {
        polygon_signed_area2(&self.materialize())
    }

    fn remove(&mut self, idx: usize) {
        let p = self.prev[idx];
        let n = self.next[idx];
        self.next[p] = n;
        self.prev[n] = p;
        self.alive[idx] = false;
        self.active -= 1;
    }

    fn would_create_self_intersection_after_removal(&self, curr: usize) -> bool {
        if self.active <= 3 {
            return false;
        }
        let prev = self.prev[curr];
        let next = self.next[curr];
        let start = match self.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => return false,
        };
        let mut e0 = start;
        loop {
            let e1 = self.next[e0];
            let skip =
                e0 == prev || e1 == prev || e0 == curr || e1 == curr || e0 == next || e1 == next;
            if !skip && segments_intersect(&self.pts, prev, next, &self.pts, e0, e1) {
                return true;
            }
            e0 = self.next[e0];
            if e0 == start {
                break;
            }
        }
        false
    }

    fn materialize(&self) -> Vec<u16> {
        let mut out = Vec::with_capacity(self.active * 2);
        let start = match self.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => return out,
        };
        let mut cur = start;
        loop {
            out.push(gx(&self.pts, cur));
            out.push(gy(&self.pts, cur));
            cur = self.next[cur];
            if cur == start {
                break;
            }
        }
        out
    }
}

// ── Step 1: RDP simplification ────────────────────────────────────────────────

fn rdp_simplify_no_self_intersections(contour: &[u16], epsilon: u8) -> Vec<u16> {
    let normalized = normalize_contour(contour);
    let n = normalized.len() / 2;
    if n < 3 {
        return normalized;
    }

    let anchor = rdp_find_anchor(&normalized, n);
    let split = rdp_find_farthest(&normalized, n, anchor);
    if split == anchor {
        return normalized;
    }

    let eps_sq = (epsilon as u16) * (epsilon as u16);
    let arc1 = rdp_build_arc(n, anchor, split);
    let arc2 = rdp_build_arc(n, split, anchor);
    let keep1 = rdp_simplify_open(&normalized, &arc1, eps_sq);
    let keep2 = rdp_simplify_open(&normalized, &arc2, eps_sq);
    let mut kept = rdp_merge_arcs(&arc1, &keep1, &arc2, &keep2);

    if kept.len() < 3 {
        return normalized;
    }

    rdp_resolve_self_intersections(&normalized, &mut kept, eps_sq);
    if kept.len() < 3 {
        return normalized;
    }

    rdp_cleanup_redundant(&normalized, &mut kept, eps_sq);
    if kept.len() < 3 {
        return normalized;
    }

    rdp_materialize(&normalized, &kept)
}

fn rdp_find_anchor(pts: &[u16], n: usize) -> usize {
    let mut anchor = 0;
    let (mut mx, mut my) = (gx(pts, 0), gy(pts, 0));
    for i in 1..n {
        let x = gx(pts, i);
        let y = gy(pts, i);
        if x < mx || (x == mx && y < my) {
            anchor = i;
            mx = x;
            my = y;
        }
    }
    anchor
}

fn rdp_find_farthest(pts: &[u16], n: usize, anchor: usize) -> usize {
    let mut best = anchor;
    let mut best_d = -1i32;
    for i in 0..n {
        if i == anchor {
            continue;
        }
        let d = dist2i(pts, i, anchor);
        if d > best_d {
            best_d = d;
            best = i;
        }
    }
    best
}

fn rdp_build_arc(n: usize, start: usize, end: usize) -> Vec<usize> {
    let mut arc = Vec::new();
    let mut cur = start;
    loop {
        arc.push(cur);
        if cur == end {
            break;
        }
        cur = (cur + 1) % n;
    }
    arc
}

fn rdp_point_line_dist_sq(pts: &[u16], p: usize, a: usize, b: usize) -> f32 {
    let len_sq = dist2i(pts, a, b);
    if len_sq == 0 {
        return dist2i(pts, a, p) as f32;
    }
    let cross = cross2(pts, pts, a, b, p);
    cross as f32 * cross as f32 / len_sq as f32
}

fn rdp_simplify_open(pts: &[u16], indices: &[usize], eps_sq: u16) -> Vec<bool> {
    let n = indices.len();
    let mut keep = vec![false; n];
    if n <= 2 {
        for k in keep.iter_mut() {
            *k = true;
        }
        return keep;
    }
    keep[0] = true;
    keep[n - 1] = true;
    let eps_sq = eps_sq as f32;
    let mut stack: Vec<(usize, usize)> = vec![(0, n - 1)];
    while let Some((start, end)) = stack.pop() {
        if end - start <= 1 {
            continue;
        }
        let a = indices[start];
        let b = indices[end];
        let mut max_d = -1.0f32;
        let mut max_i = start;
        for i in (start + 1)..end {
            let d = rdp_point_line_dist_sq(pts, indices[i], a, b);
            if d > max_d {
                max_d = d;
                max_i = i;
            }
        }
        if max_d > eps_sq {
            keep[max_i] = true;
            stack.push((start, max_i));
            stack.push((max_i, end));
        }
    }
    keep
}

fn rdp_merge_arcs(arc1: &[usize], keep1: &[bool], arc2: &[usize], keep2: &[bool]) -> Vec<usize> {
    let mut kept = Vec::new();
    for (i, &k) in keep1.iter().enumerate() {
        if k {
            kept.push(arc1[i]);
        }
    }
    for (i, &k) in keep2[1..keep2.len() - 1].iter().enumerate() {
        if k {
            kept.push(arc2[i + 1]);
        }
    }
    kept
}

fn rdp_is_adjacent(a: usize, b: usize, n: usize) -> bool {
    a == b || (a + 1) % n == b || (b + 1) % n == a
}

fn rdp_same_pt(pts: &[u16], a: usize, b: usize) -> bool {
    gx(pts, a) == gx(pts, b) && gy(pts, a) == gy(pts, b)
}

fn rdp_find_self_intersection(pts: &[u16], kept: &[usize]) -> Option<(usize, usize)> {
    let m = kept.len();
    for ea in 0..m {
        let a0 = kept[ea];
        let a1 = kept[(ea + 1) % m];
        for eb in (ea + 1)..m {
            let b0 = kept[eb];
            let b1 = kept[(eb + 1) % m];

            if !(rdp_is_adjacent(ea, eb, m)
                || rdp_same_pt(pts, a0, b0)
                || rdp_same_pt(pts, a0, b1)
                || rdp_same_pt(pts, a1, b0)
                || rdp_same_pt(pts, a1, b1))
                && segments_intersect(pts, a0, a1, pts, b0, b1)
            {
                return Some((ea, eb));
            }
        }
    }
    None
}

fn rdp_find_worst_on_arc(pts: &[u16], n: usize, start: usize, end: usize) -> (i32, f32) {
    let mut cur = (start + 1) % n;
    let mut max_d = -1.0f32;
    let mut max_p = -1i32;
    while cur != end {
        let d = rdp_point_line_dist_sq(pts, cur, start, end);
        if d > max_d {
            max_d = d;
            max_p = cur as i32;
        }
        cur = (cur + 1) % n;
    }
    (max_p, max_d)
}

fn rdp_resolve_self_intersections(pts: &[u16], kept: &mut Vec<usize>, eps_sq: u16) {
    let n = pts.len() / 2;
    for _ in 0..(n * 2) {
        let Some((ea, eb)) = rdp_find_self_intersection(pts, kept) else {
            return;
        };
        let (pa, da) = rdp_find_worst_on_arc(pts, n, kept[ea], kept[(ea + 1) % kept.len()]);
        let (pb, db) = rdp_find_worst_on_arc(pts, n, kept[eb], kept[(eb + 1) % kept.len()]);
        let can_a = pa >= 0 && da > 0.0;
        let can_b = pb >= 0 && db > 0.0;
        if !can_a && !can_b {
            return;
        }
        if can_a && (!can_b || da >= db) {
            if !kept.contains(&(pa as usize)) {
                kept.insert(ea + 1, pa as usize);
            }
        } else {
            if !kept.contains(&(pb as usize)) {
                kept.insert(eb + 1, pb as usize);
            }
        }
        rdp_cleanup_redundant(pts, kept, eps_sq);
    }
}

fn rdp_arc_fits_eps(pts: &[u16], n: usize, start: usize, end: usize, eps_sq: u16) -> bool {
    let mut cur = (start + 1) % n;
    while cur != end {
        if rdp_point_line_dist_sq(pts, cur, start, end) > eps_sq as f32 {
            return false;
        }
        cur = (cur + 1) % n;
    }
    true
}

fn rdp_cleanup_redundant(pts: &[u16], kept: &mut Vec<usize>, eps_sq: u16) {
    if kept.len() <= 3 {
        return;
    }
    let n = pts.len() / 2;
    let mut changed = true;
    while changed && kept.len() > 3 {
        changed = false;
        for i in 0..kept.len() {
            let prev = kept[(i + kept.len() - 1) % kept.len()];
            let next = kept[(i + 1) % kept.len()];
            if rdp_arc_fits_eps(pts, n, prev, next, eps_sq) {
                let removed = kept.remove(i);
                if rdp_find_self_intersection(pts, kept).is_some() {
                    kept.insert(i, removed);
                } else {
                    changed = true;
                    break;
                }
            }
        }
    }
}

fn rdp_materialize(pts: &[u16], kept: &[usize]) -> Vec<u16> {
    let mut out = Vec::with_capacity(kept.len() * 2);
    for &k in kept {
        out.push(gx(pts, k));
        out.push(gy(pts, k));
    }
    out
}

// ── Step 2: iterative relax+simplify ─────────────────────────────────────────

fn interior_angle_rad(pts: &[u16], a: usize, b: usize, c: usize, orientation_sign: i8) -> f32 {


    let l1_sq = dist2i(pts, b, a);
    let l2_sq = dist2i(pts, b, c);
    if l1_sq == 0 || l2_sq == 0 {
        return 0.0;
    }
    let ax = gx(pts, a);
    let ay = gy(pts, a);
    let bx = gx(pts, b);
    let by = gy(pts, b);
    let cx = gx(pts, c);
    let cy = gy(pts, c);
    let v1x = (ax as i16 - bx as i16) as f32;
    let v1y = (ay as i16 - by as i16) as f32;
    let v2x = (cx as i16 - bx as i16) as f32;
    let v2y = (cy as i16 - by as i16) as f32;
    let l1 = (l1_sq as f32).sqrt();
    let l2 = (l2_sq as f32).sqrt();
    let cos = ((v1x * v2x + v1y * v2y) / (l1 * l2)).clamp(-1.0, 1.0);
    let small_angle = cos.acos();
    // cross = v1 × v2 = -cross2(ax,ay,bx,by,cx,cy), so comparisons are flipped
    let cross = v1x * v2y - v1y * v2x;
    let is_convex = orientation_sign > 0 && cross < 0.0 || cross > 0.0;

    if is_convex {
        small_angle
    } else {
        2.0 * std::f32::consts::PI - small_angle
    }
}

fn remove_small_pits(pts: Vec<u16>, percentage: f32, hole_angle_rad: f32) -> Vec<u16> {
    let normalized = normalize_contour(&pts);
    let n = normalized.len() / 2;
    if n <= 3 {
        return normalized;
    }
    let mut state = LinkedState::new(normalized);
    let signed = state.signed_area2();
    let total_area = signed.abs();
    if total_area == 0 {
        return state.materialize();
    }
    let threshold = total_area as f32 * percentage;
    let orient_sign: i8 = if signed >= 0 { 1 } else { -1 };
    let mut changed = true;
    while changed && state.active > 3 {
        changed = false;
        let start = match state.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => break,
        };
        let mut visited = 0;
        let limit = state.active;
        let mut i = start;
        while visited < limit && state.active > 3 {
            let curr = i;
            i = state.next[curr];
            visited += 1;
            if !state.alive[curr] {
                continue;
            }
            let prev = state.prev[curr];
            let next = state.next[curr];
            let cross = cross2(&state.pts, &state.pts, prev, curr, next);
            let is_concave = orient_sign > 0 && cross < 0 || cross > 0;
            if !is_concave
                || cross.abs() as f32 > threshold
                    && interior_angle_rad(&state.pts, prev, curr, next, orient_sign)
                        <= hole_angle_rad
                || state.would_create_self_intersection_after_removal(curr)
            {
                continue;
            }
            state.remove(curr);
            changed = true;
        }
    }
    state.materialize()
}

fn remove_obtuse_humps(
    pts: Vec<u16>,
    percentage: f32,
    angle_threshold_rad: f32,
    pick_angle_rad: f32,
) -> Vec<u16> {
    let normalized = normalize_contour(&pts);
    let n = normalized.len() / 2;
    if n <= 3 {
        return normalized;
    }
    let mut state = LinkedState::new(normalized);
    let signed = state.signed_area2();
    let total_area = signed.abs();
    if total_area == 0 {
        return state.materialize();
    }
    let threshold = total_area as f32 * percentage;
    let orient_sign: i8 = if signed >= 0 { 1 } else { -1 };
    let mut changed = true;
    while changed && state.active > 3 {
        changed = false;
        let start = match state.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => break,
        };
        let mut visited = 0;
        let limit = state.active;
        let mut i = start;
        while visited < limit && state.active > 3 {
            let curr = i;
            i = state.next[curr];
            visited += 1;
            if !state.alive[curr] {
                continue;
            }
            let prev = state.prev[curr];
            let next = state.next[curr];
            let cross = cross2(&state.pts, &state.pts, prev, curr, next);
            let is_convex = orient_sign > 0 && cross > 0 || cross < 0;
            if !is_convex {
                continue;
            }
            let hump_area = cross.abs() as f32;
            let angle = interior_angle_rad(&state.pts, prev, curr, next, orient_sign);
            let remove_by_angle = angle > angle_threshold_rad;
            let remove_by_area = angle > pick_angle_rad && hump_area <= threshold;
            if !remove_by_angle && !remove_by_area
                || state.would_create_self_intersection_after_removal(curr)
            {
                continue;
            }
            state.remove(curr);
            changed = true;
        }
    }
    state.materialize()
}

fn iterative_relax_and_simplify(
    contour: &[u16],
    percentage: f32,
    angle_rad: f32,
    hole_angle_rad: f32,
    pick_angle_rad: f32,
    epsilon: u8,
) -> Vec<u16> {
    let mut current = normalize_contour(contour);
    if current.len() / 2 <= 3 {
        return current;
    }
    let mut prev_count: i32 = -1;
    loop {
        let cnt = (current.len() / 2) as i32;
        if cnt == prev_count {
            return current;
        }
        prev_count = cnt;
        current = remove_small_pits(current, percentage, hole_angle_rad);
        current = remove_obtuse_humps(current, percentage, angle_rad, pick_angle_rad);
        current = rdp_simplify_no_self_intersections(&current, epsilon);
        if current.len() / 2 <= 3 {
            return current;
        }
    }
}

// ── Step 3: remove pits until max point count ─────────────────────────────────

fn remove_smallest_pits_until_max_count(contour: &[u16], max_count: usize) -> Vec<u16> {
    let normalized = normalize_contour(contour);
    let n = normalized.len() / 2;
    if n <= 3 || n <= max_count {
        return normalized;
    }
    let mut state = LinkedState::new(normalized);
    let signed = state.signed_area2();
    let orient_sign: i8 = if signed >= 0 { 1 } else { -1 };
    while state.active > 3 && state.active > max_count {
        let start = match state.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => break,
        };
        let mut best_idx: i32 = -1;
        // Use integer area (twice the actual area) to avoid floating-point math.
        let mut best_area: i32 = i32::MAX;
        let mut cur = start;
        loop {
            if state.alive[cur] {
                let prev = state.prev[cur];
                let next = state.next[cur];
                let cross = cross2(&state.pts, &state.pts, prev, cur, next);
                let is_concave = orient_sign > 0 && cross < 0 || cross > 0;
                if is_concave
                    && cross.abs() < best_area
                    && !state.would_create_self_intersection_after_removal(cur)
                {
                    best_area = cross.abs();
                    best_idx = cur as i32;
                }
            }
            cur = state.next[cur];
            if cur == start {
                break;
            }
        }
        if best_idx < 0 {
            break;
        }
        state.remove(best_idx as usize);
    }
    state.materialize()
}

// ── Step 4: extend to cover original ─────────────────────────────────────────

fn map_simplified_to_original_indices(original: &[u16], simplified: &[u16]) -> Option<Vec<usize>> {
    let no = original.len() / 2;
    let ns = simplified.len() / 2;
    let mut matches: Vec<Vec<usize>> = Vec::with_capacity(ns);
    for i in 0..ns {
        let (sx, sy) = (gx(simplified, i), gy(simplified, i));
        let list: Vec<usize> = (0..no)
            .filter(|&j| gx(original, j) == sx && gy(original, j) == sy)
            .collect();
        if list.is_empty() {
            return None;
        }
        matches.push(list);
    }
    for &start in &matches[0] {
        let mut result = vec![0usize; ns];
        result[0] = start;
        let mut prev = start;
        let mut ok = true;
        for i in 1..ns {
            let candidates = &matches[i];
            let mut best: i32 = -1;
            let mut best_fwd = no + 1;
            for &idx in candidates {
                let fwd = if idx > prev {
                    idx - prev
                } else {
                    idx + no - prev
                };
                if fwd > 0 && fwd < best_fwd {
                    best_fwd = fwd;
                    best = idx as i32;
                }
            }
            if best < 0 {
                ok = false;
                break;
            }
            result[i] = best as usize;
            prev = best as usize;
        }
        if !ok {
            continue;
        }
        let close_fwd = if start > prev {
            start - prev
        } else {
            start + no - prev
        };
        if close_fwd > 0 {
            return Some(result);
        }
    }
    None
}

fn compute_arc_max_offset(
    original: &[u16],
    no: usize,
    start: usize,
    end: usize,
    nx: f32,
    ny: f32,
    c0: f32,
) -> f32 {
    let mut delta = 0.0f32;
    let mut k = start;
    for _ in 0..=no {
        let px = gx(original, k) as f32;
        let py = gy(original, k) as f32;
        let val = nx * px + ny * py + c0;
        if val > delta {
            delta = val;
        }
        if k == end {
            break;
        }
        k = (k + 1) % no;
    }
    delta
}

fn intersect_lines(a1: f32, b1: f32, c1: f32, a2: f32, b2: f32, c2: f32) -> Option<(f32, f32)> {
    let det = a1 * b2 - a2 * b1;
    if det.abs() < 1e-6 {
        return None;
    }
    let x = (b1 * c2 - b2 * c1) / det;
    let y = (a2 * c1 - a1 * c2) / det;
    Some((x, y))
}

fn snap_conservative(fx: f32, fy: f32, la: (f32, f32, f32), lb: (f32, f32, f32)) -> (f32, f32) {
    let cx = fx.round() as i32;
    let cy = fy.round() as i32;
    let mut best_x = cx;
    let mut best_y = cy;
    let mut best_d = f32::INFINITY;
    for radius in 0i32..=16 {
        let mut found = false;
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                let (x, y) = (cx + dx, cy + dy);
                if la.0 * x as f32 + la.1 * y as f32 + la.2 <= 1e-4
                    && lb.0 * x as f32 + lb.1 * y as f32 + lb.2 <= 1e-4
                {
                    let d = dist2(fx, fy, x as f32, y as f32);
                    if d < best_d {
                        best_d = d;
                        best_x = x;
                        best_y = y;
                        found = true;
                    }
                }
            }
        }
        if found {
            return (best_x as f32, best_y as f32);
        }
    }
    let (nx, ny) = (la.0 + lb.0, la.1 + lb.1);
    let len = (nx * nx + ny * ny).sqrt();
    if len > 1e-6 {
        let (ux, uy) = (nx / len, ny / len);
        for t in 0..=64i32 {
            let x = (fx + ux * t as f32).round() as i32;
            let y = (fy + uy * t as f32).round() as i32;
            if la.0 * x as f32 + la.1 * y as f32 + la.2 <= 1e-4
                && lb.0 * x as f32 + lb.1 * y as f32 + lb.2 <= 1e-4
            {
                return (x as f32, y as f32);
            }
        }
    }
    (cx as f32, cy as f32)
}

fn extend_to_cover_original(original: &[u16], simplified: &[u16]) -> Vec<u16> {
    let orig = normalize_contour(original);
    let simp = normalize_contour(simplified);
    let no = orig.len() / 2;
    let ns = simp.len() / 2;
    if no < 3 || ns < 3 {
        return simp;
    }

    let orientation = if polygon_signed_area2(&simp) > 0 {
        1.0f32
    } else {
        -1.0f32
    };
    let orig_indices = match map_simplified_to_original_indices(&orig, &simp) {
        Some(v) => v,
        None => return simp,
    };

    let mut lines: Vec<(f32, f32, f32)> = Vec::with_capacity(ns);
    for i in 0..ns {
        let j = (i + 1) % ns;
        let len_sq = dist2i(&simp, i, j);
        if len_sq == 0 {
            return simp;
        }
        let (ax, ay) = (gx(&simp, i) as f32, gy(&simp, i) as f32);
        let (bx, by) = (gx(&simp, j) as f32, gy(&simp, j) as f32);
        let dx = bx - ax;
        let dy = by - ay;
        let len = (len_sq as f32).sqrt();
        // Use orientation as a multiplier to avoid a conditional branch.
        // When orientation is -1, this flips the normal direction.
        let (nx, ny) = (orientation * (dy / len), orientation * (-dx / len));
        let c0 = -(nx * ax + ny * ay);
        let delta = compute_arc_max_offset(&orig, no, orig_indices[i], orig_indices[j], nx, ny, c0);
        lines.push((nx, ny, c0 - delta));
    }

    let mut out = Vec::with_capacity(ns * 2);
    for i in 0..ns {
        let prev = (i + ns - 1) % ns;
        let la = lines[prev];
        let lb = lines[i];
        let (x, y) = match intersect_lines(la.0, la.1, la.2, lb.0, lb.1, lb.2) {
            Some((ix, iy)) => snap_conservative(ix, iy, la, lb),
            None => {
                let (sx, sy) = (gx(&simp, i) as f32, gy(&simp, i) as f32);
                snap_conservative(sx, sy, la, lb)
            }
        };
        out.push(x.max(0.0).min(65535.0) as u16);
        out.push(y.max(0.0).min(65535.0) as u16);
    }
    out
}

// ── Step 5: refine by sliding edges ──────────────────────────────────────────

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
        let cross = orient_poly(&norm, &norm, prev, i, next);
        let (ax, ay) = (gx(&norm, prev), gy(&norm, prev));
        let (bx, by) = (gx(&norm, i), gy(&norm, i));
        let (cx, cy) = (gx(&norm, next), gy(&norm, next));
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
        out.push(gx(&norm, k));
        out.push(gy(&norm, k));
    }
    out
}

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
    fn signed_area2(&self) -> i32 {
        polygon_signed_area2(&self.pts)
    }
    fn to_u16(&self) -> Vec<u16> {
        self.pts.iter().map(|&v| v as u16).collect()
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
    let dx = gx(pts, a) as i32 - gx(pts, b) as i32;
    let dy = gy(pts, a) as i32 - gy(pts, b) as i32;
    if dx == 0 && dy == 0 {
        return (0, 0);
    }
    let g = gcd_i(dx.abs(), dy.abs());
    (dx / g, dy / g)
}

fn point_on_seg_i32(poly: &[u16], a: usize, b: usize, witnesses: &[u16], p: usize) -> bool {
    let ax = gx(poly, a);
    let ay = gy(poly, a);
    let bx = gx(poly, b);
    let by = gy(poly, b);
    let px = gx(witnesses, p);
    let py = gy(witnesses, p);
    cross2(&poly, witnesses, a, b, p) == 0
        && px >= ax.min(bx)
        && px <= ax.max(bx)
        && py >= ay.min(by)
        && py <= ay.max(by)
}

fn point_in_poly_or_on_edge(poly: &SlidingPoly, witnesses: &[u16], witness_idx: usize) -> bool {
    let px = gx(witnesses, witness_idx) as i32;
    let py = gy(witnesses, witness_idx) as i32;

    let n = poly.count();
    let mut inside = false;
    let mut j = n - 1;
    for i in 0..n {
        if point_on_seg_i32(&poly.pts, j, i, witnesses, witness_idx) {
            return true;
        }
        let (xi, yi) = (gx(&poly.pts, i), gy(&poly.pts, i));
        let (xj, yj) = (gx(&poly.pts, j), gy(&poly.pts, j));
        if (yi as i32 > py) != (yj as i32 > py) {
            let t = (xj as i32 - xi as i32) as f32 * (py - yi as i32) as f32
                / (yj as i32 - yi as i32) as f32
                + xi as f32;
            if (px as f32) <= t {
                inside = !inside;
            }
        }
        j = i;
    }
    inside
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
    (gx(&poly.pts, i0) == gx(&poly.pts, i1) && gy(&poly.pts, i0) == gy(&poly.pts, i1))
        || (gx(&poly.pts, i1) == gx(&poly.pts, i2) && gy(&poly.pts, i1) == gy(&poly.pts, i2))
        || (gx(&poly.pts, i2) == gx(&poly.pts, i3) && gy(&poly.pts, i2) == gy(&poly.pts, i3))
}

fn all_witnesses_inside(
    poly: &SlidingPoly,
    witnesses: &[u16],
    min_x: i32,
    min_y: i32,
    max_x: i32,
    max_y: i32,
) -> bool {
    let nw = witnesses.len() / 2;
    for i in 0..nw {
        let wx = gx(witnesses, i) as i32;
        let wy = gy(witnesses, i) as i32;
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
    let steps: [(i32, i32); 8] = [
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
        let cur_area = poly.signed_area2().abs();
        let mut best_area = cur_area;
        let mut best_step: Option<(i32, i32)> = None;
        let (old_ax, old_ay) = (gx(&poly.pts, i1) as i32, gy(&poly.pts, i1) as i32);
        let (old_bx, old_by) = (gx(&poly.pts, i2) as i32, gy(&poly.pts, i2) as i32);
        for &(sa, sb) in &steps {
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
            let area = poly.signed_area2().abs();
            if area < best_area {
                let xs = [
                    gx(&poly.pts, i0) as i32,
                    ax,
                    bx,
                    gx(&poly.pts, i3) as i32,
                    old_ax,
                    old_bx,
                ];
                let ys = [
                    gy(&poly.pts, i0) as i32,
                    ay,
                    by,
                    gy(&poly.pts, i3) as i32,
                    old_ay,
                    old_by,
                ];
                let min_x = xs.iter().copied().min().unwrap() - 2;
                let max_x = xs.iter().copied().max().unwrap() + 2;
                let min_y = ys.iter().copied().min().unwrap() - 2;
                let max_y = ys.iter().copied().max().unwrap() + 2;
                if all_witnesses_inside(poly, witnesses, min_x, min_y, max_x, max_y) {
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
        let mut moved = false;
        loop {
            let (cur_ax, cur_ay) = (gx(&poly.pts, i1) as i32, gy(&poly.pts, i1) as i32);
            let (cur_bx, cur_by) = (gx(&poly.pts, i2) as i32, gy(&poly.pts, i2) as i32);
            let next_ax = cur_ax + dir_a.0 * sa;
            let next_ay = cur_ay + dir_a.1 * sa;
            let next_bx = cur_bx + dir_b.0 * sb;
            let next_by = cur_by + dir_b.1 * sb;
            if next_ax == next_bx && next_ay == next_by {
                break;
            }
            let area_before = poly.signed_area2().abs();
            poly.set(i1, next_ax, next_ay);
            poly.set(i2, next_bx, next_by);
            if has_degenerate_local(poly, i0, i1, i2, i3)
                || would_self_intersect_after_slide(poly, i1, i2)
            {
                poly.set(i1, cur_ax, cur_ay);
                poly.set(i2, cur_bx, cur_by);
                break;
            }
            let xs = [
                gx(&poly.pts, i0) as i32,
                next_ax,
                next_bx,
                gx(&poly.pts, i3) as i32,
                cur_ax,
                cur_bx,
            ];
            let ys = [
                gy(&poly.pts, i0) as i32,
                next_ay,
                next_by,
                gy(&poly.pts, i3) as i32,
                cur_ay,
                cur_by,
            ];
            let min_x = xs.iter().copied().min().unwrap() - 2;
            let max_x = xs.iter().copied().max().unwrap() + 2;
            let min_y = ys.iter().copied().min().unwrap() - 2;
            let max_y = ys.iter().copied().max().unwrap() + 2;
            if !all_witnesses_inside(poly, witnesses, min_x, min_y, max_x, max_y)
                || poly.signed_area2().abs() >= area_before
            {
                poly.set(i1, cur_ax, cur_ay);
                poly.set(i2, cur_bx, cur_by);
                break;
            }
            moved = true;
            any_improved = true;
        }
        if !moved {
            return any_improved;
        }
    }
}

fn refine_by_sliding_edges(original: &[u16], cover: &[u16]) -> Vec<u16> {
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
    poly.to_u16()
}

// ── polygon filtering (pg_filter_contained) ───────────────────────────────────

fn pg_contour_bbox(pts: &[u16]) -> (u16, u16, u16, u16) {
    let n = pts.len() / 2;
    if n == 0 {
        return (0, 0, 0, 0);
    }
    let (mut min_x, mut max_x) = (gx(pts, 0), gx(pts, 0));
    let (mut min_y, mut max_y) = (gy(pts, 0), gy(pts, 0));
    for i in 1..n {
        let x = gx(pts, i);
        let y = gy(pts, i);
        if x < min_x {
            min_x = x;
        }
        if x > max_x {
            max_x = x;
        }
        if y < min_y {
            min_y = y;
        }
        if y > max_y {
            max_y = y;
        }
    }
    (min_x, min_y, max_x, max_y)
}

fn pg_point_in_poly_or_edge(poly: &[u16], inner: &[u16]) -> bool {
    let px = gx(inner, 0);
    let py = gy(inner, 0);

    let n = poly.len() / 2;
    let mut inside = false;
    let mut j = n - 1;
    for i in 0..n {
        let (xi, yi) = (gx(poly, i), gy(poly, i));
        let (xj, yj) = (gx(poly, j), gy(poly, j));
        if orient_poly(poly, inner, j, i, 0) == 0
            && px >= xj.min(xi)
            && px <= xj.max(xi)
            && py >= yj.min(yi)
            && py <= yj.max(yi)
        {
            return true;
        }
        if (yi > py) != (yj > py) {
            // Integer winding test: px <= (xj - xi) * (py - yi) / (yj - yi) + xi
            // Multiply through by dy = (yj - yi), flip <= when dy < 0.
            let dy = (yj as i16 - yi as i16) as i32;
            let lhs = px as i32 * dy;
            let rhs =
                (xj as i16 - xi as i16) as i32 * (py as i16 - yi as i16) as i32 + xi as i32 * dy;
            if (dy > 0 && lhs <= rhs) || (dy < 0 && lhs >= rhs) {
                inside = !inside;
            }
        }
        j = i;
    }
    inside
}

fn pg_contours_intersect(a: &[u16], b: &[u16]) -> bool {
    let na = a.len() / 2;
    let nb = b.len() / 2;
    for i in 0..na {
        let i2 = (i + 1) % na;
        for j in 0..nb {
            let j2 = (j + 1) % nb;
            if segments_intersect(a, i, i2, b, j, j2) {
                return true;
            }
        }
    }
    false
}

fn pg_is_inside(inner: &[u16], outer: &[u16]) -> bool {
    inner.len() >= 6
        && outer.len() >= 6
        && !pg_contours_intersect(inner, outer)
        && pg_point_in_poly_or_edge(outer, inner)
}

fn bbox_contains(bboxes: &[(u16, u16, u16, u16)], inner: usize, outer: usize) -> bool {
    let (bimx, bimy, bixx, bixy) = bboxes[inner];
    let (bjmx, bjmy, bjxx, bjxy) = bboxes[outer];
    bimx >= bjmx && bixx <= bjxx && bimy >= bjmy && bixy <= bjxy
}

pub(crate) fn pg_filter_contained(contours: Vec<Vec<u16>>) -> Vec<Vec<u16>> {
    let n = contours.len();
    if n == 0 {
        return Vec::new();
    }
    let (normalized, bboxes, areas): (Vec<Vec<u16>>, Vec<(u16, u16, u16, u16)>, Vec<i32>) =
        contours.into_iter().fold(
            (
                Vec::with_capacity(n),
                Vec::with_capacity(n),
                Vec::with_capacity(n),
            ),
            |(mut norm, mut bbox, mut area), c| {
                let norm_c = normalize_contour(&c);
                bbox.push(pg_contour_bbox(&norm_c));
                area.push(polygon_signed_area2(&norm_c).abs());
                norm.push(norm_c);
                (norm, bbox, area)
            },
        );
    let mut removed = vec![false; n];
    for i in 0..n {
        if removed[i] {
            continue;
        }
        for j in 0..n {
            if i != j
                && !removed[i]
                && areas[i] <= areas[j]
                && bbox_contains(&bboxes, i, j)
                && pg_is_inside(&normalized[i], &normalized[j])
            {
                removed[i] = true;
                break;
            }
        }
    }
    normalized
        .into_iter()
        .enumerate()
        .filter_map(|(i, c)| if !removed[i] { Some(c) } else { None })
        .collect()
}
