import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AnalysisStatus, errorMessagesByStatus, isTerminalStatus, statusFromString } from '@/lib/status';
import { apiClient, ApiError, Listing } from '@/integrations/api/client';
import { isErrorStatus, isProcessingStatus } from '@/lib/status/utils';

interface StatusContextType {
  status: AnalysisStatus;
  isLoading: boolean;
  error: string | null;

  isTerminal: boolean;
  isError: boolean;
  isProcessing: boolean;

  setListingId: (id: string | null) => void;
  refreshStatus: () => Promise<void>;

  listing: Listing | null;
}

const StatusContext = createContext<StatusContextType>({
  status: AnalysisStatus.PENDING,
  isLoading: false,
  error: null,

  isTerminal: false,
  isError: false,
  isProcessing: false,

  setListingId: () => {},
  refreshStatus: async () => {},

  listing: null,
});

export const useStatus = () => useContext(StatusContext);

interface StatusProviderProps {
  children: ReactNode;
  initialListingId?: string | null;
}

export const StatusProvider: React.FC<StatusProviderProps> = ({
  children,
  initialListingId = null,
}) => {
  const [listingId, setListingId] = useState<string | null>(initialListingId);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.PENDING);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const closeStreamRef = useRef<(() => void) | null>(null);

  const applyListing = (data: Listing) => {
    setListing(data);
    const newStatus = statusFromString(data.status || '');
    setStatus(newStatus);
    if (isErrorStatus(newStatus)) {
      setError(errorMessagesByStatus[newStatus] || 'An unknown error occurred.');
    } else {
      setError(null);
    }
  };

  const fetchStatus = async (id: string): Promise<Listing | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getListing(id);
      applyListing(data);
      return data;
    } catch (err) {
      console.error('Error in fetchStatus:', err);
      setStatus(AnalysisStatus.ERROR);
      const message =
        err instanceof ApiError && err.status === 404
          ? `Listing with ID ${id} not found.`
          : (err as Error)?.message || 'Error fetching listing data';
      setError(message);
      setListing(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!listingId) return;
    await fetchStatus(listingId);
  };

  useEffect(() => {
    const cleanup = () => {
      if (closeStreamRef.current) {
        console.log(`Closing SSE stream for listing ${listingId}`);
        closeStreamRef.current();
        closeStreamRef.current = null;
      }
      setStatus(AnalysisStatus.PENDING);
      setError(null);
      setListing(null);
      setIsLoading(false);
    };

    if (!listingId) {
      cleanup();
      return cleanup;
    }

    let cancelled = false;

    fetchStatus(listingId).then((initial) => {
      if (cancelled || !initial) return;

      // No need to subscribe if the listing already finished before we got here.
      if (isTerminalStatus(statusFromString(initial.status))) return;

      console.log(`Opening SSE stream for listing ${listingId}`);
      closeStreamRef.current = apiClient.streamListingEvents(listingId, {
        onStatus: applyListing,
        onComplete: applyListing,
        onError: (data, message) => {
          if (data) applyListing(data);
          else if (message) setError(message);
        },
      });
    });

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const isTerminal = isTerminalStatus(status);
  const isError = isErrorStatus(status);
  const isProcessing = isProcessingStatus(status);

  const contextValue: StatusContextType = {
    status,
    isLoading,
    error,

    isTerminal,
    isError,
    isProcessing,

    setListingId,
    refreshStatus,

    listing,
  };

  return <StatusContext.Provider value={contextValue}>{children}</StatusContext.Provider>;
};
