import { reconstructPdfLines, toPositionedText } from "./pdf-text";

export async function readPdfPageOneText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    useWasm: false,
    useSystemFonts: true,
    disableStream: true,
    disableAutoFetch: true,
  });

  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const positioned = content.items.flatMap((item) => {
      const mapped = toPositionedText(item);
      return mapped ? [mapped] : [];
    });
    const reconstructed = reconstructPdfLines(positioned);
    const fallback = positioned
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const text = reconstructed.replace(/\s+/g, "").length >= fallback.replace(/\s+/g, "").length
      ? reconstructed
      : fallback;
    if (text.replace(/\s+/g, "").length < 20) {
      throw new Error("La página 1 no trajo texto seleccionable.");
    }
    return text;
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      /* el texto ya está leído */
    }
  }
}

export function describeExtractError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "error desconocido";
}
