import { ConvertError } from "./errors";

export const isHeic = (file: File) => /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);

/** Opens any picture the browser can read (and iPhone HEIC pictures, with a helper), respecting the photo's rotation. */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  let source: Blob = file;
  if (isHeic(file)) {
    try {
      const { default: heic2any } = await import("heic2any");
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
      source = Array.isArray(out) ? out[0] : out;
    } catch {
      throw new ConvertError(`"${file.name}" could not be read. It may not be a valid HEIC photo.`);
    }
  }
  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new ConvertError(`"${file.name}" could not be read as a picture. It may be damaged or in a format this browser cannot open.`);
  }
}

export interface DrawOptions {
  /** Longest side in pixels; 0 keeps the original size. */
  maxSide: number;
  /** Paint a white background first (needed for JPEG, which has no transparency). */
  whiteBackground: boolean;
}

export function drawToCanvas(bitmap: ImageBitmap, { maxSide, whiteBackground }: DrawOptions): HTMLCanvasElement {
  const scale = maxSide > 0 ? Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ConvertError("This browser could not prepare the picture. Try a smaller one.");
  if (whiteBackground) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new ConvertError("The picture could not be saved. Try a smaller one."));
        else if (blob.type !== mime) reject(new ConvertError(`This browser cannot save ${mime.replace("image/", "").toUpperCase()} pictures. Try JPG or PNG.`));
        else resolve(blob);
      },
      mime,
      quality,
    );
  });
}
