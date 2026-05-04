/**
 * Error type definitions for centralized error handling
 * Used across all workers and dashboard
 */

export interface AppError {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
}

export type ErrorResponse = {
  error: string;
  code?: string;
  details?: unknown;
};
