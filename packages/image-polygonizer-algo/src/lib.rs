use wasm_bindgen::prelude::*;

// ── shared geometry helpers ───────────────────────────────────────────────────

#[inline]
fn gx(pts: &[u16], i: usize) -> f64 {
    pts[i * 2] as f64
}
#[inline]
fn gy(pts: &[u16], i: usize) -> f64 {
    pts[i * 2 + 1] as f64
}

fn orient_raw(ax: f64, ay: f64, bx: f64, by: f64, cx: f64, cy: f64) -> f64 {
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

fn polygon_signed_area(pts: &[u16]) -> f64 {
    let n = pts.len() / 2;
    let mut sum = 0.0f64;
    for i in 0..n {
        let j = (i + 1) % n;
        sum += gx(pts, i) * gy(pts, j) - gx(pts, j) * gy(pts, i);
    }
    sum * 0.5
}

fn triangle_angle(v1x: f64, v1y: f64, v2x: f64, v2y: f64) -> f64 {
    let l1 = (v1x * v1x + v1y * v1y).sqrt();
    let l2 = (v2x * v2x + v2y * v2y).sqrt();
    if l1 == 0.0 || l2 == 0.0 {
        return 0.0;
    }
    let cos = ((v1x * v2x + v1y * v2y) / (l1 * l2)).clamp(-1.0, 1.0);
    cos.acos()
}

fn triangle_min_angle(pts: &[u16], a: usize, b: usize, c: usize) -> f64 {
    let (ax, ay) = (gx(pts, a), gy(pts, a));
    let (bx, by) = (gx(pts, b), gy(pts, b));
    let (cx, cy) = (gx(pts, c), gy(pts, c));
    let aa = triangle_angle(bx - ax, by - ay, cx - ax, cy - ay);
    let ab = triangle_angle(ax - bx, ay - by, cx - bx, cy - by);
    let ac = triangle_angle(ax - cx, ay - cy, bx - cx, by - cy);
    aa.min(ab).min(ac)
}

fn triangle_max_angle(pts: &[u16], a: usize, b: usize, c: usize) -> f64 {
    let (ax, ay) = (gx(pts, a), gy(pts, a));
    let (bx, by) = (gx(pts, b), gy(pts, b));
    let (cx, cy) = (gx(pts, c), gy(pts, c));
    let aa = triangle_angle(bx - ax, by - ay, cx - ax, cy - ay);
    let ab = triangle_angle(ax - bx, ay - by, cx - bx, cy - by);
    let ac = triangle_angle(ax - cx, ay - cy, bx - cx, by - cy);
    aa.max(ab).max(ac)
}

fn point_in_triangle_or_on_edge(
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

fn orient_triangle_like_polygon(
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

/// Pack the alpha channel of an RGBA pixel buffer into a 1-bit-per-pixel bitmask.
///
/// Layout: LSB-first, row-major, with an optional zero-padded border of `offset`
/// pixels on all four sides. Pixels whose alpha >= threshold are set to 1.
#[wasm_bindgen]
pub fn pack_alpha_mask_bits(
    pixels: &[u8],
    width: u16,
    height: u16,
    threshold: u8,
    offset: u8,
) -> Vec<u8> {
    #[cfg(target_arch = "wasm32")]
    // SAFETY: simd128 is enabled globally via .cargo/config.toml for wasm32
    return unsafe { pack_simd(pixels, width, height, threshold, offset) };

    #[cfg(not(target_arch = "wasm32"))]
    pack_scalar(pixels, width, height, threshold, offset)
}

// ── SIMD implementation (wasm32 simd128) ─────────────────────────────────────

#[cfg(target_arch = "wasm32")]
#[target_feature(enable = "simd128")]
unsafe fn pack_simd(pixels: &[u8], width: u16, height: u16, threshold: u8, offset: u8) -> Vec<u8> {
    use core::arch::wasm32::*;

    let w = width as u32;
    let h = height as u32;
    let off = offset as u32;
    let pw = w + off * 2;
    let dst_pixel_count = pw * (h + off * 2);
    let mut out = vec![0u8; ((dst_pixel_count + 7) >> 3) as usize];

    let thresh = u8x16_splat(threshold);

    for y in 0..h {
        let dst_row_start = ((y + off) * pw + off) as usize;
        let src_row = (y * w * 4) as usize;
        let mut x = 0usize;

        // Scalar prefix: fill the partial byte to reach the next byte boundary.
        let prefix = ((8 - dst_row_start % 8) % 8).min(w as usize);
        for i in 0..prefix {
            let alpha = *pixels.get_unchecked(src_row + i * 4 + 3);
            if alpha >= threshold {
                let bit = dst_row_start + i;
                *out.get_unchecked_mut(bit >> 3) |= 1 << (bit & 7);
            }
        }
        x += prefix;

        // SIMD bulk: 16 pixels → 4×v128 loads → shuffle alphas → compare → bitmask → 2 bytes.
        while x + 16 <= w as usize {
            let p = pixels.as_ptr().add(src_row + x * 4);

            // Load 64 bytes (16 RGBA pixels)
            let v0 = v128_load(p as *const v128);
            let v1 = v128_load(p.add(16) as *const v128);
            let v2 = v128_load(p.add(32) as *const v128);
            let v3 = v128_load(p.add(48) as *const v128);

            // Gather alpha bytes from positions 3, 7, 11, 15 within each pair.
            // Indices 0-15 select from the first argument, 16-31 from the second.
            let a01 = i8x16_shuffle::<3, 7, 11, 15, 19, 23, 27, 31, 0, 0, 0, 0, 0, 0, 0, 0>(v0, v1);
            let a23 = i8x16_shuffle::<3, 7, 11, 15, 19, 23, 27, 31, 0, 0, 0, 0, 0, 0, 0, 0>(v2, v3);
            // Merge the two low halves into one full vector of 16 alpha bytes.
            let alphas =
                i8x16_shuffle::<0, 1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23>(a01, a23);

            // u8x16_ge returns 0xFF per lane where alpha >= threshold, 0x00 otherwise.
            // i8x16_bitmask extracts bit 7 of each lane → u32 with bits 0-15 set.
            let bits = i8x16_bitmask(u8x16_ge(alphas, thresh));

            // Write 2 bytes LSB-first; safe because x is byte-aligned here.
            let byte = (dst_row_start + x) >> 3;
            *out.get_unchecked_mut(byte) = bits as u8;
            *out.get_unchecked_mut(byte + 1) = (bits >> 8) as u8;

            x += 16;
        }

        // Scalar suffix: remaining pixels (< 16) after the last full SIMD chunk.
        for i in x..w as usize {
            let alpha = *pixels.get_unchecked(src_row + i * 4 + 3);
            if alpha >= threshold {
                let bit = dst_row_start + i;
                *out.get_unchecked_mut(bit >> 3) |= 1 << (bit & 7);
            }
        }
    }

    out
}

// ── Scalar fallback (non-wasm targets) ───────────────────────────────────────

#[cfg(not(target_arch = "wasm32"))]
fn pack_scalar(pixels: &[u8], width: u16, height: u16, threshold: u8, offset: u8) -> Vec<u8> {
    let w = width as u32;
    let h = height as u32;
    let off = offset as u32;
    let pw = w + off * 2;
    let dst_pixel_count = pw * (h + off * 2);
    let mut out = vec![0u8; ((dst_pixel_count + 7) >> 3) as usize];

    for y in 0..h {
        let dst_row_base = (y + off) * pw + off;
        let src_row_base = (y * w) as usize;

        for x in 0..w {
            let alpha = pixels[(src_row_base + x as usize) * 4 + 3];
            if alpha >= threshold {
                let dst_index = (dst_row_base + x) as usize;
                out[dst_index >> 3] |= 1 << (dst_index & 7);
            }
        }
    }

    out
}

// ── extend_bit_mask ───────────────────────────────────────────────────────────

/// Dilate a 1-bit-per-pixel LSB-first bitmask by a circular kernel of radius
/// `outline_size` pixels.  Every pixel within Euclidean distance `outline_size`
/// of any set pixel in the source will be set in the result.
#[wasm_bindgen]
pub fn extend_bit_mask(mask: &[u8], width: u16, height: u16, outline_size: u8) -> Vec<u8> {
    let w = width as i32;
    let h = height as i32;
    let pixel_count = (w * h) as usize;
    let byte_count = (pixel_count + 7) >> 3;
    let mut out = vec![0u8; byte_count];

    if outline_size == 0 {
        let src_len = mask.len().min(byte_count);
        out[..src_len].copy_from_slice(&mask[..src_len]);
        return out;
    }

    let r = outline_size as i32;
    let r2 = r * r;

    // Precompute dx_max[dy] = floor(sqrt(r² − dy²)) for dy in [0..=r].
    let mut dx_max = vec![0i32; (r + 1) as usize];
    for dy in 0..=r {
        dx_max[dy as usize] = ((r2 - dy * dy) as f64).sqrt() as i32;
    }

    for y in 0..h {
        let row_base = y * w;

        for x in 0..w {
            let idx = (row_base + x) as usize;

            // Skip unset source pixels.
            if (mask[idx >> 3] >> (idx & 7)) & 1 == 0 {
                continue;
            }

            let ny0 = (y - r).max(0);
            let ny1 = (y + r).min(h - 1);

            for ny in ny0..=ny1 {
                let dy = (ny - y).abs() as usize;
                let dx = dx_max[dy];
                let nx0 = (x - dx).max(0) as usize;
                let nx1 = (x + dx).min(w - 1) as usize;
                let n_row_base = (ny * w) as usize;

                // Set the span [nx0, nx1] using whole-byte fills where possible.
                let bit0 = n_row_base + nx0;
                let bit1 = n_row_base + nx1;
                let byte0 = bit0 >> 3;
                let byte1 = bit1 >> 3;

                if byte0 == byte1 {
                    // Span fits within a single byte.
                    let shift0 = bit0 & 7;
                    let shift1 = bit1 & 7;
                    let bits = (0xffu8 << shift0) & (0xffu8 >> (7 - shift1));
                    out[byte0] |= bits;
                } else {
                    // Partial first byte.
                    out[byte0] |= 0xffu8 << (bit0 & 7);
                    // Full middle bytes.
                    for b in (byte0 + 1)..byte1 {
                        out[b] = 0xff;
                    }
                    // Partial last byte.
                    out[byte1] |= 0xffu8 >> (7 - (bit1 & 7));
                }
            }
        }
    }

    out
}

// ── extract_all_outer_contours ────────────────────────────────────────────────

#[inline]
fn ms_get(b: &[u8], i: usize) -> bool {
    (b[i >> 3] >> (i & 7)) & 1 != 0
}
#[inline]
fn ms_set(b: &mut [u8], i: usize) {
    b[i >> 3] |= 1 << (i & 7);
}
#[inline]
fn ms_clr(b: &mut [u8], i: usize) {
    b[i >> 3] &= !(1u8 << (i & 7));
}

#[inline]
fn sq_val(bits: &[u8], w: usize, x: i32, y: i32) -> u8 {
    let w = w as i32;
    let o1 = ms_get(bits, ((y - 1) * w + (x - 1)) as usize) as u8;
    let o2 = ms_get(bits, ((y - 1) * w + x) as usize) as u8;
    let o4 = ms_get(bits, (y * w + (x - 1)) as usize) as u8;
    let o8 = ms_get(bits, (y * w + x) as usize) as u8;
    o1 | (o2 << 1) | (o4 << 2) | (o8 << 3)
}

fn find_seed(bits: &[u8], w: usize, x0: i32, y0: i32, x1: i32, y1: i32) -> Option<(i32, i32)> {
    for y in y0..=y1 {
        for x in x0..=x1 {
            if ms_get(bits, y as usize * w + x as usize) {
                return Some((x, y));
            }
        }
    }
    None
}

/// Flood-fill (4-connectivity), clearing visited bits.
/// Returns (pixel_indices, leftmost_xy).
fn collect_and_clear(
    bits: &mut Vec<u8>,
    w: usize,
    h: usize,
    seed: (i32, i32),
) -> (Vec<u32>, (i32, i32)) {
    let seed_idx = seed.1 as usize * w + seed.0 as usize;
    if !ms_get(bits, seed_idx) {
        return (Vec::new(), (0, 0));
    }

    let mut stack: Vec<u32> = Vec::with_capacity(1024);
    let mut list: Vec<u32> = Vec::with_capacity(4096);
    let mut left = (seed.0, seed.1);

    ms_clr(bits, seed_idx);
    stack.push(seed_idx as u32);
    list.push(seed_idx as u32);

    while let Some(idx) = stack.pop() {
        let i = idx as usize;
        let y = (i / w) as i32;
        let x = (i - y as usize * w) as i32;

        if x < left.0 || (x == left.0 && y < left.1) {
            left = (x, y);
        }

        macro_rules! try_nb {
            ($ni:expr) => {{
                let ni = $ni;
                if ms_get(bits, ni) {
                    ms_clr(bits, ni);
                    stack.push(ni as u32);
                    list.push(ni as u32);
                }
            }};
        }
        if x > 0 {
            try_nb!(i - 1);
        }
        if x + 1 < w as i32 {
            try_nb!(i + 1);
        }
        if y > 0 {
            try_nb!(i - w);
        }
        if y + 1 < h as i32 {
            try_nb!(i + w);
        }
    }

    (list, left)
}

const START_OFF: [(i32, i32); 4] = [(0, 0), (1, 0), (0, 1), (1, 1)];

fn find_start_sq(
    bits: &[u8],
    w: usize,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    p: (i32, i32),
) -> Option<(i32, i32)> {
    for (dx, dy) in &START_OFF {
        let (sx, sy) = (p.0 + dx, p.1 + dy);
        if sx < x0 || sy < y0 || sx > x1 || sy > y1 {
            continue;
        }
        let sv = sq_val(bits, w, sx, sy);
        if sv != 0 && sv != 15 {
            return Some((sx, sy));
        }
    }
    // small local fallback
    for dy in -8i32..=8 {
        let sy = p.1 + dy;
        if sy < y0 || sy > y1 {
            continue;
        }
        for dx in -8i32..=8 {
            let sx = p.0 + dx;
            if sx < x0 || sx > x1 {
                continue;
            }
            let sv = sq_val(bits, w, sx, sy);
            if sv != 0 && sv != 15 {
                return Some((sx, sy));
            }
        }
    }
    None
}

fn march(
    bits: &[u8],
    w: usize,
    h: usize,
    pad: i32,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    start: (i32, i32),
    max_steps: usize,
) -> Vec<u16> {
    let toggle_bytes = (w * h + 7) >> 3;
    let mut t9 = vec![0u8; toggle_bytes];
    let mut t6 = vec![0u8; toggle_bytes];

    let mut out: Vec<u16> = Vec::with_capacity(512);
    let mut prev_step: (i32, i32) = (2, 2); // sentinel — can't be a real step
    let mut cur = start;

    for _ in 0..max_steps {
        if cur.0 < x0 || cur.1 < y0 || cur.0 > x1 || cur.1 > y1 {
            break;
        }

        let sv = sq_val(bits, w, cur.0, cur.1);

        let step: (i32, i32) = match sv {
            1 | 5 | 13 => (0, -1),
            8 | 10 | 11 => (0, 1),
            4 | 12 | 14 => (-1, 0),
            2 | 3 | 7 => (1, 0),
            9 => {
                let id = cur.1 as usize * w + cur.0 as usize;
                if ms_get(&t9, id) {
                    ms_clr(&mut t9, id);
                    (0, 1)
                } else {
                    ms_set(&mut t9, id);
                    (0, -1)
                }
            }
            6 => {
                let id = cur.1 as usize * w + cur.0 as usize;
                if ms_get(&t6, id) {
                    ms_clr(&mut t6, id);
                    (-1, 0)
                } else {
                    ms_set(&mut t6, id);
                    (1, 0)
                }
            }
            _ => break,
        };

        cur.0 += step.0;
        cur.1 += step.1;

        let ox = (cur.0 - pad) as u16;
        let oy = (cur.1 - pad) as u16;

        // merge collinear
        if step == prev_step {
            let len = out.len();
            out[len - 2] = ox;
            out[len - 1] = oy;
        } else {
            out.push(ox);
            out.push(oy);
        }
        prev_step = step;

        if cur == start {
            break;
        }
    }

    out
}

fn pack_contours(contours: &[Vec<u16>]) -> Vec<u8> {
    let n = contours.len();
    let data_u8: usize = contours.iter().map(|c| c.len() * 2).sum();
    let mut out = Vec::with_capacity(4 + n * 4 + data_u8);
    out.extend_from_slice(&(n as u32).to_le_bytes());
    for c in contours {
        out.extend_from_slice(&(c.len() as u32).to_le_bytes());
    }
    for c in contours {
        for &v in c {
            out.extend_from_slice(&v.to_le_bytes());
        }
    }
    out
}

/// Extract outer contours from a padded 1-bit-per-pixel LSB-first bitmask.
///
/// Returns a packed byte buffer:
///   [4 bytes]   contour count N (u32 LE)
///   [4×N bytes] u16-element count of each contour (u32 LE)
///   [...]       contour data: interleaved u16 LE (x, y) pairs (padding already subtracted)
#[wasm_bindgen]
pub fn extract_all_outer_contours(
    input_bits: &[u8],
    width: u16,
    height: u16,
    padding: u8,
) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let pad = padding as i32;

    let byte_count = (w * h + 7) >> 3;
    let mut bits = vec![0u8; byte_count];
    let copy_len = input_bits.len().min(byte_count);
    bits[..copy_len].copy_from_slice(&input_bits[..copy_len]);

    let x0 = pad;
    let y0 = pad;
    let x1 = (w as i32) - 1 - pad;
    let y1 = (h as i32) - 1 - pad;
    let max_steps = w * h * 4;

    let mut contours: Vec<Vec<u16>> = Vec::new();

    for _ in 0..1_000_000usize {
        let seed = match find_seed(&bits, w, x0, y0, x1, y1) {
            Some(s) => s,
            None => break,
        };

        let (comp, leftmost) = collect_and_clear(&mut bits, w, h, seed);
        if comp.is_empty() {
            continue;
        }

        // restore component so marching can read it
        for &idx in &comp {
            ms_set(&mut bits, idx as usize);
        }

        if let Some(sq) = find_start_sq(&bits, w, x0, y0, x1, y1, leftmost) {
            let contour = march(&bits, w, h, pad, x0, y0, x1, y1, sq, max_steps);
            contours.push(contour);
        }

        // clear component for good
        for &idx in &comp {
            ms_clr(&mut bits, idx as usize);
        }
    }

    pack_contours(&contours)
}

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
#[wasm_bindgen]
pub fn contour_to_polygon(contour: &[u16], min_distance: f64, max_point_count: u16) -> Vec<u16> {
    // ── step 1: RDP simplification ────────────────────────────────────────────
    let step1 = rdp_simplify_no_self_intersections(contour, min_distance);

    if step1.len() < 6 {
        return step1;
    }

    // ── step 2: iterative relax+simplify ─────────────────────────────────────
    let step2 = iterative_relax_and_simplify(
        &step1,
        0.008,
        170.0_f64.to_radians(),
        260.0_f64.to_radians(),
        120.0_f64.to_radians(),
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

// ── Shared low-level helpers for contour_to_polygon ──────────────────────────

/// Normalize a closed contour: remove duplicate last==first vertex if present.
fn normalize_contour(pts: &[u16]) -> Vec<u16> {
    let n = pts.len() / 2;
    if n > 1 && pts[0] == pts[(n - 1) * 2] && pts[1] == pts[(n - 1) * 2 + 1] {
        pts[..(n - 1) * 2].to_vec()
    } else {
        pts.to_vec()
    }
}

/// Signed area of a flat u16 contour.
fn signed_area_u16(pts: &[u16]) -> f64 {
    let n = pts.len() / 2;
    let mut sum = 0.0f64;
    for i in 0..n {
        let j = (i + 1) % n;
        sum +=
            pts[i * 2] as f64 * pts[j * 2 + 1] as f64 - pts[j * 2] as f64 * pts[i * 2 + 1] as f64;
    }
    sum * 0.5
}

/// cross2: (B-A) × (C-B)
#[inline]
fn cross2_f(ax: f64, ay: f64, bx: f64, by: f64, cx: f64, cy: f64) -> f64 {
    (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
}

/// Segment intersection (proper + collinear endpoint cases).
fn segments_intersect(
    a0x: f64,
    a0y: f64,
    a1x: f64,
    a1y: f64,
    b0x: f64,
    b0y: f64,
    b1x: f64,
    b1y: f64,
) -> bool {
    #[inline]
    fn sign(v: f64) -> i32 {
        if v > 0.0 {
            1
        } else if v < 0.0 {
            -1
        } else {
            0
        }
    }
    #[inline]
    fn on_seg(ax: f64, ay: f64, bx: f64, by: f64, px: f64, py: f64) -> bool {
        px >= ax.min(bx)
            && px <= ax.max(bx)
            && py >= ay.min(by)
            && py <= ay.max(by)
            && orient_raw(ax, ay, bx, by, px, py) == 0.0
    }
    let o1 = sign(orient_raw(a0x, a0y, a1x, a1y, b0x, b0y));
    let o2 = sign(orient_raw(a0x, a0y, a1x, a1y, b1x, b1y));
    let o3 = sign(orient_raw(b0x, b0y, b1x, b1y, a0x, a0y));
    let o4 = sign(orient_raw(b0x, b0y, b1x, b1y, a1x, a1y));
    if o1 != o2 && o3 != o4 {
        return true;
    }
    if o1 == 0 && on_seg(a0x, a0y, a1x, a1y, b0x, b0y) {
        return true;
    }
    if o2 == 0 && on_seg(a0x, a0y, a1x, a1y, b1x, b1y) {
        return true;
    }
    if o3 == 0 && on_seg(b0x, b0y, b1x, b1y, a0x, a0y) {
        return true;
    }
    if o4 == 0 && on_seg(b0x, b0y, b1x, b1y, a1x, a1y) {
        return true;
    }
    false
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

    fn px(&self, i: usize) -> f64 {
        self.pts[i * 2] as f64
    }
    fn py(&self, i: usize) -> f64 {
        self.pts[i * 2 + 1] as f64
    }

    fn signed_area(&self) -> f64 {
        let start = match self.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => return 0.0,
        };
        let mut sum = 0.0f64;
        let mut i = start;
        loop {
            let j = self.next[i];
            sum += self.px(i) * self.py(j) - self.px(j) * self.py(i);
            i = j;
            if i == start {
                break;
            }
        }
        sum * 0.5
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
        let ax = self.px(prev);
        let ay = self.py(prev);
        let bx = self.px(next);
        let by = self.py(next);
        let start = match self.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => return false,
        };
        let mut e0 = start;
        loop {
            let e1 = self.next[e0];
            let skip =
                e0 == prev || e1 == prev || e0 == curr || e1 == curr || e0 == next || e1 == next;
            if !skip {
                let c0x = self.px(e0);
                let c0y = self.py(e0);
                let c1x = self.px(e1);
                let c1y = self.py(e1);
                if segments_intersect(ax, ay, bx, by, c0x, c0y, c1x, c1y) {
                    return true;
                }
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
            out.push(self.pts[cur * 2]);
            out.push(self.pts[cur * 2 + 1]);
            cur = self.next[cur];
            if cur == start {
                break;
            }
        }
        out
    }
}

// ── Step 1: RDP simplification ────────────────────────────────────────────────

fn rdp_simplify_no_self_intersections(contour: &[u16], epsilon: f64) -> Vec<u16> {
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

    let arc1 = rdp_build_arc(n, anchor, split);
    let arc2 = rdp_build_arc(n, split, anchor);
    let keep1 = rdp_simplify_open(&normalized, &arc1, epsilon);
    let keep2 = rdp_simplify_open(&normalized, &arc2, epsilon);
    let mut kept = rdp_merge_arcs(&arc1, &keep1, &arc2, &keep2);

    if kept.len() < 3 {
        return normalized;
    }

    rdp_resolve_self_intersections(&normalized, &mut kept, epsilon);
    if kept.len() < 3 {
        return normalized;
    }

    rdp_cleanup_redundant(&normalized, &mut kept, epsilon * epsilon);
    if kept.len() < 3 {
        return normalized;
    }

    rdp_materialize(&normalized, &kept)
}

fn rdp_find_anchor(pts: &[u16], n: usize) -> usize {
    let mut anchor = 0;
    let (mut mx, mut my) = (pts[0] as i32, pts[1] as i32);
    for i in 1..n {
        let x = pts[i * 2] as i32;
        let y = pts[i * 2 + 1] as i32;
        if x < mx || (x == mx && y < my) {
            anchor = i;
            mx = x;
            my = y;
        }
    }
    anchor
}

fn rdp_find_farthest(pts: &[u16], n: usize, anchor: usize) -> usize {
    let (ax, ay) = (pts[anchor * 2] as f64, pts[anchor * 2 + 1] as f64);
    let mut best = anchor;
    let mut best_d = -1.0f64;
    for i in 0..n {
        if i == anchor {
            continue;
        }
        let dx = pts[i * 2] as f64 - ax;
        let dy = pts[i * 2 + 1] as f64 - ay;
        let d = dx * dx + dy * dy;
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

fn rdp_point_line_dist_sq(pts: &[u16], p: usize, a: usize, b: usize) -> f64 {
    let (px, py) = (pts[p * 2] as f64, pts[p * 2 + 1] as f64);
    let (ax, ay) = (pts[a * 2] as f64, pts[a * 2 + 1] as f64);
    let (bx, by) = (pts[b * 2] as f64, pts[b * 2 + 1] as f64);
    let abx = bx - ax;
    let aby = by - ay;
    let len_sq = abx * abx + aby * aby;
    if len_sq == 0.0 {
        let dx = px - ax;
        let dy = py - ay;
        return dx * dx + dy * dy;
    }
    let cross = abx * (py - ay) - aby * (px - ax);
    cross * cross / len_sq
}

fn rdp_simplify_open(pts: &[u16], indices: &[usize], epsilon: f64) -> Vec<bool> {
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
    let eps_sq = epsilon * epsilon;
    // iterative stack
    let mut stack: Vec<(usize, usize)> = vec![(0, n - 1)];
    while let Some((start, end)) = stack.pop() {
        if end - start <= 1 {
            continue;
        }
        let a = indices[start];
        let b = indices[end];
        let mut max_d = -1.0f64;
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
    pts[a * 2] == pts[b * 2] && pts[a * 2 + 1] == pts[b * 2 + 1]
}

fn rdp_find_self_intersection(pts: &[u16], kept: &[usize]) -> Option<(usize, usize)> {
    let m = kept.len();
    for ea in 0..m {
        let a0 = kept[ea];
        let a1 = kept[(ea + 1) % m];
        let a0x = pts[a0 * 2] as f64;
        let a0y = pts[a0 * 2 + 1] as f64;
        let a1x = pts[a1 * 2] as f64;
        let a1y = pts[a1 * 2 + 1] as f64;
        for eb in (ea + 1)..m {
            if rdp_is_adjacent(ea, eb, m) {
                continue;
            }
            let b0 = kept[eb];
            let b1 = kept[(eb + 1) % m];
            if rdp_same_pt(pts, a0, b0)
                || rdp_same_pt(pts, a0, b1)
                || rdp_same_pt(pts, a1, b0)
                || rdp_same_pt(pts, a1, b1)
            {
                continue;
            }
            let b0x = pts[b0 * 2] as f64;
            let b0y = pts[b0 * 2 + 1] as f64;
            let b1x = pts[b1 * 2] as f64;
            let b1y = pts[b1 * 2 + 1] as f64;
            if segments_intersect(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y) {
                return Some((ea, eb));
            }
        }
    }
    None
}

fn rdp_find_worst_on_arc(pts: &[u16], n: usize, start: usize, end: usize) -> (i64, f64) {
    let mut cur = (start + 1) % n;
    let mut max_d = -1.0f64;
    let mut max_p = -1i64;
    while cur != end {
        let d = rdp_point_line_dist_sq(pts, cur, start, end);
        if d > max_d {
            max_d = d;
            max_p = cur as i64;
        }
        cur = (cur + 1) % n;
    }
    (max_p, max_d)
}

fn rdp_resolve_self_intersections(pts: &[u16], kept: &mut Vec<usize>, epsilon: f64) {
    let n = pts.len() / 2;
    let eps_sq = epsilon * epsilon;
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
            // insert pa after ea if not already in kept
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

fn rdp_arc_fits_eps(pts: &[u16], n: usize, start: usize, end: usize, eps_sq: f64) -> bool {
    let mut cur = (start + 1) % n;
    while cur != end {
        if rdp_point_line_dist_sq(pts, cur, start, end) > eps_sq {
            return false;
        }
        cur = (cur + 1) % n;
    }
    true
}

fn rdp_cleanup_redundant(pts: &[u16], kept: &mut Vec<usize>, eps_sq: f64) {
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
        out.push(pts[k * 2]);
        out.push(pts[k * 2 + 1]);
    }
    out
}

// ── Step 2: iterative relax+simplify ─────────────────────────────────────────

fn interior_angle_rad(
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    cx: f64,
    cy: f64,
    orientation_sign: f64,
) -> f64 {
    let v1x = ax - bx;
    let v1y = ay - by;
    let v2x = cx - bx;
    let v2y = cy - by;
    let l1 = (v1x * v1x + v1y * v1y).sqrt();
    let l2 = (v2x * v2x + v2y * v2y).sqrt();
    if l1 == 0.0 || l2 == 0.0 {
        return 0.0;
    }
    let cos = ((v1x * v2x + v1y * v2y) / (l1 * l2)).clamp(-1.0, 1.0);
    let small_angle = cos.acos();
    let cross = cross2_f(ax, ay, bx, by, cx, cy);
    let is_convex = if orientation_sign > 0.0 {
        cross > 0.0
    } else {
        cross < 0.0
    };
    if is_convex {
        small_angle
    } else {
        2.0 * std::f64::consts::PI - small_angle
    }
}

fn remove_small_pits(pts: Vec<u16>, percentage: f64, hole_angle_rad: f64) -> Vec<u16> {
    let normalized = normalize_contour(&pts);
    let n = normalized.len() / 2;
    if n <= 3 {
        return normalized;
    }
    let mut state = LinkedState::new(normalized);
    let signed = state.signed_area();
    let total_area = signed.abs();
    if total_area == 0.0 {
        return state.materialize();
    }
    let threshold = total_area * percentage;
    let orient_sign = if signed >= 0.0 { 1.0f64 } else { -1.0 };
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
            let (ax, ay) = (state.px(prev), state.py(prev));
            let (bx, by) = (state.px(curr), state.py(curr));
            let (cx, cy) = (state.px(next), state.py(next));
            let cross = cross2_f(ax, ay, bx, by, cx, cy);
            let is_concave = if orient_sign > 0.0 {
                cross < 0.0
            } else {
                cross > 0.0
            };
            if !is_concave {
                continue;
            }
            let pit_area = cross.abs() * 0.5;
            let angle = interior_angle_rad(ax, ay, bx, by, cx, cy, orient_sign);
            if pit_area > threshold && angle <= hole_angle_rad {
                continue;
            }
            if state.would_create_self_intersection_after_removal(curr) {
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
    percentage: f64,
    angle_threshold_rad: f64,
    pick_angle_rad: f64,
) -> Vec<u16> {
    let normalized = normalize_contour(&pts);
    let n = normalized.len() / 2;
    if n <= 3 {
        return normalized;
    }
    let mut state = LinkedState::new(normalized);
    let signed = state.signed_area();
    let total_area = signed.abs();
    if total_area == 0.0 {
        return state.materialize();
    }
    let threshold = total_area * percentage;
    let orient_sign = if signed >= 0.0 { 1.0f64 } else { -1.0 };
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
            let (ax, ay) = (state.px(prev), state.py(prev));
            let (bx, by) = (state.px(curr), state.py(curr));
            let (cx, cy) = (state.px(next), state.py(next));
            let cross = cross2_f(ax, ay, bx, by, cx, cy);
            let is_convex = if orient_sign > 0.0 {
                cross > 0.0
            } else {
                cross < 0.0
            };
            if !is_convex {
                continue;
            }
            let hump_area = cross.abs() * 0.5;
            let angle = interior_angle_rad(ax, ay, bx, by, cx, cy, orient_sign);
            let remove_by_angle = angle > angle_threshold_rad;
            let remove_by_area = angle > pick_angle_rad && hump_area <= threshold;
            if !remove_by_angle && !remove_by_area {
                continue;
            }
            if state.would_create_self_intersection_after_removal(curr) {
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
    percentage: f64,
    angle_rad: f64,
    hole_angle_rad: f64,
    pick_angle_rad: f64,
    epsilon: f64,
) -> Vec<u16> {
    let mut current = normalize_contour(contour);
    if current.len() / 2 <= 3 {
        return current;
    }
    let mut prev_count: i64 = -1;
    loop {
        let cnt = (current.len() / 2) as i64;
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
    let signed = state.signed_area();
    let orient_sign = if signed >= 0.0 { 1.0f64 } else { -1.0 };
    while state.active > 3 && state.active > max_count {
        let start = match state.alive.iter().position(|&a| a) {
            Some(s) => s,
            None => break,
        };
        let mut best_idx: i64 = -1;
        let mut best_area = f64::INFINITY;
        let mut cur = start;
        loop {
            if state.alive[cur] {
                let prev = state.prev[cur];
                let next = state.next[cur];
                let (ax, ay) = (state.px(prev), state.py(prev));
                let (bx, by) = (state.px(cur), state.py(cur));
                let (cx, cy) = (state.px(next), state.py(next));
                let cross = cross2_f(ax, ay, bx, by, cx, cy);
                let is_concave = if orient_sign > 0.0 {
                    cross < 0.0
                } else {
                    cross > 0.0
                };
                if is_concave {
                    let area = cross.abs() * 0.5;
                    if area < best_area && !state.would_create_self_intersection_after_removal(cur)
                    {
                        best_area = area;
                        best_idx = cur as i64;
                    }
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
    // For each simplified point, find all matching indices in original.
    let mut matches: Vec<Vec<usize>> = Vec::with_capacity(ns);
    for i in 0..ns {
        let (sx, sy) = (simplified[i * 2], simplified[i * 2 + 1]);
        let list: Vec<usize> = (0..no)
            .filter(|&j| original[j * 2] == sx && original[j * 2 + 1] == sy)
            .collect();
        if list.is_empty() {
            return None;
        }
        matches.push(list);
    }
    // Try each candidate for start to find a cyclic order.
    for &start in &matches[0] {
        let mut result = vec![0usize; ns];
        result[0] = start;
        let mut prev = start;
        let mut ok = true;
        for i in 1..ns {
            let candidates = &matches[i];
            let mut best: i64 = -1;
            let mut best_fwd = no + 1;
            for &idx in candidates {
                let fwd = if idx > prev {
                    idx - prev
                } else {
                    idx + no - prev
                };
                if fwd > 0 && fwd < best_fwd {
                    best_fwd = fwd;
                    best = idx as i64;
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
        // Verify close-forward
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
    nx: f64,
    ny: f64,
    c0: f64,
) -> f64 {
    let mut delta = 0.0f64;
    let mut k = start;
    for _ in 0..=no {
        let px = original[k * 2] as f64;
        let py = original[k * 2 + 1] as f64;
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

fn intersect_lines(a1: f64, b1: f64, c1: f64, a2: f64, b2: f64, c2: f64) -> Option<(f64, f64)> {
    let det = a1 * b2 - a2 * b1;
    if det.abs() < 1e-12 {
        return None;
    }
    let x = (b1 * c2 - b2 * c1) / det;
    let y = (a2 * c1 - a1 * c2) / det;
    Some((x, y))
}

fn snap_conservative(fx: f64, fy: f64, la: (f64, f64, f64), lb: (f64, f64, f64)) -> (f64, f64) {
    let cx = fx.round() as i32;
    let cy = fy.round() as i32;
    let mut best_x = cx;
    let mut best_y = cy;
    let mut best_d = f64::INFINITY;
    for radius in 0i32..=16 {
        let mut found = false;
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                let (x, y) = (cx + dx, cy + dy);
                if la.0 * x as f64 + la.1 * y as f64 + la.2 <= 1e-9
                    && lb.0 * x as f64 + lb.1 * y as f64 + lb.2 <= 1e-9
                {
                    let d = (x as f64 - fx).powi(2) + (y as f64 - fy).powi(2);
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
            return (best_x as f64, best_y as f64);
        }
    }
    // directional fallback
    let (nx, ny) = (la.0 + lb.0, la.1 + lb.1);
    let len = (nx * nx + ny * ny).sqrt();
    if len > 1e-12 {
        let (ux, uy) = (nx / len, ny / len);
        for t in 0..=64i32 {
            let x = (fx + ux * t as f64).round() as i32;
            let y = (fy + uy * t as f64).round() as i32;
            if la.0 * x as f64 + la.1 * y as f64 + la.2 <= 1e-9
                && lb.0 * x as f64 + lb.1 * y as f64 + lb.2 <= 1e-9
            {
                return (x as f64, y as f64);
            }
        }
    }
    (cx as f64, cy as f64)
}

fn extend_to_cover_original(original: &[u16], simplified: &[u16]) -> Vec<u16> {
    let orig = normalize_contour(original);
    let simp = normalize_contour(simplified);
    let no = orig.len() / 2;
    let ns = simp.len() / 2;
    if no < 3 || ns < 3 {
        return simp;
    }

    let orientation = signed_area_u16(&simp);
    let orig_indices = match map_simplified_to_original_indices(&orig, &simp) {
        Some(v) => v,
        None => return simp,
    };

    // Compute one outward-normal line per simplified edge.
    let mut lines: Vec<(f64, f64, f64)> = Vec::with_capacity(ns); // (a, b, c)
    for i in 0..ns {
        let j = (i + 1) % ns;
        let (ax, ay) = (simp[i * 2] as f64, simp[i * 2 + 1] as f64);
        let (bx, by) = (simp[j * 2] as f64, simp[j * 2 + 1] as f64);
        let dx = bx - ax;
        let dy = by - ay;
        let len = (dx * dx + dy * dy).sqrt();
        if len == 0.0 {
            return simp;
        }
        let (nx, ny) = if orientation >= 0.0 {
            (dy / len, -dx / len)
        } else {
            (-dy / len, dx / len)
        };
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
                let (sx, sy) = (simp[i * 2] as f64, simp[i * 2 + 1] as f64);
                snap_conservative(sx, sy, la, lb)
            }
        };
        out.push(x.max(0.0).min(65535.0) as u16);
        out.push(y.max(0.0).min(65535.0) as u16);
    }
    out
}

// ── Step 5: refine by sliding edges ──────────────────────────────────────────

/// Reduce collinear points from original contour (used as witness set).
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
        let (ax, ay) = (norm[prev * 2] as f64, norm[prev * 2 + 1] as f64);
        let (bx, by) = (norm[i * 2] as f64, norm[i * 2 + 1] as f64);
        let (cx, cy) = (norm[next * 2] as f64, norm[next * 2 + 1] as f64);
        let cross = orient_raw(ax, ay, bx, by, cx, cy);
        // point is between a and c?
        let between = bx >= ax.min(cx) && bx <= ax.max(cx) && by >= ay.min(cy) && by <= ay.max(cy);
        if cross != 0.0 || !between {
            keep.push(i);
        }
    }
    if keep.len() < 3 {
        return norm;
    }
    let mut out = Vec::with_capacity(keep.len() * 2);
    for &k in &keep {
        out.push(norm[k * 2]);
        out.push(norm[k * 2 + 1]);
    }
    out
}

struct SlidingPoly {
    pts: Vec<i32>,
}

impl SlidingPoly {
    fn new(cover: &[u16]) -> Self {
        let n = cover.len() / 2;
        let mut pts = vec![0i32; n * 2];
        for i in 0..cover.len() {
            pts[i] = cover[i] as i32;
        }
        SlidingPoly { pts }
    }
    fn count(&self) -> usize {
        self.pts.len() / 2
    }
    fn px(&self, i: usize) -> i32 {
        self.pts[i * 2]
    }
    fn py(&self, i: usize) -> i32 {
        self.pts[i * 2 + 1]
    }
    fn set(&mut self, i: usize, x: i32, y: i32) {
        self.pts[i * 2] = x;
        self.pts[i * 2 + 1] = y;
    }
    fn mod_idx(&self, i: i64) -> usize {
        let n = self.count() as i64;
        ((i % n + n) % n) as usize
    }
    fn signed_area(&self) -> f64 {
        let n = self.count();
        let mut sum = 0.0f64;
        for i in 0..n {
            let j = (i + 1) % n;
            sum += self.px(i) as f64 * self.py(j) as f64 - self.px(j) as f64 * self.py(i) as f64;
        }
        sum * 0.5
    }
    fn to_u16(&self) -> Vec<u16> {
        self.pts
            .iter()
            .map(|&v| v.max(0).min(65535) as u16)
            .collect()
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

fn primitive_dir(dx: i32, dy: i32) -> (i32, i32) {
    if dx == 0 && dy == 0 {
        return (0, 0);
    }
    let g = gcd_i(dx.abs(), dy.abs());
    (dx / g, dy / g)
}

fn point_on_seg_i32(ax: i32, ay: i32, bx: i32, by: i32, px: i32, py: i32) -> bool {
    let cross = (bx - ax) as i64 * (py - ay) as i64 - (by - ay) as i64 * (px - ax) as i64;
    if cross != 0 {
        return false;
    }
    px >= ax.min(bx) && px <= ax.max(bx) && py >= ay.min(by) && py <= ay.max(by)
}

fn point_in_poly_or_on_edge(poly: &SlidingPoly, px: i32, py: i32) -> bool {
    let n = poly.count();
    let mut inside = false;
    let mut j = n - 1;
    for i in 0..n {
        let (xi, yi) = (poly.px(i), poly.py(i));
        let (xj, yj) = (poly.px(j), poly.py(j));
        if point_on_seg_i32(xj, yj, xi, yi, px, py) {
            return true;
        }
        if (yi > py) != (yj > py) {
            let t = (xj - xi) as f64 * (py - yi) as f64 / (yj - yi) as f64 + xi as f64;
            if (px as f64) <= t {
                inside = !inside;
            }
        }
        j = i;
    }
    inside
}

fn would_self_intersect_after_slide(poly: &SlidingPoly, i1: usize, i2: usize) -> bool {
    let n = poly.count();
    let i0 = poly.mod_idx(i1 as i64 - 1);
    let i3 = poly.mod_idx(i2 as i64 + 1);
    let changed = [(i0, i1), (i1, i2), (i2, i3)];
    fn shares(a0: usize, a1: usize, b0: usize, b1: usize) -> bool {
        a0 == b0 || a0 == b1 || a1 == b0 || a1 == b1
    }
    fn in_changed(a: usize, b: usize, ch: &[(usize, usize)]) -> bool {
        ch.iter().any(|&(x, y)| x == a && y == b)
    }
    for &(ca, cb) in &changed {
        let a0x = poly.px(ca) as f64;
        let a0y = poly.py(ca) as f64;
        let a1x = poly.px(cb) as f64;
        let a1y = poly.py(cb) as f64;
        for i in 0..n {
            let j = (i + 1) % n;
            if shares(ca, cb, i, j) {
                continue;
            }
            if in_changed(i, j, &changed) {
                continue;
            }
            let b0x = poly.px(i) as f64;
            let b0y = poly.py(i) as f64;
            let b1x = poly.px(j) as f64;
            let b1y = poly.py(j) as f64;
            if segments_intersect(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y) {
                return true;
            }
        }
    }
    // check changed edges among themselves
    for ii in 0..changed.len() {
        let (a0, a1) = changed[ii];
        let a0x = poly.px(a0) as f64;
        let a0y = poly.py(a0) as f64;
        let a1x = poly.px(a1) as f64;
        let a1y = poly.py(a1) as f64;
        for jj in (ii + 1)..changed.len() {
            let (b0, b1) = changed[jj];
            if shares(a0, a1, b0, b1) {
                continue;
            }
            let b0x = poly.px(b0) as f64;
            let b0y = poly.py(b0) as f64;
            let b1x = poly.px(b1) as f64;
            let b1y = poly.py(b1) as f64;
            if segments_intersect(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y) {
                return true;
            }
        }
    }
    false
}

fn has_degenerate_local(poly: &SlidingPoly, i0: usize, i1: usize, i2: usize, i3: usize) -> bool {
    (poly.px(i0) == poly.px(i1) && poly.py(i0) == poly.py(i1))
        || (poly.px(i1) == poly.px(i2) && poly.py(i1) == poly.py(i2))
        || (poly.px(i2) == poly.px(i3) && poly.py(i2) == poly.py(i3))
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
        let wx = witnesses[i * 2] as i32;
        let wy = witnesses[i * 2 + 1] as i32;
        if wx < min_x || wx > max_x || wy < min_y || wy > max_y {
            continue;
        }
        if !point_in_poly_or_on_edge(poly, wx, wy) {
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
    let i0 = poly.mod_idx(edge_start as i64 - 1);
    let i1 = edge_start;
    let i2 = poly.mod_idx(edge_start as i64 + 1);
    let i3 = poly.mod_idx(edge_start as i64 + 2);
    let dir_a = primitive_dir(poly.px(i1) - poly.px(i0), poly.py(i1) - poly.py(i0));
    let dir_b = primitive_dir(poly.px(i2) - poly.px(i3), poly.py(i2) - poly.py(i3));
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
        let cur_area = poly.signed_area().abs();
        let mut best_area = cur_area;
        let mut best_step: Option<(i32, i32)> = None;
        let (old_ax, old_ay) = (poly.px(i1), poly.py(i1));
        let (old_bx, old_by) = (poly.px(i2), poly.py(i2));
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
            let area = poly.signed_area().abs();
            if area < best_area {
                // Compute local bbox for witness check
                let xs = [poly.px(i0), ax, bx, poly.px(i3), old_ax, old_bx];
                let ys = [poly.py(i0), ay, by, poly.py(i3), old_ay, old_by];
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
        // Slide until no improvement
        let mut moved = false;
        loop {
            let (cur_ax, cur_ay) = (poly.px(i1), poly.py(i1));
            let (cur_bx, cur_by) = (poly.px(i2), poly.py(i2));
            let next_ax = cur_ax + dir_a.0 * sa;
            let next_ay = cur_ay + dir_a.1 * sa;
            let next_bx = cur_bx + dir_b.0 * sb;
            let next_by = cur_by + dir_b.1 * sb;
            if next_ax == next_bx && next_ay == next_by {
                break;
            }
            let area_before = poly.signed_area().abs();
            poly.set(i1, next_ax, next_ay);
            poly.set(i2, next_bx, next_by);
            if has_degenerate_local(poly, i0, i1, i2, i3)
                || would_self_intersect_after_slide(poly, i1, i2)
            {
                poly.set(i1, cur_ax, cur_ay);
                poly.set(i2, cur_bx, cur_by);
                break;
            }
            let xs = [poly.px(i0), next_ax, next_bx, poly.px(i3), cur_ax, cur_bx];
            let ys = [poly.py(i0), next_ay, next_by, poly.py(i3), cur_ay, cur_by];
            let min_x = xs.iter().copied().min().unwrap() - 2;
            let max_x = xs.iter().copied().max().unwrap() + 2;
            let min_y = ys.iter().copied().min().unwrap() - 2;
            let max_y = ys.iter().copied().max().unwrap() + 2;
            if !all_witnesses_inside(poly, witnesses, min_x, min_y, max_x, max_y) {
                poly.set(i1, cur_ax, cur_ay);
                poly.set(i2, cur_bx, cur_by);
                break;
            }
            let area_after = poly.signed_area().abs();
            if area_after >= area_before {
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

// ── triangulate_polygon ───────────────────────────────────────────────────────

/// Triangulate a simple polygon (flat [x0,y0,...] Uint16Array) using ear-clipping
/// (port of `triangulateSimplePolygonAvoidSlivers`), then run two edge-flip passes:
///   1. Basic Lawson flip  (port of `optimizeTrianglesByEdgeFlip` in triangulate.ts)
///   2. Advanced 3-criterion flip (port of `optimizeTrianglesByEdgeFlipRepeated` in triangle-retopology.ts)
///
/// Returns flat Uint16Array of triangle vertex indices [a0,b0,c0, ...].
#[wasm_bindgen]
pub fn triangulate_polygon(polygon: &[u16]) -> Vec<u16> {
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

        // find best ear
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
    // port of `optimizeTrianglesByEdgeFlip` in triangulate.ts
    flip_edges_basic(pts, poly_sign, &mut tris);

    // ── phase 2: advanced 3-criterion flip ───────────────────────────────────
    // port of `optimizeTrianglesByEdgeFlipRepeated` in triangle-retopology.ts
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

/// Build an edge list in insertion order (mirrors JS Map insertion order).
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
/// Returns usize::MAX if not found (degenerate triangle).
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
//
// Port of `optimizeTrianglesByEdgeFlip` in triangulate.ts.
// Criterion: flip when min(minAngle of both triangles) improves.
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
//
// Port of `optimizeTrianglesByEdgeFlipRepeated` in triangle-retopology.ts.
// Tries all 4 quad orderings for convexity (catches more flippable quads than phase 1).
// 3-criterion scoring: 1) max minAngle  2) min maxAngle  3) min diagLenSq.
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
            // Try all 4 orderings for convexity (port of orderQuadAroundSharedEdge)
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
            // 3-criterion scoring (port of isPairScoreBetter)
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

// ── polygonize ────────────────────────────────────────────────────────────────

/// Run the full polygonize pipeline in one call:
///   pack_alpha_mask → extend → extract_contours → contour_to_polygon (×N) →
///   filter_contained → triangulate (×N) → serialize
///
/// Returns a Uint16Array in the same binary layout as `PolygonData.serialize`.
/// `minimal_distance` is the RDP epsilon (integer pixels), `max_point_count`
/// is the vertex-limit cap.  `offset=32` and `outline=2` are baked in.
#[wasm_bindgen]
pub fn polygonize(
    pixels: &[u8],
    width: u16,
    height: u16,
    alpha_threshold: u8,
    minimal_distance: u8,
    max_point_count: u8,
) -> Vec<u16> {
    const OFFSET: u8 = 32;
    const OUTLINE: u8 = 2;
    const CONTOUR_PAD: u8 = 1;

    let mask_w = width + OFFSET as u16 * 2;
    let mask_h = height + OFFSET as u16 * 2;

    let alpha_mask = pack_alpha_mask_bits(pixels, width, height, alpha_threshold, OFFSET);
    let extended_mask = extend_bit_mask(&alpha_mask, mask_w, mask_h, OUTLINE);
    let packed = extract_all_outer_contours(&extended_mask, mask_w, mask_h, CONTOUR_PAD);
    let raw_contours = pg_unpack_contours(&packed);

    let all_polygons: Vec<Vec<u16>> = raw_contours
        .iter()
        .map(|c| contour_to_polygon(c, minimal_distance as f64, max_point_count as u16))
        .collect();

    let filtered = pg_filter_contained(all_polygons);

    let triangles: Vec<Vec<u16>> = filtered.iter().map(|p| triangulate_polygon(p)).collect();

    pg_serialize(
        &alpha_mask,
        &raw_contours,
        &filtered,
        &triangles,
        alpha_threshold,
        minimal_distance,
        max_point_count,
        OFFSET,
        OUTLINE,
    )
}

// ── polygonize helpers ────────────────────────────────────────────────────────

/// Unpack the byte buffer produced by `extract_all_outer_contours`.
fn pg_unpack_contours(buf: &[u8]) -> Vec<Vec<u16>> {
    if buf.len() < 4 {
        return Vec::new();
    }
    let n = u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]) as usize;
    if buf.len() < 4 + n * 4 {
        return Vec::new();
    }
    let mut lengths = Vec::with_capacity(n);
    for i in 0..n {
        let o = 4 + i * 4;
        lengths.push(u32::from_le_bytes([buf[o], buf[o + 1], buf[o + 2], buf[o + 3]]) as usize);
    }
    let mut data_off = 4 + n * 4;
    let mut result = Vec::with_capacity(n);
    for &len in &lengths {
        let byte_len = len * 2;
        if data_off + byte_len > buf.len() {
            break;
        }
        let mut contour = Vec::with_capacity(len);
        for j in 0..len {
            let o = data_off + j * 2;
            contour.push(u16::from_le_bytes([buf[o], buf[o + 1]]));
        }
        data_off += byte_len;
        result.push(contour);
    }
    result
}

fn pg_contour_bbox(pts: &[u16]) -> (f64, f64, f64, f64) {
    let n = pts.len() / 2;
    if n == 0 {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let (mut min_x, mut max_x) = (pts[0] as f64, pts[0] as f64);
    let (mut min_y, mut max_y) = (pts[1] as f64, pts[1] as f64);
    for i in 1..n {
        let x = pts[i * 2] as f64;
        let y = pts[i * 2 + 1] as f64;
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

fn pg_point_in_poly_or_edge(poly: &[u16], px: f64, py: f64) -> bool {
    let n = poly.len() / 2;
    let mut inside = false;
    let mut j = n - 1;
    for i in 0..n {
        let (xi, yi) = (poly[i * 2] as f64, poly[i * 2 + 1] as f64);
        let (xj, yj) = (poly[j * 2] as f64, poly[j * 2 + 1] as f64);
        // point on segment?
        if orient_raw(xj, yj, xi, yi, px, py) == 0.0
            && px >= xj.min(xi)
            && px <= xj.max(xi)
            && py >= yj.min(yi)
            && py <= yj.max(yi)
        {
            return true;
        }
        if (yi > py) != (yj > py) && px <= (xj - xi) * (py - yi) / (yj - yi) + xi {
            inside = !inside;
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
        let (a0x, a0y) = (a[i * 2] as f64, a[i * 2 + 1] as f64);
        let (a1x, a1y) = (a[i2 * 2] as f64, a[i2 * 2 + 1] as f64);
        for j in 0..nb {
            let j2 = (j + 1) % nb;
            if segments_intersect(
                a0x,
                a0y,
                a1x,
                a1y,
                b[j * 2] as f64,
                b[j * 2 + 1] as f64,
                b[j2 * 2] as f64,
                b[j2 * 2 + 1] as f64,
            ) {
                return true;
            }
        }
    }
    false
}

fn pg_is_inside(inner: &[u16], outer: &[u16]) -> bool {
    if inner.len() < 6 || outer.len() < 6 {
        return false;
    }
    if pg_contours_intersect(inner, outer) {
        return false;
    }
    pg_point_in_poly_or_edge(outer, inner[0] as f64, inner[1] as f64)
}

fn pg_filter_contained(contours: Vec<Vec<u16>>) -> Vec<Vec<u16>> {
    let n = contours.len();
    if n == 0 {
        return Vec::new();
    }
    let normalized: Vec<Vec<u16>> = contours
        .into_iter()
        .map(|c| normalize_contour(&c))
        .collect();
    let bboxes: Vec<(f64, f64, f64, f64)> = normalized.iter().map(|c| pg_contour_bbox(c)).collect();
    let areas: Vec<f64> = normalized
        .iter()
        .map(|c| signed_area_u16(c).abs())
        .collect();
    let mut removed = vec![false; n];
    for i in 0..n {
        if removed[i] {
            continue;
        }
        for j in 0..n {
            if i == j || removed[i] {
                continue;
            }
            if areas[i] > areas[j] {
                continue;
            }
            // bbox_contains(outer=j, inner=i)
            let (bimx, bimy, bixx, bixy) = bboxes[i];
            let (bjmx, bjmy, bjxx, bjxy) = bboxes[j];
            if bimx < bjmx || bixx > bjxx || bimy < bjmy || bixy > bjxy {
                continue;
            }
            if pg_is_inside(&normalized[i], &normalized[j]) {
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

fn pg_write_section(buf: &mut Vec<u16>, cursor: &mut usize, arrays: &[Vec<u16>]) {
    buf[*cursor] = arrays.len() as u16;
    *cursor += 1;
    for arr in arrays {
        buf[*cursor] = arr.len() as u16;
        *cursor += 1;
        for &v in arr {
            buf[*cursor] = v;
            *cursor += 1;
        }
    }
}

fn pg_serialize(
    alpha_mask: &[u8],
    raw_contours: &[Vec<u16>],
    polygons: &[Vec<u16>],
    triangles: &[Vec<u16>],
    alpha_threshold: u8,
    minimal_distance: u8,
    max_point_count: u8,
    offset: u8,
    outline: u8,
) -> Vec<u16> {
    fn sec_len(a: &[Vec<u16>]) -> usize {
        1 + a.iter().map(|v| 1 + v.len()).sum::<usize>()
    }
    let alpha_mask_words = (alpha_mask.len() + 1) / 2;
    let total =
        3 + 2 + alpha_mask_words + sec_len(raw_contours) + sec_len(polygons) + sec_len(triangles);
    let mut buf = vec![0u16; total];
    let mut c = 0usize;

    // header
    buf[c] = ((alpha_threshold as u16) << 8) | (max_point_count as u16);
    c += 1;
    buf[c] = ((offset as u16) << 8) | (minimal_distance as u16);
    c += 1;
    buf[c] = outline as u16;
    c += 1;

    // alpha mask byte length (u32 split into two u16)
    let bl = alpha_mask.len() as u32;
    buf[c] = ((bl >> 16) & 0xffff) as u16;
    c += 1;
    buf[c] = (bl & 0xffff) as u16;
    c += 1;

    // alpha mask data: two bytes per u16, little-endian
    let mut i = 0;
    while i < alpha_mask.len() {
        let lo = alpha_mask[i] as u16;
        let hi = if i + 1 < alpha_mask.len() {
            alpha_mask[i + 1] as u16
        } else {
            0
        };
        buf[c] = (hi << 8) | lo;
        c += 1;
        i += 2;
    }

    pg_write_section(&mut buf, &mut c, raw_contours);
    pg_write_section(&mut buf, &mut c, polygons);
    pg_write_section(&mut buf, &mut c, triangles);
    buf
}
