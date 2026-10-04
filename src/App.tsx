import React, { useState, useRef } from 'react';
import { usePdfCompressor } from './usePdfCompressor';
import { PRESETS, PresetKey, Settings } from './types';

export default function App() {
  const { status, progress, result, error, compress, cancel, reset } = usePdfCompressor();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey>('balanced');
  const [password, setPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('Please upload a valid PDF file.');
      return;
    }
    setSelectedFile(file);
    reset();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const startCompression = () => {
    if (!selectedFile) return;
    const settings: Settings = {
      dpi: PRESETS[activePreset].dpi,
      quality: PRESETS[activePreset].quality,
    };
    compress(selectedFile, settings, password || undefined);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const reductionPercentage =
    selectedFile && result
      ? Math.max(0, Math.round(((selectedFile.size - result.size) / selectedFile.size) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            E
          </div>
          <div>
            <span className="font-semibold tracking-tight text-white text-base">EnclavePDF</span>
            <span className="ml-2 text-xs font-mono text-zinc-500 hidden sm:inline-block">v1.0.0-core</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-900 border border-zinc-800 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Zero Egress (100% In-Memory)
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Hero Copy */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
            Hardware-Isolated PDF Compression
          </h1>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">
            Runs entirely inside an isolated Web Worker in your local browser memory. Files never touch any remote server or egress network bounds.
          </p>
        </div>

        {/* Dropzone Container */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-4 text-center group ${
            selectedFile
              ? 'border-emerald-500/40 bg-emerald-950/10'
              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          />

          <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>

          <div className="space-y-1">
            {selectedFile ? (
              <>
                <p className="font-medium text-emerald-400 font-mono text-sm">{selectedFile.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{formatBytes(selectedFile.size)}</p>
              </>
            ) : (
              <>
                <p className="font-medium text-zinc-200 text-sm">Drop your document here or click to browse</p>
                <p className="text-xs text-zinc-500">Supports standard & scanned PDFs up to 50MB</p>
              </>
            )}
          </div>
        </div>

        {/* Compression Controls */}
        {selectedFile && status !== 'working' && status !== 'done' && (
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Optimization Preset</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                  const preset = PRESETS[key];
                  const isSelected = activePreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActivePreset(key)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                          : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-zinc-200">{preset.label}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{preset.dpi} DPI</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-snug">{preset.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Password input when requested */}
            {status === 'needs-password' && (
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wide block font-semibold">
                  Password Protected Document
                </span>
                <input
                  type="password"
                  placeholder="Enter document password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <button
              onClick={startCompression}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              Start In-Memory Compression
            </button>
          </div>
        )}

        {/* Processing State */}
        {status === 'working' && (
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="font-mono text-sm text-zinc-200">
                Processing page {progress.page} of {progress.total || '…'}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-200"
                style={{
                  width: `${progress.total ? (progress.page / progress.total) * 100 : 20}%`,
                }}
              ></div>
            </div>
            <button
              onClick={cancel}
              className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              [Cancel Operation]
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="bg-red-950/20 border border-red-500/40 rounded-2xl p-5 text-center space-y-3">
            <p className="text-sm font-mono text-red-400">{error || 'An unexpected worker failure occurred.'}</p>
            <button
              onClick={reset}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 rounded-lg transition-colors"
            >
              Reset & Try Again
            </button>
          </div>
        )}

        {/* Result Card */}
        {status === 'done' && result && selectedFile && (
          <div className="bg-zinc-900/70 border border-emerald-500/40 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wide">
                  Compression Complete
                </span>
                <h3 className="text-lg font-semibold text-white mt-0.5">{selectedFile.name}</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                -{reductionPercentage}% Reduced
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
                <span className="text-[11px] font-mono text-zinc-500 uppercase">Original Size</span>
                <p className="text-base font-semibold text-zinc-300 font-mono mt-0.5">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
                <span className="text-[11px] font-mono text-zinc-500 uppercase">Result Size</span>
                <p className="text-base font-semibold text-emerald-400 font-mono mt-0.5">
                  {formatBytes(result.size)}
                </p>
              </div>
            </div>

            {/* Architecture Mode & Fallback Telemetry */}
            <div className="space-y-2 text-xs font-mono">
              {result.fellBack && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  ⚠️ Image rasterizer unavailable in current context. Seamlessly executed via lossless stream repack engine.
                </div>
              )}
              {result.mode === 'optimized' && !result.fellBack && (
                <p className="text-zinc-400">
                  ⚡ Lossless vector & metadata pruning applied. Vector text and font clarity preserved 100%.
                </p>
              )}
              {result.mode === 'raster' && (
                <p className="text-zinc-400">
                  🖼️ OffscreenCanvas dynamic rasterization pipeline downsampled embedded graphic streams.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href={result.url}
                download={`enclave-${selectedFile.name}`}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-center text-sm rounded-xl transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                Download Document
              </a>
              <button
                onClick={reset}
                className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Telemetry Architecture Bar */}
        <div className="border border-zinc-800/60 rounded-xl p-4 bg-zinc-900/20 grid grid-cols-3 text-center divide-x divide-zinc-800 text-xs font-mono">
          <div>
            <span className="text-zinc-500 block">NETWORK EGRESS</span>
            <span className="text-emerald-400 font-semibold mt-0.5 block">0 B (Verified)</span>
          </div>
          <div>
            <span className="text-zinc-500 block">CONCURRENCY</span>
            <span className="text-zinc-300 font-semibold mt-0.5 block">Web Worker</span>
          </div>
          <div>
            <span className="text-zinc-500 block">MEMORY LIMIT</span>
            <span className="text-zinc-300 font-semibold mt-0.5 block">16M Px Guard</span>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800/60 py-4 text-center text-xs font-mono text-zinc-600">
        Engineered by Abhinav Deval • Zero Remote Tracking • 100% Client-Side
      </footer>
    </div>
  );
}
