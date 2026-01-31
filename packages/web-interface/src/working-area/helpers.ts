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

type DrawTransparentOverlayOptions = {
  offsetX: number;
  offsetY: number;
  scale: number;             // 1..N
  padding?: number;          // якщо маска padded і треба ігнорувати padding
  colorRGBA?: [number, number, number, number]; // overlay color for transparent pixels
  clearTemp?: boolean;       // очищати тимчасовий буфер перед малюванням (true за замовч.)
};

/**
 * Малює "transparent" пікселі (bit=0) як напівпрозорий оверлей на поточний canvas.
 * bits: LSB-first, 1 bit per pixel, 1 = opaque, 0 = transparent.
 *
 * Важливо: використовує offscreen буфер і drawImage -> альфа буде змішуватись коректно.
 */
export function drawTransparentPixelsOverlay(
  ctx: CanvasRenderingContext2D,
  bits: Uint8Array,
  width: number,
  height: number,
  opts: DrawTransparentOverlayOptions
): void {
  const {
    offsetX,
    offsetY,
    scale,
    padding = 0,
    colorRGBA = [255, 0, 0, 96], // напівпрозорий червоний
    clearTemp = true,
  } = opts;

  if (scale <= 0) return;

  const drawW = width - padding * 2;
  const drawH = height - padding * 2;
  if (drawW <= 0 || drawH <= 0) return;

  const outW = drawW * scale;
  const outH = drawH * scale;

  // Тимчасовий canvas (in-memory). У браузері можна OffscreenCanvas, якщо доступний.
  const tmpCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(outW, outH)
      : (() => {
        const c = document.createElement("canvas");
        c.width = outW;
        c.height = outH;
        return c;
      })();

  const tmpCtx = (tmpCanvas as any).getContext("2d") as CanvasRenderingContext2D;
  if (!tmpCtx) return;

  if (clearTemp) tmpCtx.clearRect(0, 0, outW, outH);

  // Створюємо ImageData тільки для самого оверлею
  const img = tmpCtx.createImageData(outW, outH);
  const data = img.data;

  const [r, g, b, a] = colorRGBA;

  const getBit01 = (idx: number) => (bits[idx >>> 3] >>> (idx & 7)) & 1;

  for (let y = 0; y < drawH; y++) {
    const srcY = y + padding;
    const srcRowBase = srcY * width;

    const oy0 = y * scale;

    for (let x = 0; x < drawW; x++) {
      const srcX = x + padding;
      const srcIdx = srcRowBase + srcX;

      // "transparent" => bit == 0
      if (getBit01(srcIdx) === 1) {
        const ox0 = x * scale;

        // заповнюємо scale x scale блок RGBA
        for (let sy = 0; sy < scale; sy++) {
          let p = ((oy0 + sy) * outW + ox0) * 4;
          for (let sx = 0; sx < scale; sx++) {
            data[p] = r;
            data[p + 1] = g;
            data[p + 2] = b;
            data[p + 3] = a;
            p += 4;
          }
        }
      }
    }
  }

  // Малюємо в tmp, потім drawImage на основний canvas (альфа змішується правильно)
  tmpCtx.putImageData(img, 0, 0);
  ctx.drawImage(tmpCanvas as any, offsetX, offsetY);
}

type DrawContoursOptions = {
  offsetX: number;
  offsetY: number;
  scale: number;          // 1..N (може бути і дробовий)
  color?: string;         // будь-який валідний CSS color
  fillAlpha?: number;     // за замовчуванням 0.5
  lineWidth?: number;     // товщина лінії у "екранних" пікселях (після scale)
  closePath?: boolean;    // за замовчуванням true
};

/**
 * Малює один контур (Uint16Array: [x0,y0,x1,y1,...]) з заливкою (50% alpha) і обводкою (100%).
 * Координати контуру очікуються БЕЗ padding (як з extractAllOuterContours).
 */
