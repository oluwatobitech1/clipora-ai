import { ConvertError } from "./errors";
import { toBlob } from "./bytes";
import { blocksToText, type DocModel } from "./blocks";
import { blocksToDocx, docxBlob } from "./docxWriter";
import { blocksToPdf, imagesToPdf, pdfBlob, type PdfImage } from "./pdfWriter";
import { modelToMobi, mobiBlob } from "./mobi";
import { readDocx, readEpub, readHtml, readPdf, readPlainText } from "./docRead";
import { getExtension } from "@framevox/shared";
import type { ToolDef } from "./tools";
import { AUDIO_MIME, VIDEO_MIME, audioPlan, gifPlan, videoPlan, type AudioFormat, type VideoFormat } from "./mediaPlans";

export interface ResultFile {
  name: string;
  blob: Blob;
}

export interface RunContext {
  files: File[];
  output: string;
  options: Record<string, string>;
  /** Overall progress from 0 to 1. */
  onProgress: (fraction: number) => void;
  isCancelled: () => boolean;
}

const baseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "file";
const ext = (name: string) => getExtension(name).replace(/^\./, "").toLowerCase();

/** Gives each output a unique name, so two files called "photo" do not overwrite each other. */
function uniqueNamer() {
  const used = new Map<string, number>();
  return (name: string) => {
    const n = used.get(name) ?? 0;
    used.set(name, n + 1);
    return n === 0 ? name : name.replace(/(\.[^.]+)$/, `-${n}$1`);
  };
}

export async function runTool(tool: ToolDef, ctx: RunContext): Promise<ResultFile[]> {
  const total = ctx.files.length;
  const name = uniqueNamer();
  const results: ResultFile[] = [];

  if (tool.engine === "images-to-pdf") return imagesPdf(ctx);

  for (let i = 0; i < total; i++) {
    const file = ctx.files[i];
    if (ctx.isCancelled()) throw new ConvertError("Cancelled.");
    const part = (p: number) => ctx.onProgress((i + Math.min(1, Math.max(0, p))) / total);
    const out = baseName(file.name);
    switch (tool.engine) {
      case "video": {
        const { runFfmpeg } = await import("./ffmpegRun");
        const f = ctx.output as VideoFormat;
        const blob = await runFfmpeg(file, `out.${f}`, VIDEO_MIME[f], (input, info) => videoPlan(f, ctx.options.height ?? "original", input, info), part);
        results.push({ name: name(`${out}.${f}`), blob });
        break;
      }
      case "gif": {
        const { runFfmpeg } = await import("./ffmpegRun");
        const blob = await runFfmpeg(file, "out.gif", "image/gif", (input, info) => gifPlan(ctx.options.fps ?? "10", ctx.options.width ?? "480", ctx.options.seconds ?? "10", input, info), part);
        results.push({ name: name(`${out}.gif`), blob });
        break;
      }
      case "audio": {
        const { runFfmpeg } = await import("./ffmpegRun");
        const f = ctx.output as AudioFormat;
        const blob = await runFfmpeg(file, `out.${f}`, AUDIO_MIME[f], (input, info) => audioPlan(f, ctx.options.bitrate ?? "auto", input, info), part);
        results.push({ name: name(`${out}.${f}`), blob });
        break;
      }
      case "image": {
        const { decodeImage, drawToCanvas, canvasToBlob } = await import("./imageConvert");
        const mime = ctx.output === "jpg" ? "image/jpeg" : `image/${ctx.output}`;
        const bitmap = await decodeImage(file);
        const canvas = drawToCanvas(bitmap, { maxSide: Number(ctx.options.maxSide ?? 0), whiteBackground: ctx.output === "jpg" });
        bitmap.close();
        const blob = await canvasToBlob(canvas, mime, Number(ctx.options.quality ?? 90) / 100);
        results.push({ name: name(`${out}.${ctx.output}`), blob });
        part(1);
        break;
      }
      case "pdf-to-jpg":
        results.push(...(await pdfToImages(file, ctx, part, name)));
        break;
      case "document": {
        const model = await readModel(file, part);
        const done = renderModel(model, ctx.output, ext(file.name));
        results.push({ name: name(`${out}.${done.ext}`), blob: done.blob });
        part(1);
        break;
      }
    }
  }
  return results;
}

