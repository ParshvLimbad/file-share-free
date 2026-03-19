'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import FileDropZone from './FileDropZone';
import ShareCodeDisplay from './ShareCodeDisplay';
import TransferProgress from './TransferProgress';
import ReceiveFile from './ReceiveFile';
import { useP2P } from '@/lib/useP2P';
import { Upload, Download, ArrowRight, Loader2, FileIcon, X } from 'lucide-react';

function formatBytes(bytes: number) {
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

export default function PageContent() {
  const searchParams = useSearchParams();
  const shareCode = searchParams.get('code');

  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [receiveCode, setReceiveCode] = useState('');
  const [receiveSubmitted, setReceiveSubmitted] = useState(false);

  const { code, isConnected, uploadProgress, isUploading, initiateTransfer } = useP2P();

  if (shareCode) {
    return <ReceiveFile code={shareCode} />;
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setShowCode(false);
  };

  const handleStartTransfer = async () => {
    if (!selectedFile) return;
    try {
      await initiateTransfer(selectedFile);
      setShowCode(true);
    } catch (error) {
      console.error('Transfer error:', error);
    }
  };

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = receiveCode.trim().toUpperCase();
    if (!trimmed) return;
    setReceiveSubmitted(true);
  };

  if (receiveSubmitted && receiveCode.trim()) {
    return <ReceiveFile code={receiveCode.trim().toUpperCase()} />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Subtle dot grid background */}
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
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2 text-balance">
            Peer-to-peer file transfer
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            No uploads. No servers. Files go directly between browsers.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="relative flex items-center gap-0 p-1 bg-muted/60 rounded-2xl mb-5 border border-border">
          {/* Sliding indicator */}
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-xl bg-card border border-border shadow-sm transition-all duration-200 ease-out"
            style={{ left: activeTab === 'send' ? '4px' : 'calc(50% + 2px)' }}
          />
          <button
            onClick={() => setActiveTab('send')}
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
              activeTab === 'send' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            }`}
          >
            <Upload size={13} strokeWidth={2.5} />
            Send
          </button>
          <button
            onClick={() => setActiveTab('receive')}
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
              activeTab === 'receive' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            }`}
          >
            <Download size={13} strokeWidth={2.5} />
            Receive
          </button>
        </div>

        {/* Main card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_0_0_1px_oklch(0.2_0.01_240),0_20px_60px_oklch(0_0_0/0.4)]">
          {activeTab === 'send' ? (
            <div className="p-5 space-y-4">
              {!showCode ? (
                <>
                  <FileDropZone onFileSelect={handleFileSelect} />

                  {selectedFile && (
                    <div className="bg-muted/40 border border-border rounded-xl p-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <FileIcon size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate leading-tight">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatBytes(selectedFile.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleStartTransfer}
                    disabled={!selectedFile || isUploading}
                    className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] shadow-[0_0_20px_oklch(0.72_0.19_200/0.25)]"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Generating code...
                      </>
                    ) : (
                      <>
                        Generate share code
                        <ArrowRight size={14} strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <ShareCodeDisplay
                  code={code}
                  fileName={selectedFile?.name}
                  fileSize={selectedFile?.size}
                  isConnected={isConnected}
                />
              )}

              {isUploading && (
                <TransferProgress progress={uploadProgress} label="Preparing transfer" />
              )}
            </div>
          ) : (
            <div className="p-5">
              <form onSubmit={handleReceiveSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest block">
                    Share code
                  </label>
                  <input
                    type="text"
                    value={receiveCode}
                    onChange={(e) => setReceiveCode(e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6))}
                    placeholder="XXXXXX"
                    maxLength={6}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="characters"
                    className="w-full bg-input border border-border rounded-xl px-4 py-4 text-center text-2xl font-mono font-bold text-primary tracking-[0.35em] placeholder:text-muted-foreground/30 placeholder:text-2xl placeholder:tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all duration-200"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the code shared by the sender
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={receiveCode.trim().length < 6}
                  className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] shadow-[0_0_20px_oklch(0.72_0.19_200/0.25)]"
                >
                  Connect and receive
                  <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Or open a share link to connect automatically
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer badges */}
        <div className="flex items-center justify-center gap-5 mt-7">
          {['End-to-end encrypted', 'Zero server storage', 'No account needed'].map((label) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-primary/60" />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
