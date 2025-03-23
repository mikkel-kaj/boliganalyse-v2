import React, { Suspense, PropsWithChildren } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import Navbar from '@/components/Navbar';
import ErrorFallback from '@/components/ErrorFallback';
import AnalysisInitialLoading from '@/components/AnalysisInitialLoading';

/**
 * Main layout component with error boundary and loading state handling
 */
const MainLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Suspense fallback={<AnalysisInitialLoading />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default MainLayout;