// ── polygon data serialization ────────────────────────────────────────────────

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

pub(crate) fn pg_serialize(
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
