// Integration tests for image_polygonizer_algo::polygonize

#[test]
fn all_transparent_image_produces_valid_output() {
    // 10x10 RGBA image, all pixels transparent (alpha=0)
    let pixels: Vec<u8> = vec![0u8; 10 * 10 * 4];
    let result = image_polygonizer_algo::polygonize(&pixels, 10, 10, 1, 4, 32);
    assert!(result.len() >= 8, "output too short: {}", result.len());
    // Header word 0: (alpha_threshold << 8) | max_point_count
    assert_eq!(result[0], (1u16 << 8) | 32);
    // Header word 1: (offset << 8) | minimal_distance, offset=32 baked in
    assert_eq!(result[1], (32u16 << 8) | 4);
    // Header word 2: outline=2 baked in
    assert_eq!(result[2], 2);
}

#[test]
fn all_opaque_image_produces_polygons() {
    // 20x20 image, all pixels fully opaque
    let mut pixels: Vec<u8> = vec![0u8; 20 * 20 * 4];
    for i in 0..(20 * 20) {
        pixels[i * 4 + 3] = 255;
    }
    let result = image_polygonizer_algo::polygonize(&pixels, 20, 20, 1, 4, 32);
    assert!(result.len() > 8);
    assert_eq!(result[0], (1u16 << 8) | 32);
    assert!(result.len() > 50, "expected non-trivial output, got {} words", result.len());
}

#[test]
fn single_pixel_does_not_panic() {
    // 10x10 image with one opaque pixel at (5,5)
    let mut pixels: Vec<u8> = vec![0u8; 10 * 10 * 4];
    let idx = (5 * 10 + 5) * 4;
    pixels[idx + 3] = 255;
    let result = image_polygonizer_algo::polygonize(&pixels, 10, 10, 1, 1, 32);
    assert!(result.len() >= 8);
    assert_eq!(result[0], (1u16 << 8) | 32);
}

#[test]
fn threshold_filtering() {
    // All pixels with alpha=50
    let mut pixels: Vec<u8> = vec![0u8; 10 * 10 * 4];
    for i in 0..(10 * 10) {
        pixels[i * 4 + 3] = 50;
    }
    // High threshold: nothing found
    let result_high = image_polygonizer_algo::polygonize(&pixels, 10, 10, 100, 4, 32);
    // Low threshold: everything found
    let result_low = image_polygonizer_algo::polygonize(&pixels, 10, 10, 1, 4, 32);

    assert!(result_high.len() >= 8);
    assert!(result_low.len() >= 8);
    // Low threshold should produce more (or equal) output than high threshold
    assert!(result_low.len() >= result_high.len());
}

#[test]
fn output_is_deterministic() {
    let mut pixels: Vec<u8> = vec![0u8; 15 * 15 * 4];
    for i in 0..(15 * 15) {
        pixels[i * 4 + 3] = 255;
    }
    let result1 = image_polygonizer_algo::polygonize(&pixels, 15, 15, 1, 4, 32);
    let result2 = image_polygonizer_algo::polygonize(&pixels, 15, 15, 1, 4, 32);
    assert_eq!(result1, result2);
}

#[test]
fn various_sizes_do_not_panic() {
    for (w, h) in [(1u16, 1u16), (5, 5), (10, 10), (50, 50)] {
        let pixels = vec![255u8; w as usize * h as usize * 4];
        let _ = image_polygonizer_algo::polygonize(&pixels, w, h, 1, 4, 32);
    }
}
