/// <reference lib="webworker" />
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import type { WorkerIn, WorkerOut, ResultMode } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerOut, t: Transferable[] = []) => ctx.postMessage(m, t);

const MAX_PIXELS = 16_000_000; // per page; guards against tab OOM on huge pages

// pdfjs defaults to document.createElement('canvas'), which doesn't exist in workers.
class OffscreenCanvasFactory {
  create(w: number, h: number) {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, context: canvas.getContext('2d')! };
  }
  reset(c: any, w: number, h: number) { c.canvas.width = w; c.canvas.height = h; }
  destroy(c: any) { c.canvas.width = 0; c.canvas.height = 0; c.canvas = null; c.context = null; }
}

async function rasterize(src: Uint8Array, dpi: number, quality: number, password?: string) {
  const task = pdfjs.getDocument({
    data: src, password, isEvalSupported: false, useSystemFonts: true,
    CanvasFactory: OffscreenCanvasFactory as any,
  });
  const pdf = await task.promise;
  const out = await PDFDocument.create();
  out.setTitle(''); out.setAuthor(''); out.setSubject(''); out.setKeywords([]);
  out.setCreator(''); out.setProducer('');
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      post({ type: 'progress', page: n, total: pdf.numPages });
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 }); // PDF points
      let scale = dpi / 72;
      const px = base.width * scale * base.height * scale;
      if (px > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / px);
      const vp = page.getViewport({ scale });
      const canvas = new OffscreenCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const c2d = canvas.getContext('2d')!;
      c2d.fillStyle = '#fff'; c2d.fillRect(0, 0, canvas.width, canvas.height); // JPEG has no alpha
      await page.render({ canvasContext: c2d as any, viewport: vp }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      out.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      canvas.width = canvas.height = 0; // release bitmap memory immediately
      page.cleanup();
    }
  } finally { await pdf.destroy(); }
  return out.save({ useObjectStreams: true });
}

// Lossless fallback: keeps text/vectors selectable, strips metadata, packs objects.
async function optimizeOnly(src: Uint8Array) {
  const doc = await PDFDocument.load(src, { updateMetadata: false });
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]);
  doc.setCreator(''); doc.setProducer('');
  return doc.save({ useObjectStreams: true });
}

ctx.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { buffer, settings, password } = e.data;
  const original = new Uint8Array(buffer);
  const backup = original.slice(); // pdfjs may detach the buffer it is given
  try {
    let best: Uint8Array = backup; let mode: ResultMode = 'original';
    const raster = await rasterize(original, settings.dpi, settings.quality, password);
    if (raster.length < backup.length) { best = raster; mode = 'raster'; }
    else { // text-only / already-optimal: rasterizing would not help (or would hurt)
      try {
        const opt = await optimizeOnly(backup.slice());
        if (opt.length < backup.length) { best = opt; mode = 'optimized'; }
      } catch { /* e.g. pdf-lib can't parse it; keep original */ }
    }
    const ab = best.buffer.slice(best.byteOffset, best.byteOffset + best.byteLength) as ArrayBuffer;
    post({ type: 'done', buffer: ab, mode }, [ab]);
  } catch (err: any) {
    const name = err?.name ?? '';
    if (name === 'PasswordException') {
      post({ type: 'error', code: err.code === 2 ? 'PASSWORD_INCORRECT' : 'PASSWORD_REQUIRED', message: 'This PDF is password-protected.' });
    } else if (name === 'InvalidPDFException' || name === 'FormatError') {
      post({ type: 'error', code: 'INVALID', message: 'This file is not a readable PDF.' });
    } else if (err instanceof RangeError || /memory|allocation/i.test(String(err?.message))) {
      post({ type: 'error', code: 'OOM', message: 'Not enough memory. Try the Strong preset or a smaller file.' });
    } else post({ type: 'error', code: 'UNKNOWN', message: String(err?.message ?? err) });
  }
};
