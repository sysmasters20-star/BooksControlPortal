import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

const RENDER_SCALE = 2.0;

export async function pdfToPageBuffers(pdfBuffer: Buffer): Promise<Buffer[]> {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;

  const pages: Buffer[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx as any, viewport }).promise;
    pages.push(canvas.toBuffer('image/png'));
  }

  return pages;
}
