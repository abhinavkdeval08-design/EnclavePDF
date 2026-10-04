import React, { useState, useEffect, useRef } from 'react';
import { usePdfCompressor } from './usePdfCompressor';
import { PRESETS, type PresetKey, type Settings } from './types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB safety guard

export default function App() {
  const { status, progress, result, error, compress, cancel, reset } = usePdfCompressor();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey>('balanced');
  const [password, setPassword] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [outboundRequests, setOutboundRequests] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent accidental PDF tab opening on outer window drops
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);

  // Prevent accidental tab close/refresh while working or holding result
  useEffect(() => {
    if (status !== 'working' && status !== 'done') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  // Accurate cross-origin network telemetry via PerformanceResourceTiming
  useEffect(() => {
    const checkRequests = () => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const outbound = entries.filter((e) => {
        try {
          return new URL(e.name).origin !== location.origin;
        } catch {
          return false;
        }
      });
      setOutboundRequests(outbound.length);
    };

    checkRequests();
    const interval = setInterval(checkRequests, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFile = (file: File) => {
    setFileError(null);
    setPassword(''); // Flush stale passwords on new document ingestion
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFileError('Please select a valid PDF document.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('File exceeds 50 MB limit. Processing larger files in memory risks crashing your tab.');
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
    // Guard: ignore dragleave when entering nested child elements to prevent flicker
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
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
    if (!selectedFile || status === 'working') return;
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

  const progressPercent =
    progress.total > 0 ? Math.round((progress.page / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0e1013] text-zinc-200 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
            title="Cross-origin requests seen by this page. Worker requests aren't counted, and browser extensions can add requests here — verify in DevTools → Network."
            className="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 cursor-help"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                outboundRequests === 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'
              }`}
            ></span>
            <span>{outboundRequests} outbound requests</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 pt-10 pb-16 flex flex-col gap-5">
        {/* Core Value Statement */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Compress PDFs locally in memory.
          </h1>
          <p className="text-sm text-zinc-300 leading-relaxed [text-wrap:balance]">
            Files never leave this tab. After the page loads, turn off Wi-Fi and compress. It still works.
          </p>
        </div>

        {/* Dropzone (Idle State) */}
        {!selectedFile && status !== 'done' && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a PDF"
            onKeyDown={handleKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl min-h-[200px] p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-950/20 scale-[1.01]'
                : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/30 hover:bg-zinc-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            <div className="h-10 w-10 rounded-lg bg-zinc-800/90 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>

            <div className="space-y-0.5">
              <p className="font-medium text-zinc-100 text-sm">Drop a PDF here, or click to browse</p>
              <p className="text-xs text-zinc-400">Max 50 MB document size</p>
            </div>
          </div>
        )}

        {/* Selected File (Collapsed Row) */}
        {selectedFile && status !== 'done' && (
          <div className="flex items-center justify-between p-3.5 bg-zinc-900/60 border border-zinc-700/80 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-white text-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-zinc-400 font-mono">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>

            {status !== 'working' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPassword('');
                  reset();
                }}
                className="text-xs font-medium text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors ml-3 shrink-0"
              >
                Change
              </button>
            )}
          </div>
        )}

        {/* Local Validation Error */}
        {fileError && (
          <div className="p-3 rounded-lg border border-red-900/50 bg-red-950/30 text-xs text-red-300">
            {fileError}
          </div>
        )}

        {/* Presets & Actions */}
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
                      aria-pressed={isSelected}
                      disabled={status === 'working'}
                      onClick={() => setActivePreset(key)}
                      className={`p-3 rounded-lg border text-left transition-all min-h-[58px] flex flex-col justify-between relative ${
                        status === 'working' ? 'opacity-50 cursor-not-allowed' : ''
                      } ${
                        isSelected
                          ? 'border-emerald-500/80 bg-zinc-800/90 ring-1 ring-emerald-500/50 text-white shadow-sm'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-medium text-zinc-200">{preset.label}</span>
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-tight">
                        {key === 'strong' ? 'Smallest file' : preset.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Password input with live error */}
            {status === 'needs-password' && (
              <div className="space-y-2 p-3 rounded-lg border border-amber-900/50 bg-amber-950/30">
                <label className="text-xs font-medium text-amber-300 block">
                  Password required for encrypted document
                </label>
                {error && <p className="text-xs text-amber-400 font-medium">{error}</p>}
                <input
                  type="password"
                  placeholder="Enter PDF password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>
            )}

            {/* Action Trigger */}
            {selectedFile && status !== 'working' && (
              <button
                onClick={startCompression}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg transition-colors min-h-[44px]"
              >
                Compress document
              </button>
            )}

            {/* Inline Emerald Progress */}
            {status === 'working' && (
              <div aria-live="polite" className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Processing page {progress.page} of {progress.total || '…'}
                  </span>
                  <span className="font-mono font-medium text-emerald-400">{progressPercent}%</span>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden"
                >
                  <div
                    className="bg-emerald-500 h-full transition-all duration-150 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>

                <div className="text-center pt-1">
                  <button
                    onClick={cancel}
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                  >
                    Cancel operation
                  </button>
                </div>
              </div>
            )}
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

        {/* Result Card: Accurate Mode-Aware Settings Line */}
        {status === 'done' && result && selectedFile && (
          <div className="bg-zinc-900/50 border border-zinc-800/90 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-800/80">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">{selectedFile.name}</h3>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  {result.mode === 'raster'
                    ? `${PRESETS[activePreset].label} · ${PRESETS[activePreset].dpi} DPI · ${Math.round(PRESETS[activePreset].quality * 100)}% quality`
                    : 'Lossless pass · no image settings applied'}
                </p>
              </div>

              <button
                onClick={() => reset()}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-xs font-medium border border-zinc-700/80 transition-colors shrink-0"
              >
                Re-run
              </button>
            </div>

            <div>
              {sizeDelta > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-white font-mono">
                    {formatBytes(sizeDelta)} saved
                  </span>
                  <span className="text-sm font-mono text-emerald-400 font-semibold">
                    · {reductionPercentage > 0 ? `${reductionPercentage}% smaller` : '<1% smaller'}
                  </span>
                </div>
              ) : (
                <span className="text-lg font-semibold text-zinc-200">
                  Optimal · No size reduction possible
                </span>
              )}
            </div>

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
                      Strong profile used: lowest quality threshold for maximum compression.
                    </span>
                  )}
                </p>
              )}
              {result.mode === 'optimized' && !result.fellBack && (
                <p>
                  Converting pages to images didn't make this file smaller, so only metadata and structure were trimmed. Text stays selectable.
                </p>
              )}
              {result.mode === 'original' && (
                <p>
                  Neither mode made this file smaller, so your original is returned unchanged.
                </p>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <a
                href={result.url}
                download={
                  sizeDelta > 0
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
                  setPassword('');
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
