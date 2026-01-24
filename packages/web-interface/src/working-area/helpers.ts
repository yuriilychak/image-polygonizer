export function createBackgroundPatern(): OffscreenCanvas {
  const result = new OffscreenCanvas(128, 128); // Width and height of one pattern tile
  const context = result.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const halfWidth = result.width >> 1;
  const halfHeight = result.height >> 1;

  context.fillStyle = '#7e8188'; // Light gray background
  context.fillRect(0, 0, result.width, result.height);
  context.fillStyle = '#6e6f73'; // Dark gray stripes
  context.fillRect(0, 0, halfWidth, halfHeight);
  context.fillRect(halfWidth, halfHeight, halfWidth, halfHeight);

  return result;
}
