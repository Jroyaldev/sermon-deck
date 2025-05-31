'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import toast from 'react-hot-toast';

/**
 * QueryProvider component
 * 
 * Sets up React Query for data fetching with optimized settings,
 * error handling, and development tools.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a client that persists between renders
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time (data considered fresh for 5 minutes)
        staleTime: 5 * 60 * 1000,
        
        // Default cache time (data kept in cache for 10 minutes)
        gcTime: 10 * 60 * 1000,
        
        // Retry logic - retry 3 times with exponential backoff
        retry: (failureCount, error) => {
          // Don't retry on 404s or 401s
          if (error instanceof Error) {
            const status = (error as any)?.response?.status;
            if (status === 404 || status === 401 || status === 403) {
              return false;
            }
          }
          return failureCount < 3;
        },
        
        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        
        // Refetch on reconnect for offline support
        refetchOnReconnect: true,
        
        // Show error toast on query errors
        onError: (error) => {
          const message = error instanceof Error
            ? error.message
            : 'An unexpected error occurred';
          
          toast.error(message);
          console.error('Query error:', error);
        },
      },
      mutations: {
        // Retry failed mutations 2 times
        retry: 2,
        
        // Show error toast on mutation errors
        onError: (error) => {
          const message = error instanceof Error
            ? error.message
            : 'An unexpected error occurred';
          
          toast.error(message);
          console.error('Mutation error:', error);
        },
      },
    },
  }));

  // Setup offline detection and persistence
  React.useEffect(() => {
    // Handle offline status
    const handleOnline = () => {
      toast.success('You are back online');
      // Refetch any stale queries when coming back online
      queryClient.refetchQueries({ type: 'all', stale: true });
    };

    const handleOffline = () => {
      toast.error('You are offline. Some features may be limited.');
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Clean up
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