export function drawContourOverlay(
  ctx: CanvasRenderingContext2D,
  contour: Uint16Array,
  opts: DrawContoursOptions
): void {
  const {
    offsetX,
    offsetY,
    scale,
    color = "rgba(0, 255, 255, 1)", // бірюзовий за замовч.
    fillAlpha = 0.5,
    lineWidth = 1,
    closePath = true,
  } = opts;

  if (scale <= 0) return;
  if (contour.length < 4) return; // мінімум 1 точка (x,y) -> але контур безглуздий

  ctx.save();

  // Трансформація: спочатку translate, потім scale.
  // Тепер координати контуру (в пікселях зображення) малюються з масштабом і зсувом.
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // lineWidth заданий у "екранних" пікселях -> у просторі після scale треба поділити на scale
  ctx.lineWidth = lineWidth / scale;

  // Побудувати шлях
  ctx.beginPath();
  ctx.moveTo(contour[0], contour[1]);
  for (let i = 2; i < contour.length; i += 2) {
    ctx.lineTo(contour[i], contour[i + 1]);
  }
  if (closePath) ctx.closePath();

  // Fill з альфою
  ctx.fillStyle = color;
  ctx.globalAlpha = fillAlpha;
  ctx.fill();

  // Stroke без альфи (суцільний)
  ctx.strokeStyle = color;
  ctx.globalAlpha = 1.0;
  ctx.stroke();

  ctx.restore();
}

/**
 * Малює масив контурів.
 */
export function drawContoursOverlay(
  ctx: CanvasRenderingContext2D,
  contours: Uint16Array[],
  opts: DrawContoursOptions
): void {
  for (let i = 0; i < contours.length; i++) {
    drawContourOverlay(ctx, contours[i], opts);
  }
}


type DrawPolygonOptions = {
  offsetX: number;
  offsetY: number;
  scale?: number;            // default 1
  color?: string;            // default "rgb(0,255,255)"
  fillAlpha?: number;        // default 0.5
  lineWidth?: number;        // in screen px, default 2
  vertexSize?: number;       // in screen px, default 6
  closePath?: boolean;       // default true
};

type PolygonLike = Uint16Array | Uint32Array | number[];

/**
 * Малює один полігон:
 * - заливка тим самим кольором з alpha=0.5
 * - лінії між вершинами
 * - вершини як квадрати
 */
export function drawPolygonDebug(
  ctx: CanvasRenderingContext2D,
  poly: PolygonLike,
  opts: DrawPolygonOptions
): void {
  const {
    offsetX,
    offsetY,
    scale = 1,
    color = "rgb(0,255,255)",
    fillAlpha = 0.5,
    lineWidth = 2,
    vertexSize = 6,
    closePath = true,
  } = opts;

  const len = poly.length | 0;
  if (len < 4) return; // менше ніж 2 координати

  ctx.save();

  // transform: (x,y) -> (offset + x*scale, offset + y*scale)
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // lineWidth / vertexSize задані в "екранних" px -> переводимо в локальні (після scale)
  const lw = lineWidth / scale;
  const vs = vertexSize / scale;
  const half = vs * 0.5;

  // ---------- path ----------
  ctx.beginPath();
  ctx.moveTo(poly[0] as number, poly[1] as number);
  for (let i = 2; i < len; i += 2) {
    ctx.lineTo(poly[i] as number, poly[i + 1] as number);
  }
  if (closePath) ctx.closePath();

  // ---------- fill (alpha=0.5) ----------
  ctx.fillStyle = color;
  ctx.globalAlpha = fillAlpha;
  ctx.fill();

  // ---------- stroke (solid) ----------
  ctx.strokeStyle = color;
  ctx.globalAlpha = 1.0;
  ctx.lineWidth = lw;
  ctx.stroke();

  // ---------- vertices as squares ----------
  ctx.fillStyle = color;
  for (let i = 0; i < len; i += 2) {
    const x = poly[i] as number;
    const y = poly[i + 1] as number;
    ctx.fillRect(x - half, y - half, vs, vs);
  }

  ctx.restore();
}

/**
 * Малює список полігонів.
 */
export function drawPolygonsDebug(
  ctx: CanvasRenderingContext2D,
  polygons: PolygonLike[],
  opts: DrawPolygonOptions
): void {
  for (let i = 0; i < polygons.length; i++) {
    drawPolygonDebug(ctx, polygons[i], opts);
  }
}


