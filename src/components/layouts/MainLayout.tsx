import React, { Suspense, PropsWithChildren } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Link } from 'react-router-dom';
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
          <Suspense fallback={<AnalysisInitialLoading error={null} />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
      
      <footer className="border-t border-border mt-auto py-6">
        <div className="container px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">© 2024 Boliganalyse.ai</p>
            <div className="flex items-center gap-6 sm:gap-4">
              <Link to="/vilkar" className="text-sm text-muted-foreground hover:text-foreground">Vilkår</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;