import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Persists the query cache only (avoids an initial loading flash on relaunch) — SQLite, not this
// cache, is the durable source of truth for offline data.
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'mediscan-query-cache',
});
