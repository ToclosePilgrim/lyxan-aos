export type AgentDispatchJobData = {
  runId: string;
  endpoint: string; // n8n webhook URL
  payload: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  workflowKey?: string; // optional logical name for routing/metrics
};

export type AgentDispatchDlqData = {
  failedAt: string;
  original: AgentDispatchJobData;
  job: {
    id: string | null;
    name: string;
    attemptsMade: number;
    attempts?: number;
  };
  error: {
    message: string;
    stack?: string;
    name?: string;
  };
};