async function imagesPdf(ctx: RunContext): Promise<ResultFile[]> {
  const { decodeImage, drawToCanvas, canvasToBlob } = await import("./imageConvert");
  const images: PdfImage[] = [];
  for (let i = 0; i < ctx.files.length; i++) {
    if (ctx.isCancelled()) throw new ConvertError("Cancelled.");
    const bitmap = await decodeImage(ctx.files[i]);
    // Re-saving as JPEG applies the photo's rotation and keeps the PDF small.
    const canvas = drawToCanvas(bitmap, { maxSide: 3200, whiteBackground: true });
    bitmap.close();
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
    images.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
    ctx.onProgress((i + 1) / ctx.files.length);
  }
  const pdf = imagesToPdf(images, { pageSize: (ctx.options.pageSize as "fit" | "a4" | "letter") ?? "a4", margin: Number(ctx.options.margin ?? 18) });
  const name = ctx.files.length === 1 ? `${baseName(ctx.files[0].name)}.pdf` : "images.pdf";
  return [{ name, blob: pdfBlob(pdf) }];
}

async function pdfToImages(file: File, ctx: RunContext, part: (p: number) => void, name: (n: string) => string): Promise<ResultFile[]> {
  const { loadPdf } = await import("./pdfjs");
  const { canvasToBlob } = await import("./imageConvert");
  const pdf = await loadPdf(new Uint8Array(await file.arrayBuffer()));
  const out: ResultFile[] = [];
  const dpi = Number(ctx.options.dpi ?? 150);
  const quality = Number(ctx.options.quality ?? 90) / 100;
  const digits = String(pdf.numPages).length;
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      if (ctx.isCancelled()) throw new ConvertError("Cancelled.");
      const page = await pdf.getPage(n);
      let scale = dpi / 72;
      const base = page.getViewport({ scale: 1 });
      // Keep one picture under about 36 megapixels so phones do not run out of memory.
      const pixels = base.width * base.height * scale * scale;
      if (pixels > 36e6) scale *= Math.sqrt(36e6 / pixels);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new ConvertError("This browser could not prepare the page. Try a lower quality setting.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      page.cleanup();
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      out.push({ name: name(`${baseName(file.name)}-page-${String(n).padStart(digits, "0")}.jpg`), blob });
      part(n / pdf.numPages);
    }
  } finally {
    void pdf.loadingTask.destroy();
  }
  return out;
}

async function readModel(file: File, onProgress: (p: number) => void): Promise<DocModel> {
  const e = ext(file.name);
  const bytes = async () => new Uint8Array(await file.arrayBuffer());
  switch (e) {
    case "pdf":
      return readPdf(await bytes(), onProgress);
    case "epub":
      return readEpub(await bytes());
    case "docx":
      return readDocx(await bytes());
    case "txt":
      return readPlainText(await file.text(), false);
    case "md":
    case "markdown":
      return readPlainText(await file.text(), true);
    case "html":
    case "htm":
      return readHtml(await file.text());
    default:
      throw new ConvertError(`Files of type .${e || "unknown"} are not supported here.`);
  }
}

function renderModel(model: DocModel, output: string, input: string): { blob: Blob; ext: string } {
  if (output === input) throw new ConvertError(`This file is already a .${input} file. Pick a different format to convert to.`);
  switch (output) {
    case "pdf":
      return { blob: pdfBlob(blocksToPdf(model)), ext: "pdf" };
    case "docx":
      return { blob: docxBlob(blocksToDocx(model)), ext: "docx" };
    case "mobi":
      return { blob: mobiBlob(modelToMobi(model)), ext: "mobi" };
    case "txt":
      return { blob: toBlob(new TextEncoder().encode(blocksToText(model)), "text/plain;charset=utf-8"), ext: "txt" };
    default:
      throw new ConvertError("That output format is not supported.");
  }
}
