/**
 * Connection toast notifications — pre-built toast messages for connection
 * state changes (reconnected, rate limited, config saved, deploy events).
 *
 * Uses the Hoox-styled toast helpers from ./toast.tsx.
 * Imported and called from the app root or StatusBar when connection state changes.
 */
import { toastSuccess, toastWarning, toastInfo } from './toast'
import { formatDuration } from "@jango-blockchained/hoox-shared"

// ─── Toast factory functions ─────────────────────────────────────────────────

/**
 * Show a "Reconnected" toast with downtime duration.
 * Called when the connection state transitions back to 'connected' after a
 * disconnection period.
 *
 * @param disconnectedAt  Timestamp (ms) when the disconnection began
 */
export function toastReconnected(disconnectedAt: number): void {
  const now = Date.now()
  const downtime = now - disconnectedAt
  const duration = formatDuration(downtime)
  toastSuccess(`Reconnected \u2022 ${duration} downtime`)
}

/**
 * Show a rate limit warning toast.
 * Called when the API returns HTTP 429.
 */
export function toastRateLimited(): void {
  toastWarning('API rate limited \u2014 backing off', {
    duration: 6000,
  })
}

/**
 * Show a config saved confirmation toast.
 * Called after config-store persists to disk.
 */
export function toastConfigSaved(): void {
  toastSuccess('Configuration saved', {
    duration: 3000,
  })
}

/**
 * Show a deploy started toast (loading/persistent).
 * Returns the toast ID so it can be updated to success/error when deploy completes.
 *
 * @param workerName  Name of the worker being deployed
 * @returns           Toast ID for updating later
 */
export function toastDeployStarted(workerName: string): string | number {
  return toastInfo(`Deploy started: ${workerName}`, {
    duration: 0, // persistent until updated
  })
}

/**
 * Show a deploy completed toast.
 * Updates or creates a success toast for the completed deployment.
 *
 * @param workerName  Name of the deployed worker
 */
export function toastDeployCompleted(workerName: string): void {
  toastSuccess(`Deploy completed: ${workerName}`, {
    duration: 4000,
  })
}

/**
 * Show a deploy failed toast.
 *
 * @param workerName  Name of the worker that failed to deploy
 * @param error       Error message
 */
export function toastDeployFailed(workerName: string, error: string): void {
  toastWarning(`Deploy failed: ${workerName} \u2014 ${error}`, {
    duration: 8000,
  })
}

/**
 * Show a connection lost warning toast.
 * Called when the connection transitions to 'offline'.
 */
export function toastConnectionLost(): void {
  toastWarning('Connection lost \u2014 retrying with backoff', {
    duration: 0, // persistent until reconnected
  })
}
