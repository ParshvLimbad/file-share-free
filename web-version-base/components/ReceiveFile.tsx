'use client';

import { Loader2, CheckCircle2, XCircle, FileIcon, ArrowLeft, ArrowRight } from 'lucide-react';
import TransferProgress from './TransferProgress';
import { useReceiveFile } from '@/lib/useReceiveFile';

interface ReceiveFileProps {
  code: string;
}

function formatBytes(bytes: number = 0) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function Logo() {
  return (
    <div className="inline-flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_oklch(0.72_0.19_200/0.35)]">
        <ArrowRight size={15} className="text-primary-foreground" strokeWidth={2.5} />
      </div>
      <span className="text-foreground font-semibold tracking-tight text-lg">drop</span>
    </div>
  );
}

export default function ReceiveFile({ code }: ReceiveFileProps) {
  const { status, downloadProgress, fileMetadata, error } = useReceiveFile(code);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Dot grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(0.35 0.01 240) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.25,
        }}
      />
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.72 0.19 200 / 0.07), transparent)',
        }}
      />

      <div className="relative w-full max-w-[420px]">
        {/* Header */}
        <div className="flex justify-center mb-10">
          <Logo />
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_0_0_1px_oklch(0.2_0.01_240),0_20px_60px_oklch(0_0_0/0.4)]">

          {/* ERROR STATE */}
          {status === 'error' && (
            <div className="p-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shadow-[0_0_20px_oklch(0.55_0.22_27/0.15)]">
                <XCircle size={28} className="text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1.5">Connection Failed</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                  {error || 'Share code not found or expired.'}
                </p>
              </div>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted border border-border text-sm font-medium text-foreground hover:border-border/60 hover:bg-muted/80 transition-all duration-200 active:scale-[0.98]"
              >
                <ArrowLeft size={14} strokeWidth={2.5} />
                Back to home
              </button>
            </div>
          )}

          {/* SUCCESS STATE */}
          {status === 'complete' && (
            <div className="p-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_20px_oklch(0.65_0.19_160/0.15)]">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1.5">Download Complete</h2>
                {fileMetadata && (
                  <p className="text-sm text-muted-foreground">{fileMetadata.name}</p>
                )}
              </div>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all duration-200 active:scale-[0.98] shadow-[0_0_20px_oklch(0.72_0.19_200/0.3)]"
              >
                New transfer
                <ArrowRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* CONNECTING / RECEIVING STATE */}
          {(status === 'connecting' || status === 'receiving') && (
            <div className="p-5 space-y-4">
              {/* Status row */}
              <div className="flex items-center gap-3 p-3.5 bg-muted/40 border border-border rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Loader2 size={16} className="text-primary animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {status === 'connecting' ? 'Connecting to sender...' : 'Receiving file...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {code}
                  </p>
                </div>
              </div>

              {/* File metadata */}
              {fileMetadata && (
                <div className="flex items-center gap-3 p-3.5 bg-muted/30 border border-border rounded-xl">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <FileIcon size={15} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">
                      {fileMetadata.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatBytes(fileMetadata.size)}
                    </p>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {status === 'receiving' && (
                <TransferProgress progress={downloadProgress} label="Downloading" />
              )}

              {/* Waiting hint */}
              {status === 'connecting' && (
                <p className="text-xs text-muted-foreground text-center leading-relaxed px-2">
                  Keep this tab open. The transfer will begin once the sender&apos;s browser is ready.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-7 leading-relaxed">
          Files transfer directly between peers. Nothing is stored on any server.
        </p>
      </div>
    </main>
  );
}
