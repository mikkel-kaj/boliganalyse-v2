import React, { createContext, ReactNode, useContext, useEffect, useState, useRef } from 'react';
import { AnalysisStatus, errorMessagesByStatus, isTerminalStatus, statusFromString } from '@/lib/status';
import { supabase } from '@/integrations/supabase/client';
import { isErrorStatus, isProcessingStatus } from '@/lib/status/utils';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  refreshStatus: () => Promise<void>;
  
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
  refreshStatus: async () => {},
  
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
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch status from API
  const fetchStatus = async (id: string) => {
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      // Fetch full listing data
      const { data, error: fetchError } = await supabase
        .from('client_apartment_listings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching listing status:', fetchError);
        throw new Error('Failed to fetch listing data.');
      }

      if (!data) {
        throw new Error(`Listing with ID ${id} not found.`);
      }

      // Update state with fetched data
      setListing(data);
      const newStatus = statusFromString(data.status || '');
      setStatus(newStatus);

      if (isErrorStatus(newStatus)) {
        setError(errorMessagesByStatus[newStatus] || 'An unknown error occurred.');
      }

      return data; // Return data for potential chaining

    } catch (err: any) {
      console.error('Error in fetchStatus:', err);
      setStatus(AnalysisStatus.ERROR); // Use the generic ERROR status
      setError(err.message || 'Error fetching listing data');
      setListing(null); // Clear listing data on error
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Refresh the status
  const refreshStatus = async () => {
    if (!listingId) return;
    await fetchStatus(listingId);
  };
  
  // Set up subscription for status changes
  useEffect(() => {
    // Function to handle incoming payload
    const handlePayload = (payload: any) => {
      console.log('Supabase payload received:', payload);
      const { new: newRecord } = payload;
      if (newRecord) {
        setListing(newRecord);
        const newStatus = statusFromString(newRecord.status || '');
        setStatus(newStatus);

        if (isErrorStatus(newStatus)) {
          setError(errorMessagesByStatus[newStatus] || 'An unknown error occurred.');
        } else {
          setError(null);
        }
      }
    };

    // Cleanup function
    const cleanup = () => {
      if (channelRef.current) {
        console.log(`Unsubscribing from Supabase channel for listing ${listingId}`);
        supabase.removeChannel(channelRef.current)
          .then(() => console.log('Successfully removed channel'))
          .catch(err => console.error('Error removing channel:', err));
        channelRef.current = null;
      }
      // Reset state when listingId is cleared
      setStatus(AnalysisStatus.PENDING);
      setError(null);
      setListing(null);
      setIsLoading(false);
    };

    if (listingId) {
      // Perform initial fetch first
      fetchStatus(listingId).then(initialData => {
        // Only subscribe if the initial fetch was successful (data exists)
        if (initialData && !channelRef.current) {
          console.log(`Subscribing to Supabase channel for listing ${listingId}`);
          const channel = supabase
            .channel(`listing-status:${listingId}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'client_apartment_listings',
                filter: `id=eq.${listingId}`
              },
              handlePayload
            )
            .subscribe((status, err) => {
              if (status === 'SUBSCRIBED') {
                console.log(`Successfully subscribed to channel for listing ${listingId}`);
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`Subscription error for listing ${listingId}:`, err || status);
                setError(`Failed to subscribe to real-time updates. Status: ${status}`);
                // Optionally: attempt to resubscribe or fallback to polling
              }
            });
          channelRef.current = channel;
        } else if (!initialData) {
            // Handle case where initial fetch failed (e.g., ID not found)
            // Error state is already set by fetchStatus
            console.log(`Initial fetch failed for listing ${listingId}, not subscribing.`);
        }
      });
    } else {
      // No listingId, ensure cleanup and reset state
      cleanup();
    }

    // Return cleanup function
    return () => {
        cleanup();
    };
  }, [listingId]); // Dependency array includes listingId
  
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