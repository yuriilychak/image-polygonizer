// ── pack_alpha_mask_bits ──────────────────────────────────────────────────────

/// Pack the alpha channel of an RGBA pixel buffer into a 1-bit-per-pixel bitmask.
///
/// Layout: LSB-first, row-major, with an optional zero-padded border of `offset`
/// pixels on all four sides. Pixels whose alpha >= threshold are set to 1.
pub(crate) fn pack_alpha_mask_bits(
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
pub(crate) fn extend_bit_mask(mask: &[u8], width: u16, height: u16, outline_size: u8) -> Vec<u8> {
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
