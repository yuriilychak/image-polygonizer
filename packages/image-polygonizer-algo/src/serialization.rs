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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_encoding() {
        let result = pg_serialize(&[], &[], &[], &[], 128, 8, 32, 4, 2);
        assert_eq!(result[0], (128u16 << 8) | 32); // alpha_threshold=128, max_point_count=32
        assert_eq!(result[1], (4u16 << 8) | 8);    // offset=4, minimal_distance=8
        assert_eq!(result[2], 2);                   // outline=2
    }

    #[test]
    fn empty_alpha_mask() {
        let result = pg_serialize(&[], &[], &[], &[], 128, 8, 32, 4, 2);
        assert_eq!(result[3], 0); // high word of byte length 0
        assert_eq!(result[4], 0); // low word of byte length 0
    }

    #[test]
    fn alpha_mask_byte_length_encoding() {
        let result = pg_serialize(&[0xAB, 0xCD], &[], &[], &[], 1, 8, 32, 4, 2);
        assert_eq!(result[3], 0); // high word of 2
        assert_eq!(result[4], 2); // low word of 2
    }

    #[test]
    fn alpha_mask_data_encoding() {
        let result = pg_serialize(&[0xAB, 0xCD], &[], &[], &[], 1, 8, 32, 4, 2);
        // little-endian: lo=alpha_mask[0]=0xAB, hi=alpha_mask[1]=0xCD
        assert_eq!(result[5], (0xCDu16 << 8) | 0xAB);
    }

    #[test]
    fn odd_length_alpha_mask_padding() {
        let result = pg_serialize(&[0xFF], &[], &[], &[], 1, 8, 32, 4, 2);
        assert_eq!(result[4], 1);      // byte length = 1
        assert_eq!(result[5], 0x00FF); // hi=0 (padding), lo=0xFF
    }

    #[test]
    fn empty_sections() {
        let result = pg_serialize(&[], &[], &[], &[], 1, 8, 32, 4, 2);
        // header(3) + mask_len(2) + mask_data(0) = index 5
        assert_eq!(result[5], 0); // raw_contours count
        assert_eq!(result[6], 0); // polygons count
        assert_eq!(result[7], 0); // triangles count
    }

    #[test]
    fn section_with_one_entry() {
        let result = pg_serialize(&[], &[], &[vec![10u16, 20, 30, 40]], &[], 1, 8, 32, 4, 2);
        // header(3) + mask_len(2) + mask_data(0) = 5
        assert_eq!(result[5], 0);  // raw_contours count
        assert_eq!(result[6], 1);  // polygons count
        assert_eq!(result[7], 4);  // polygon[0].len() = 4
        assert_eq!(result[8], 10);
        assert_eq!(result[9], 20);
        assert_eq!(result[10], 30);
        assert_eq!(result[11], 40);
        assert_eq!(result[12], 0); // triangles count
    }

    #[test]
    fn total_length_calculation() {
        fn sec_len(a: &[Vec<u16>]) -> usize {
            1 + a.iter().map(|v| 1 + v.len()).sum::<usize>()
        }
        let alpha_mask = [1u8, 2, 3, 4]; // 4 bytes → 2 words
        let polygons = [vec![10u16, 20, 30, 40]];
        let result = pg_serialize(&alpha_mask, &[], &polygons, &[], 1, 8, 32, 4, 2);
        // total = 3 + 2 + alpha_mask_words(2) + sec_len([]) + sec_len([vec![..4..]]) + sec_len([])
        //       = 3 + 2 + 2 + 1 + 6 + 1 = 15
        let expected = 3 + 2 + 2 + sec_len(&[]) + sec_len(&polygons) + sec_len(&[]);
        assert_eq!(result.len(), expected);
    }

    #[test]
    fn multiple_contours() {
        let contours = [vec![1u16, 2, 3, 4], vec![5u16, 6]];
        let result = pg_serialize(&[], &contours, &[], &[], 1, 8, 32, 4, 2);
        // header(3) + mask_len(2) + mask_data(0) = index 5
        assert_eq!(result[5], 2);  // 2 contours
        assert_eq!(result[6], 4);  // contour[0] length
        assert_eq!(result[7], 1);
        assert_eq!(result[8], 2);
        assert_eq!(result[9], 3);
        assert_eq!(result[10], 4);
        assert_eq!(result[11], 2); // contour[1] length
        assert_eq!(result[12], 5);
        assert_eq!(result[13], 6);
    }
}
