'use client';

interface TransferProgressProps {
  progress: number;
  label?: string;
}

export default function TransferProgress({ progress, label = 'Transfer progress' }: TransferProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-semibold text-primary tabular-nums">{progress}%</span>
      </div>
      <div className="h-1 w-full bg-muted/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            background: 'oklch(0.72 0.19 200)',
            boxShadow: '0 0 8px oklch(0.72 0.19 200 / 0.6)',
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
}
