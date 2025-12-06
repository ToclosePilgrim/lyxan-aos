export interface AgentCallbackPayload {
  status?: 'success' | 'error' | string;
  error?: string;
  message?: string;
  data?: unknown;
  result?: unknown;
  // на будущее: допускаем дополнительные поля
  [key: string]: unknown;
}





