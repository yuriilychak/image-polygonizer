use wasm_bindgen::prelude::*;

mod bitmask;
mod marching_squares;
mod polygon;
mod serialization;
mod triangulation;
mod utils;

use bitmask::{extend_bit_mask, pack_alpha_mask_bits};
use marching_squares::extract_all_outer_contours;
use polygon::{contour_to_polygon, pg_filter_contained};
use serialization::pg_serialize;
use triangulation::triangulate_polygon;

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
    let raw_contours = extract_all_outer_contours(&extended_mask, mask_w, mask_h, CONTOUR_PAD);

    let all_polygons: Vec<Vec<u16>> = raw_contours
        .iter()
        .map(|c| contour_to_polygon(c, minimal_distance, max_point_count))
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
