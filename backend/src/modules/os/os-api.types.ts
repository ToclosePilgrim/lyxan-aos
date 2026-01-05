export interface OsApiError {
  code: string;
  message: string;
  details?: any;
}

export interface OsApiResponse<T> {
  success: boolean;
  data?: T;
  error?: OsApiError;
}

export function ok<T>(data: T): OsApiResponse<T> {
  return { success: true, data };
}

export function fail(
  code: string,
  message: string,
  details?: any,
): OsApiResponse<never> {
  return { success: false, error: { code, message, details } };
}

