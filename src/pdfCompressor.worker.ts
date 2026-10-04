/// <reference lib="webworker" />
import * as pdfjs from 'pdfjs-dist';

// @ts-ignore - untyped bundled worker asset
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';

import { PDFDocument } from 'pdf-lib';
import type { WorkerIn, WorkerOut, ResultMode } from './types';

// Run PDF.js parser directly inside this worker thread to eliminate nested-worker deadlocks
(globalThis as any).pdfjsWorker = pdfjsWorker;

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerOut, t: Transferable[] = []) => ctx.postMessage(m, t);

const MAX_PIXELS = 16_000_000;

// pdfjs v4.10 expects a Class reference passed to CanvasFactory
class OffscreenCanvasFactory {
  create(w: number, h: number) {
    const width = Math.max(1, Math.floor(w));
    const height = Math.max(1, Math.floor(h));
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, context: canvas.getContext('2d')! };
  }
  reset(c: any, w: number, h: number) {
    c.canvas.width = Math.max(1, Math.floor(w));
    c.canvas.height = Math.max(1, Math.floor(h));
  }
  destroy(c: any) {
    c.canvas.width = 0;
    c.canvas.height = 0;
    c.canvas = null;
    c.context = null;
  }
}

async function rasterize(src: Uint8Array, dpi: number, quality: number, password?: string) {
  const task = pdfjs.getDocument({
    data: src,
    password,
    isEvalSupported: false,
    useSystemFonts: true,
    CanvasFactory: OffscreenCanvasFactory as any,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      task.destroy();
      reject(new Error('pdfjs initialization timed out (20s)'));
    }, 20000);
  });

  let pdf: pdfjs.PDFDocumentProxy;
  try {
    pdf = await Promise.race([task.promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  const out = await PDFDocument.create();
  out.setTitle('');
  out.setAuthor('');
  out.setSubject('');
  out.setKeywords([]);
  out.setCreator('');
  out.setProducer('');

  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      post({ type: 'progress', page: n, total: pdf.numPages });
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      let scale = dpi / 72;
      const px = base.width * scale * base.height * scale;
      if (px > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / px);
      const vp = page.getViewport({ scale });

      const canvas = new OffscreenCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const c2d = canvas.getContext('2d')!;
      c2d.fillStyle = '#fff';
      c2d.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: c2d as any,
        viewport: vp,
      }).promise;

      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      out.addPage([base.width, base.height]).drawImage(img, {
        x: 0,
        y: 0,
        width: base.width,
        height: base.height,
      });

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return out.save({ useObjectStreams: true });
}

async function optimizeOnly(src: Uint8Array) {
  const doc = await PDFDocument.load(src, { updateMetadata: false });
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');
  return doc.save({ useObjectStreams: true });
}

ctx.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { buffer, settings, password } = e.data;
  const original = new Uint8Array(buffer);
  const backup = original.slice();

  try {
    let best: Uint8Array = backup;
    let mode: ResultMode = 'original';
    let fellBack = false;

    try {
      const raster = await rasterize(original, settings.dpi, settings.quality, password);
      if (raster.length < backup.length) {
        best = raster;
        mode = 'raster';
      } else {
        const opt = await optimizeOnly(backup.slice());
        if (opt.length < backup.length) {
          best = opt;
          mode = 'optimized';
        }
      }
    } catch (err: any) {
      const n = err?.name;
      // Do not swallow password, encryption, or format errors
      if (n === 'PasswordException' || n === 'InvalidPDFException' || n === 'FormatError') {
        throw err;
      }

      console.warn('[EnclavePDF] raster failed, falling back to lossless engine:', err);
      fellBack = true;
      const opt = await optimizeOnly(backup.slice());
      if (opt.length < backup.length) {
        best = opt;
        mode = 'optimized';
      }
    }

    const ab = best.buffer.slice(best.byteOffset, best.byteOffset + best.byteLength) as ArrayBuffer;
    post({ type: 'done', buffer: ab, mode, fellBack }, [ab]);
  } catch (err: any) {
    const name = err?.name ?? '';
    if (name === 'PasswordException') {
      post({
        type: 'error',
        code: err.code === 2 ? 'PASSWORD_INCORRECT' : 'PASSWORD_REQUIRED',
        message: 'This PDF is password-protected.',
      });
    } else if (name === 'InvalidPDFException' || name === 'FormatError') {
      post({
        type: 'error',
        code: 'INVALID',
        message: 'This file is not a readable PDF.',
      });
    } else if (err instanceof RangeError || /memory|allocation/i.test(String(err?.message))) {
      post({
        type: 'error',
        code: 'OOM',
        message: 'Not enough memory. Try the Strong preset or a smaller file.',
      });
    } else {
      post({
        type: 'error',
        code: 'UNKNOWN',
        message: String(err?.message ?? err),
      });
    }
  }
};
