import { createContext, useContext, useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { setNetworkState } from '@/lib/network-state';

type NetworkContextValue = {
  isConnected: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
});

function isReachable(info: NetInfoState): boolean {
  return info.isInternetReachable ?? info.isConnected ?? true;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);

  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    let cancelled = false;

    NetInfo.fetch().then((info) => {
      if (cancelled) return;
      const reachable = isReachable(info);
      setIsConnected(reachable);
      setNetworkState(reachable);
    });

    const unsubscribe = NetInfo.addEventListener((info) => {
      if (cancelled) return;
      const reachable = isReachable(info);
      setIsConnected(reachable);
      setNetworkState(reachable);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
