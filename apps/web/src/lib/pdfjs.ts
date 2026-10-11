import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { ConvertError } from "./errors";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = pdfjs.PDFDocumentProxy;

export async function loadPdf(bytes: Uint8Array): Promise<PdfDoc> {
  try {
    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    return await pdfjs.getDocument({ data: bytes.slice() }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "PasswordException") throw new ConvertError("This PDF is password protected. Remove the password first, then try again.");
    throw new ConvertError("This PDF could not be opened. It may be damaged.");
  }
}
