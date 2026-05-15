/**
 * useServiceData — Thin typed wrapper over Zustand useServiceStore.
 *
 * Usage: useServiceData(s => s.workers)
 *        useServiceData(s => s.connectionStatus)
 */
import { useServiceStore } from "@jango-blockchained/hoox-shared/stores/service-store"

export function useServiceData<T>(selector: (state: ReturnType<typeof useServiceStore.getState>) => T): T {
  return useServiceStore(selector)
}
