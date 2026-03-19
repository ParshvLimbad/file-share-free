'use client';

import { useState } from 'react';
import { Copy, Check, Link, FileIcon, Wifi, WifiOff } from 'lucide-react';

interface ShareCodeDisplayProps {
  code: string | null;
  isConnected: boolean;
  fileName?: string;
  fileSize?: number;
}

function formatBytes(bytes: number = 0) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ShareCodeDisplay({ code, isConnected, fileName, fileSize }: ShareCodeDisplayProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!code) return;
    const shareUrl = `${window.location.origin}?code=${code}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* File info row */}
      {fileName && (
        <div className="flex items-center gap-3 p-3.5 bg-muted/40 border border-border rounded-xl">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <FileIcon size={15} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{fileName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(fileSize)}</p>
          </div>
          <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full border ${
            isConnected
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
          }`}>
            {isConnected ? <Wifi size={9} strokeWidth={2.5} /> : <WifiOff size={9} strokeWidth={2.5} />}
            {isConnected ? 'Connected' : 'Waiting'}
          </div>
        </div>
      )}

      {/* Code block */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Share code</p>
        <div className="flex items-stretch gap-2">
          <div className="flex-1 bg-input border border-border rounded-xl flex items-center justify-center px-4 py-4 shadow-[inset_0_1px_3px_oklch(0_0_0/0.3)]">
            <span className="font-mono text-[2rem] font-bold text-primary tracking-[0.3em] leading-none">
              {code ?? '------'}
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            title="Copy code"
            aria-label="Copy share code"
            className="w-14 rounded-xl bg-muted border border-border flex items-center justify-center transition-all duration-200 hover:bg-card hover:border-primary/40 active:scale-95"
          >
            {copiedCode
              ? <Check size={15} className="text-emerald-400" />
              : <Copy size={15} className="text-muted-foreground" />
            }
          </button>
        </div>
      </div>

      {/* Copy link button */}
      <button
        onClick={handleCopyLink}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/30 transition-all duration-200 active:scale-[0.98]"
      >
        {copiedLink ? (
          <>
            <Check size={13} className="text-emerald-400" />
            <span className="text-emerald-400 text-sm">Link copied!</span>
          </>
        ) : (
          <>
            <Link size={13} />
            Copy shareable link
          </>
        )}
      </button>

      {/* Hint */}
      <p className="text-xs text-muted-foreground leading-relaxed text-center px-1">
        Share the <span className="text-foreground font-medium">code</span> or{' '}
        <span className="text-foreground font-medium">link</span> with the recipient. Keep this tab open until the transfer completes.
      </p>
    </div>
  );
}
