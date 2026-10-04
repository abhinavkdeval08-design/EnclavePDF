import React, { useState, useEffect, useRef } from 'react';
import { usePdfCompressor } from './usePdfCompressor';
import { PRESETS, PresetKey, Settings } from './types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // Strict 50 MB limit

export default function App() {
  const { status, progress, result, error, compress, cancel, reset } = usePdfCompressor();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey>('balanced');
  const [password, setPassword] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [outboundRequests, setOutboundRequests] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live PerformanceResourceTiming verification
  useEffect(() => {
    const checkRequests = () => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const outbound = entries.filter((e) =>
        ['fetch', 'xmlhttprequest'].includes(e.initiatorType)
      );
      setOutboundRequests(outbound.length);
    };

    checkRequests();
    const interval = setInterval(checkRequests, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFile = (file: File) => {
    setFileError(null);
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setFileError('Please select a valid PDF document.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File exceeds 50 MB limit. In-memory processing risks browser tab crash.');
      return;
    }
    setSelectedFile(file);
    reset();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
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

  const sizeDelta = selectedFile && result ? selectedFile.size - result.size : 0;
  const reductionPercentage =
    selectedFile && result && sizeDelta > 0
      ? Math.round((sizeDelta / selectedFile.size) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#0e1013] text-zinc-200 flex flex-col font-sans selection:bg-zinc-800 selection:text-white [scrollbar-gutter:stable]">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Reticle Enclave Logo Matching Icon */}
          <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-700/80 p-1.5 flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-zinc-300">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 7h4l3 3v7a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="#1e293b" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13 7v3h3" fill="#10b981" />
            </svg>
          </div>
          <span className="font-semibold text-white text-base tracking-tight">EnclavePDF</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            title="Real-time network telemetry via PerformanceResourceTiming"
            className="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-300"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                outboundRequests === 0 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            ></span>
            <span>{outboundRequests} outbound requests</span>
          </div>
        </div>
      </header>

      {/* Main Container with Fixed Vertical Alignment */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 pt-12 pb-16 flex flex-col gap-6">
        {/* Core Value Statement */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Compress PDFs locally in memory.
          </h1>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Files never leave this browser tab. After the page loads, turn off Wi-Fi and compress. It still works.
          </p>
        </div>

        {/* Dropzone (Active in Idle and Staged states) */}
        {status !== 'done' && (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl min-h-[220px] p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-950/20 scale-[1.01]'
                : selectedFile
                ? 'border-zinc-600 bg-zinc-900/60'
                : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/30 hover:bg-zinc-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            <div className="h-10 w-10 rounded-lg bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>

            <div className="space-y-1">
              {selectedFile ? (
                <>
                  <p className="font-medium text-white text-sm break-all">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-300 font-mono">{formatBytes(selectedFile.size)} • Ready</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-zinc-100 text-sm">
                    Drop a PDF here, or click to browse
                  </p>
                  <p className="text-xs text-zinc-400">Max 50 MB document size</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Local Validation Error */}
        {fileError && (
          <div className="p-3 rounded-lg border border-red-900/50 bg-red-950/30 text-xs text-red-300">
            {fileError}
          </div>
        )}

        {/* Upfront Presets: Visible on Idle & Selection */}
        {status !== 'done' && (
          <div className="bg-zinc-900/40 border border-zinc-800/90 rounded-xl p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300 block">Compression profile</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                  const preset = PRESETS[key];
                  const isSelected = activePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActivePreset(key)}
                      className={`p-3 rounded-lg border text-left transition-colors min-h-[58px] flex flex-col justify-between ${
                        isSelected
                          ? 'border-zinc-500 bg-zinc-800 text-white shadow-sm'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <p className="text-xs font-medium text-zinc-200">{preset.label}</p>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-tight">
                        {key === 'strong' ? '~200 KB portals' : preset.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Password input when requested */}
            {status === 'needs-password' && (
              <div className="space-y-1.5 p-3 rounded-lg border border-amber-900/50 bg-amber-950/30">
                <label className="text-xs font-medium text-amber-300">
                  Password required for encrypted document
                </label>
                <input
                  type="password"
                  placeholder="Enter PDF password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>
            )}

            {/* Action Button */}
            {selectedFile && status !== 'working' && (
              <button
                onClick={startCompression}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg transition-colors min-h-[44px]"
              >
                Compress document
              </button>
            )}
          </div>
        )}

        {/* Processing State */}
        {status === 'working' && (
          <div
            aria-live="polite"
            className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 text-center space-y-3"
          >
            <p className="text-xs text-zinc-200">
              Processing page {progress.page} of {progress.total || '…'}
            </p>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-zinc-300 h-full transition-all duration-150"
                style={{
                  width: `${progress.total ? (progress.page / progress.total) * 100 : 20}%`,
                }}
              ></div>
            </div>
            <button
              onClick={cancel}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline min-h-[44px]"
            >
              Cancel operation
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 text-center space-y-2">
            <p className="text-xs text-red-300">{error || 'Worker engine failed.'}</p>
            <button
              onClick={reset}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Result Card: Integrated, No-Border Fatigue */}
        {status === 'done' && result && selectedFile && (
          <div className="bg-zinc-900/50 border border-zinc-800/90 rounded-xl p-6 space-y-5">
            {/* Header: Name + Explicit Re-run Button */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-800/80">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{selectedFile.name}</h3>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  {PRESETS[activePreset].label} · {PRESETS[activePreset].dpi} DPI · {Math.round(PRESETS[activePreset].quality * 100)}% quality
                </p>
              </div>

              <button
                onClick={() => reset()}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-xs font-medium border border-zinc-700/80 transition-colors shrink-0"
              >
                Re-run
              </button>
            </div>

            {/* Prominent Savings Headline */}
            <div>
              {reductionPercentage > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-white font-mono">
                    {formatBytes(sizeDelta)} saved
                  </span>
                  <span className="text-sm font-mono text-emerald-400 font-semibold">
                    · {reductionPercentage}% smaller
                  </span>
                </div>
              ) : (
                <span className="text-lg font-semibold text-zinc-200">
                  Optimal · No size reduction possible
                </span>
              )}
            </div>

            {/* Metrics Layout without Nested Border Overload */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-zinc-900/80 rounded-lg">
                <span className="text-zinc-400 font-medium block">Original size</span>
                <span className="font-mono text-zinc-200 font-semibold text-sm mt-0.5 block">
                  {formatBytes(selectedFile.size)}
                </span>
              </div>
              <div className="p-3.5 bg-zinc-900/80 rounded-lg">
                <span className="text-zinc-400 font-medium block">Compressed size</span>
                <span className="font-mono text-emerald-400 font-semibold text-sm mt-0.5 block">
                  {formatBytes(result.size)}
                </span>
              </div>
            </div>

            {/* Context Note: Borderless Sub-layer */}
            <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/70 p-3.5 rounded-lg">
              {result.fellBack && (
                <p className="text-amber-400">
                  Image rasterizer failed in this browser context; lossless mode was used instead.
                </p>
              )}
              {result.mode === 'raster' && (
                <p>
                  Every page was converted to an image, so text is no longer selectable or searchable.
                  {activePreset === 'strong' && (
                    <span className="block mt-1 text-zinc-400">
                      Strong profile used: lowest quality threshold for strict upload limits.
                    </span>
                  )}
                </p>
              )}
              {result.mode === 'optimized' && !result.fellBack && (
                <p>
                  Document was mostly text and vector glyphs. Kept selectable vector text intact with lossless stream repacking.
                </p>
              )}
              {result.mode === 'original' && (
                <p>
                  Document is already optimal. Further compression would destroy readability without reducing size.
                </p>
              )}
            </div>

            {/* Primary Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <a
                href={result.url}
                download={
                  reductionPercentage > 0
                    ? `enclave-${selectedFile.name}`
                    : selectedFile.name
                }
                className="flex-1 py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-center text-xs rounded-lg transition-colors flex items-center justify-center min-h-[44px]"
              >
                Download document
              </a>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  reset();
                }}
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors min-h-[44px]"
              >
                New file
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800/80 py-3.5 px-6 text-center text-xs text-zinc-400 font-mono">
        Zero server telemetry • 100% client RAM execution
      </footer>
    </div>
  );
}
