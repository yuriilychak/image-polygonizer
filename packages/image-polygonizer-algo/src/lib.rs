mod utils;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// A point in 2D space
#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[wasm_bindgen]
impl Point {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64) -> Point {
        Point { x, y }
    }
}

/// Main algorithm struct for polygonization
#[wasm_bindgen]
pub struct PolygonizerAlgorithm {
    max_vertices: usize,
    tolerance: f64,
}

#[wasm_bindgen]
impl PolygonizerAlgorithm {
    #[wasm_bindgen(constructor)]
    pub fn new(max_vertices: usize, tolerance: f64) -> PolygonizerAlgorithm {
        utils::set_panic_hook();
        PolygonizerAlgorithm {
            max_vertices,
            tolerance,
        }
    }

    /// Process image data and return polygonized contours
    /// This is a placeholder implementation
    pub fn process(&self, _width: u32, _height: u32, _data: &[u8]) -> Vec<f64> {
        // Placeholder: return an empty vector
        // In a real implementation, this would:
        // 1. Detect non-transparent regions
        // 2. Trace contours (e.g., marching squares)
        // 3. Simplify with RDP algorithm
        vec![]
    }

    /// Get the maximum number of vertices
    pub fn max_vertices(&self) -> usize {
        self.max_vertices
    }

    /// Get the tolerance value
    pub fn tolerance(&self) -> f64 {
        self.tolerance
    }
}

/// Simple greeter function for testing
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Image Polygonizer WASM is ready.", name)
}
