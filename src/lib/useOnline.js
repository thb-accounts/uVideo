import { useSyncExternalStore } from 'react'
import { getNetworkStatus, subscribeNetwork } from './networkStatus'
export function useOnline() {
  return useSyncExternalStore(subscribeNetwork, getNetworkStatus, () => true)
}
