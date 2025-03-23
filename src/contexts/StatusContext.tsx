import React, { createContext, ReactNode, useContext, useEffect, useState, useRef } from 'react';
import { AnalysisStatus, errorMessagesByStatus, isTerminalStatus, statusFromString } from '@/lib/status';
import { supabase } from '@/integrations/supabase/client';
import { isErrorStatus, isProcessingStatus } from '@/lib/status/utils';

// Define the context interface
interface StatusContextType {
  // Current status information
  status: AnalysisStatus;
  isLoading: boolean;
  error: string | null;
  
  // Status-related properties
  isTerminal: boolean;
  isError: boolean;
  isProcessing: boolean;
  
  // Status management methods
  setListingId: (id: string | null) => void;
  refreshStatus: () => Promise<AnalysisStatus | null>;
  
  // Entire listing data
  listing: Record<string, any> | null;
}

// Create the context with a default value
const StatusContext = createContext<StatusContextType>({
  status: AnalysisStatus.PENDING,
  isLoading: false,
  error: null,
  
  isTerminal: false,
  isError: false,
  isProcessing: false,
  
  setListingId: () => {},
  refreshStatus: async () => null,
  
  listing: null
});

// Hook for using the status context
export const useStatus = () => useContext(StatusContext);

interface StatusProviderProps {
  children: ReactNode;
  initialListingId?: string | null;
}

/**
 * Provider component for status management
 */
export const StatusProvider: React.FC<StatusProviderProps> = ({ 
  children, 
  initialListingId = null 
}) => {
  // State for the listing being tracked
  const [listingId, setListingId] = useState<string | null>(initialListingId);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.PENDING);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [listing, setListing] = useState<Record<string, any> | null>(null);
  
  // Polling state
  const [pollingInterval, setPollingInterval] = useState<number>(1000); // Start with 1 second
  const maxPollingInterval = 4000; // Max polling interval of 4 seconds
  const pollingTimeoutRef = useRef<number | null>(null);
  const initialFetchRef = useRef<boolean>(true);

  // Fetch status from API
  const fetchStatus = async (id: string, isInitialFetch = false) => {
    try {
      // Only show loading indicator on initial fetch, not during polling
      if (isInitialFetch) {
        setIsLoading(true);
      }
      
      // Fetch full listing data
      const { data, error } = await supabase
        .from('client_apartment_listings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error('Listing not found');
      }
      
      // Update listing data
      setListing(data);
      
      // Update status
      const newStatus = statusFromString(data.status || '');
      setStatus(newStatus);
      
      // Set error message if this is an error status
      if (isErrorStatus(newStatus)) {
        const errorMessage = errorMessagesByStatus[newStatus];
        setError(errorMessage);
      } else {
        setError(null);
      }
      
      return newStatus;
    } catch (error) {
      console.error('Error fetching listing status:', error);
      setError('Error fetching listing data');
      return null;
    } finally {
      if (isInitialFetch) {
        setIsLoading(false);
      }
    }
  };
  
  // Refresh the status
  const refreshStatus = async () => {
    if (!listingId) return null;
    return fetchStatus(listingId, true);
  };
  
  // Set up polling for status changes
  useEffect(() => {
    initialFetchRef.current = true; // Reset to true when listingId changes
    
    if (!listingId) {
      // Reset state when no listing ID
      setStatus(AnalysisStatus.PENDING);
      setError(null);
      setListing(null);
      
      // Clear any existing timeout
      if (pollingTimeoutRef.current !== null) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      return;
    }
    
    // Initial fetch
    fetchStatus(listingId, true).then(() => {
      initialFetchRef.current = false; // Mark initial fetch as completed
    });
    
    // Define the polling function
    const pollStatus = async () => {
      if (!listingId) return;
      
      const newStatus = await fetchStatus(listingId, false);
      
      // If we've reached a terminal status, stop polling completely
      if (newStatus && isTerminalStatus(newStatus)) {
        // Stop polling - don't schedule another timeout
        return;
      } else {
        // Continue polling with exponential backoff
        const nextInterval = Math.min(pollingInterval * 1.5, maxPollingInterval);
        setPollingInterval(nextInterval);
        pollingTimeoutRef.current = window.setTimeout(pollStatus, pollingInterval);
      }
    };
    
    // Start polling after a delay
    pollingTimeoutRef.current = window.setTimeout(pollStatus, pollingInterval);
    
    // Clean up on unmount or when listingId changes
    return () => {
      if (pollingTimeoutRef.current !== null) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [listingId]);
  
  // Derived state
  const isTerminal = isTerminalStatus(status);
  const isError = isErrorStatus(status);
  const isProcessing = isProcessingStatus(status);
  
  // Create context value
  const contextValue: StatusContextType = {
    status,
    isLoading,
    error,
    
    isTerminal,
    isError,
    isProcessing,
    
    setListingId,
    refreshStatus,
    
    listing
  };
  
  return (
    <StatusContext.Provider value={contextValue}>
      {children}
    </StatusContext.Provider>
  );
};