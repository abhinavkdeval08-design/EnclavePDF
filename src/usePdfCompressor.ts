import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResultMode, Settings, WorkerIn, WorkerOut } from './types';

export type Status = 'idle' | 'working' | 'done' | 'error' | 'needs-password';

export interface Result {
  url: string;
  size: number;
  mode: ResultMode;
  fellBack?: boolean;
}

export function usePdfCompressor() {
  const workerRef = useRef<Worker | null>(null);
  const fileRef = useRef<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState({ page: 0, total: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const killWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  const revoke = (r: Result | null) => {
    if (r) {
      URL.revokeObjectURL(r.url);
    }
  };

  useEffect(() => {
    return () => {
      killWorker();
    };
  }, []);

  useEffect(() => {
    return () => {
      revoke(result);
    };
  }, [result]);

  const compress = useCallback(async (file: File, settings: Settings, password?: string) => {
    killWorker();
    fileRef.current = file;
    setResult(null);
    setError(null);
    setProgress({ page: 0, total: 0 });
    setStatus('working');

    const worker = new Worker(new URL('./pdfCompressor.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      // Guard: Ignore pdfjs-internal handshake messages lacking type field
      if (!m || typeof (m as any).type !== 'string') return;

      if (m.type === 'progress') {
        setProgress({ page: m.page, total: m.total });
      } else if (m.type === 'done') {
        const blob = new Blob([m.buffer], { type: 'application/pdf' });
        setResult({
          url: URL.createObjectURL(blob),
          size: blob.size,
          mode: m.mode,
          fellBack: m.fellBack,
        });
        setStatus('done');
        killWorker();
      } else if (m.type === 'error') {
        setError(m.message);
        setStatus(
          m.code === 'PASSWORD_REQUIRED' || m.code === 'PASSWORD_INCORRECT'
            ? 'needs-password'
            : 'error'
        );
        killWorker();
      }
    };

    worker.onerror = () => {
      setError('The compression engine crashed unexpectedly.');
      setStatus('error');
      killWorker();
    };

    const buffer = await file.arrayBuffer();
    worker.postMessage(
      { type: 'compress', buffer, settings, password } satisfies WorkerIn,
      [buffer]
    );
  }, []);

  const cancel = useCallback(() => {
    killWorker();
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    killWorker();
    setResult(null);
    setError(null);
    setStatus('idle');
    fileRef.current = null;
  }, []);

  return { status, progress, result, error, file: fileRef.current, compress, cancel, reset };
}
