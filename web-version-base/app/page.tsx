import { Suspense } from 'react';
import PageContent from '@/components/PageContent';

function LoadingFallback() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L13 7L7 13M1 7H13" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-foreground font-semibold tracking-tight text-lg">drop</span>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PageContent />
    </Suspense>
  );
}
