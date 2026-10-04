import { useRef, useState } from 'react';
import { PRESETS, type PresetKey, type Settings } from './types';
import { usePdfCompressor } from './usePdfCompressor';

const fmt = (b: number) => (b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 ** 2).toFixed(2)} MB`);
const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

export default function App() {
  const { status, progress, result, error, compress, cancel, reset } = usePdfCompressor();
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<PresetKey>('balanced');
  const [custom, setCustom] = useState<Settings>({ dpi: PRESETS.balanced.dpi, quality: PRESETS.balanced.quality });
  const [password, setPassword] = useState('');
  const [drag, setDrag] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const accept = (f?: File) => {
    if (!f) return;
    if (!isPdf(f)) return setFileError('Only .pdf files are supported.');
    setFileError(null); setFile(f); setPassword(''); reset();
  };
  const pick = (k: PresetKey) => { setPreset(k); setCustom({ dpi: PRESETS[k].dpi, quality: PRESETS[k].quality }); };
  const pct = progress.total ? Math.round((progress.page / progress.total) * 100) : 0;
  const saved = file && result ? Math.max(0, Math.round((1 - result.size / file.size) * 100)) : 0;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <div className="mx-auto max-w-2xl px-5 py-10 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">PrivPDF</h1>
          <span className="rounded-full border border-emerald-600/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-400"
                title="All processing happens in this tab. Verify in DevTools → Network.">
            Runs in your browser. Nothing is uploaded.
          </span>
        </header>

        <div role="button" tabIndex={0} aria-label="Choose a PDF"
          onClick={() => input.current?.click()} onKeyDown={e => e.key === 'Enter' && input.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition focus-visible:outline-2 focus-visible:outline-emerald-500
            ${drag ? 'border-emerald-500 bg-emerald-500/10' : 'border-stone-300 dark:border-stone-700'}`}>
          <p className="font-medium">{file ? file.name : 'Drop a PDF here, or click to choose one'}</p>
          {file && <p className="text-sm text-stone-500">{fmt(file.size)}</p>}
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={e => accept(e.target.files?.[0])} />
        </div>
        {fileError && <p role="alert" className="text-sm text-red-600">{fileError}</p>}

        <section className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PRESETS) as PresetKey[]).map(k => (
              <button key={k} onClick={() => pick(k)} aria-pressed={preset === k}
                className={`rounded-lg border p-3 text-left text-sm ${preset === k ? 'border-emerald-500 bg-emerald-500/10' : 'border-stone-300 dark:border-stone-700'}`}>
                <span className="block font-medium">{PRESETS[k].label}</span>
                <span className="text-xs text-stone-500">{PRESETS[k].hint}</span>
              </button>
            ))}
          </div>
          <label className="block text-sm">Resolution: {custom.dpi} DPI
            <input type="range" min={50} max={200} step={10} value={custom.dpi} className="w-full accent-emerald-600"
              onChange={e => setCustom({ ...custom, dpi: +e.target.value })} />
          </label>
          <label className="block text-sm">JPEG quality: {Math.round(custom.quality * 100)}%
            <input type="range" min={10} max={95} step={5} value={custom.quality * 100} className="w-full accent-emerald-600"
              onChange={e => setCustom({ ...custom, quality: +e.target.value / 100 })} />
          </label>
        </section>

        {status === 'needs-password' && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-amber-600">{error} Enter the password to continue. It never leaves this tab.</p>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="PDF password"
              className="w-full rounded-lg border border-stone-300 bg-transparent p-2 dark:border-stone-700" />
          </div>
        )}

        {status === 'working' ? (
          <div className="space-y-2" aria-live="polite">
            <div className="h-2 overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm">Processing page {progress.page} of {progress.total || '…'}</p>
            <button onClick={cancel} className="text-sm underline">Cancel</button>
          </div>
        ) : (
          <button disabled={!file} onClick={() => file && compress(file, custom, password || undefined)}
            className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white disabled:opacity-40">
            Compress PDF
          </button>
        )}

        {status === 'error' && <p role="alert" className="text-sm text-red-600">{error}</p>}

        {status === 'done' && result && file && (
          <section className="space-y-3 rounded-xl border border-stone-300 p-5 dark:border-stone-700">
            <div className="flex justify-between text-sm"><span>Original</span><span>{fmt(file.size)}</span></div>
            <div className="flex justify-between text-sm"><span>Compressed</span><span>{fmt(result.size)} ({saved}% smaller)</span></div>
            {result.mode === 'original' && <p className="text-sm text-amber-600">This file is already as small as it can get. Your original is returned unchanged.</p>}
            {result.mode === 'optimized' && <p className="text-sm text-stone-500">This PDF is mostly text and vectors, so pages weren't flattened to images. Text stays selectable; only metadata and structure were trimmed.</p>}
            {result.mode === 'raster' && <p className="text-sm text-stone-500">Pages were converted to images, so text is no longer selectable or searchable.</p>}
            <a href={result.url} download={file.name.replace(/\.pdf$/i, '') + '-compressed.pdf'}
              className="block rounded-lg bg-stone-900 py-3 text-center font-medium text-white dark:bg-stone-100 dark:text-stone-900">
              Download
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
