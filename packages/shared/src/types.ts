export interface StandardResponse {
  success: boolean;
  result?: unknown;
  error?: string | null;
  message?: string;
  tradeResult?: unknown;
  notificationResult?: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;