import NetInfo from '@react-native-community/netinfo';

type NetworkState = 'unknown' | 'online' | 'offline';
let _state: NetworkState = 'unknown';

// Eagerly fetch the current network state on module load.
NetInfo.fetch().then((info) => {
  // isInternetReachable is the real check — isConnected just means WiFi/cellular is associated
  const reachable = info.isInternetReachable ?? info.isConnected ?? true;
  _state = reachable ? 'online' : 'offline';
});

function getIsConnected(): boolean {
  return _state === 'online';
}

export function getIsOffline(): boolean {
  return _state !== 'online';
}

export function isNetworkStateKnown(): boolean {
  return _state !== 'unknown';
}

export function setNetworkState(connected: boolean): void {
  _state = connected ? 'online' : 'offline';
}
