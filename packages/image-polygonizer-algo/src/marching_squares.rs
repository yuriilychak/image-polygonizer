// ── marching squares contour extraction ──────────────────────────────────────

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
fn sq_val(bits: &[u8], w: usize, x: i16, y: i16) -> u8 {
    let w = w as i32;
    let (x, y) = (x as i32, y as i32);
    let o1 = ms_get(bits, ((y - 1) * w + (x - 1)) as usize) as u8;
    let o2 = ms_get(bits, ((y - 1) * w + x) as usize) as u8;
    let o4 = ms_get(bits, (y * w + (x - 1)) as usize) as u8;
    let o8 = ms_get(bits, (y * w + x) as usize) as u8;
    o1 | (o2 << 1) | (o4 << 2) | (o8 << 3)
}

fn find_seed(bits: &[u8], w: usize, x0: i16, y0: i16, x1: i16, y1: i16) -> Option<(i16, i16)> {
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
    seed: (i16, i16),
) -> (Vec<u32>, (i16, i16)) {
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
        let y = (i / w) as i16;
        let x = (i - y as usize * w) as i16;

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
        if x + 1 < w as i16 {
            try_nb!(i + 1);
        }
        if y > 0 {
            try_nb!(i - w);
        }
        if y + 1 < h as i16 {
            try_nb!(i + w);
        }
    }

    (list, left)
}

const START_OFF: [(i16, i16); 4] = [(0, 0), (1, 0), (0, 1), (1, 1)];

fn find_start_sq(
    bits: &[u8],
    w: usize,
    x0: i16,
    y0: i16,
    x1: i16,
    y1: i16,
    p: (i16, i16),
) -> Option<(i16, i16)> {
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
    for dy in -8i16..=8 {
        let sy = p.1 + dy;
        if sy < y0 || sy > y1 {
            continue;
        }
        for dx in -8i16..=8 {
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
    pad: i16,
    x0: i16,
    y0: i16,
    x1: i16,
    y1: i16,
    start: (i16, i16),
    max_steps: usize,
) -> Vec<u16> {
    let toggle_bytes = (w * h + 7) >> 3;
    let mut t9 = vec![0u8; toggle_bytes];
    let mut t6 = vec![0u8; toggle_bytes];

    let mut out: Vec<u16> = Vec::with_capacity(512);
    let mut prev_step: (i16, i16) = (2, 2); // sentinel — can't be a real step
    let mut cur = start;

    for _ in 0..max_steps {
        if cur.0 < x0 || cur.1 < y0 || cur.0 > x1 || cur.1 > y1 {
            break;
        }

        let sv = sq_val(bits, w, cur.0, cur.1);

        let step: (i16, i16) = match sv {
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

/// Extract outer contours from a padded 1-bit-per-pixel LSB-first bitmask.
///
/// Returns each contour as a flat `Vec<u16>` of interleaved (x, y) pairs
/// with the bitmask padding already subtracted.
pub(crate) fn extract_all_outer_contours(
    input_bits: &[u8],
    width: u16,
    height: u16,
    padding: u8,
) -> Vec<Vec<u16>> {
    let w = width as usize;
    let h = height as usize;
    let pad = padding as i16;

    let byte_count = (w * h + 7) >> 3;
    let mut bits = vec![0u8; byte_count];
    let copy_len = input_bits.len().min(byte_count);
    bits[..copy_len].copy_from_slice(&input_bits[..copy_len]);

    let x0 = pad;
    let y0 = pad;
    let x1 = w as i16 - 1 - pad;
    let y1 = h as i16 - 1 - pad;
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

    contours
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_mask(width: usize, height: usize) -> Vec<u8> {
        vec![0u8; (width * height + 7) / 8]
    }

    fn set_bit(mask: &mut [u8], idx: usize) {
        mask[idx >> 3] |= 1 << (idx & 7);
    }

    fn set_rect(mask: &mut [u8], width: usize, x0: usize, y0: usize, x1: usize, y1: usize) {
        for y in y0..=y1 {
            for x in x0..=x1 {
                set_bit(mask, y * width + x);
            }
        }
    }

    #[test]
    fn test_empty_mask_no_contours() {
        let mask = vec![0u8; 4];
        let result = extract_all_outer_contours(&mask, 5, 5, 0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_single_pixel_one_contour() {
        let mut mask = make_mask(10, 10);
        set_bit(&mut mask, 5 * 10 + 5);
        let result = extract_all_outer_contours(&mask, 10, 10, 1);
        assert_eq!(result.len(), 1);
        assert!(!result[0].is_empty());
    }

    #[test]
    fn test_filled_rect_one_contour() {
        let mut mask = make_mask(20, 20);
        set_rect(&mut mask, 20, 7, 7, 12, 12);
        let result = extract_all_outer_contours(&mask, 20, 20, 1);
        assert_eq!(result.len(), 1);
        assert!(!result[0].is_empty());
    }

    #[test]
    fn test_two_blocks_two_contours() {
        let mut mask = make_mask(30, 10);
        set_rect(&mut mask, 30, 2, 2, 5, 5);
        set_rect(&mut mask, 30, 20, 2, 23, 5);
        let result = extract_all_outer_contours(&mask, 30, 10, 1);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_fully_filled_mask_no_panic() {
        let w: usize = 8;
        let h: usize = 8;
        let mut mask = make_mask(w, h);
        set_rect(&mut mask, w, 0, 0, w - 1, h - 1);
        // Just verify it doesn't panic
        let _result = extract_all_outer_contours(&mask, w as u16, h as u16, 1);
    }

    #[test]
    fn test_large_mask_valid_coords() {
        let w: usize = 50;
        let h: usize = 50;
        let mut mask = make_mask(w, h);
        set_rect(&mut mask, w, 20, 20, 29, 29);
        let result = extract_all_outer_contours(&mask, w as u16, h as u16, 2);
        assert_eq!(result.len(), 1);
        assert!(!result[0].is_empty());
        for &v in &result[0] {
            assert!(v < w as u16, "coordinate {} out of bounds for width {}", v, w);
        }
    }

    #[test]
    fn test_padding_excludes_corner_pixel() {
        // Pixel at (0,0) is outside the scan area when padding=2
        let mut mask = make_mask(10, 10);
        set_bit(&mut mask, 0 * 10 + 0);
        let result = extract_all_outer_contours(&mask, 10, 10, 2);
        assert!(result.is_empty());
    }

    #[test]
    fn test_contour_coordinates_account_for_padding() {
        // Block at (5,5)-(9,9), pad=1 → contour coords in [4..=9]
        let w: usize = 15;
        let h: usize = 15;
        let pad: u8 = 1;
        let mut mask = make_mask(w, h);
        set_rect(&mut mask, w, 5, 5, 9, 9);
        let result = extract_all_outer_contours(&mask, w as u16, h as u16, pad);
        assert_eq!(result.len(), 1);
        let contour = &result[0];
        assert!(!contour.is_empty());
        // Even indices are x, odd are y; both should be in [4..=9]
        for (i, &v) in contour.iter().enumerate() {
            let axis = if i % 2 == 0 { "x" } else { "y" };
            assert!(
                (4..=9).contains(&v),
                "{} coordinate {} out of expected range [4, 9]",
                axis,
                v
            );
        }
    }
}
