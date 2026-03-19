'use client';

import { useRef, useState } from 'react';
import { CloudUpload } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
}

export default function FileDropZone({ onFileSelect }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) onFileSelect(files[0]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) onFileSelect(files[0]);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Drop zone — click or drag a file to upload"
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={`
        relative rounded-xl border-2 border-dashed p-10 text-center cursor-pointer
        select-none transition-all duration-200 outline-none
        focus-visible:ring-2 focus-visible:ring-primary/50
        ${isDragging
          ? 'border-primary bg-primary/5 shadow-[0_0_30px_oklch(0.72_0.19_200/0.1)]'
          : 'border-border hover:border-primary/40 hover:bg-muted/20 bg-transparent'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      <div className={`flex flex-col items-center gap-3 transition-transform duration-200 ${isDragging ? 'scale-105' : ''}`}>
        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-200 ${
          isDragging
            ? 'bg-primary/15 border-primary/30 shadow-[0_0_16px_oklch(0.72_0.19_200/0.2)]'
            : 'bg-muted/50 border-border'
        }`}>
          <CloudUpload
            size={22}
            strokeWidth={1.5}
            className={isDragging ? 'text-primary' : 'text-muted-foreground'}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragging ? 'Release to select' : 'Drop your file here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or{' '}
            <span className="text-primary underline underline-offset-2 decoration-primary/40">
              browse from device
            </span>
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground/50">Any file type — any size</p>
      </div>
    </div>
  );
}
