import { AgentDispatchService } from './agent-dispatch.service';
import { AGENT_DISPATCH_QUEUE_NAME } from './agent-dispatch.constants';

describe('AgentDispatchService', () => {
  it('enqueue returns QUEUED and uses jobId dedup', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'agent-dispatch:run-1' });
    const queue: any = { add };
    const config: any = {
      get: (k: string) => {
        if (k === 'AGENT_DISPATCH_ATTEMPTS') return 5;
        if (k === 'AGENT_DISPATCH_BACKOFF_BASE_MS') return 5000;
        if (k === 'N8N_DISPATCH_SECRET') return 'secret';
        return undefined;
      },
    };

    const svc = new AgentDispatchService(queue, config);

    const res = await svc.enqueue({
      runId: 'run-1',
      endpoint: 'http://localhost:9999/webhook',
      payload: { a: 1 },
      workflowKey: 'wf',
    });

    expect(res.status).toBe('QUEUED');
    expect(add).toHaveBeenCalled();
    const [name, data, opts] = add.mock.calls[0];
    expect(name).toBe(AGENT_DISPATCH_QUEUE_NAME);
    expect(data.runId).toBe('run-1');
    expect(opts.jobId).toContain('run-1');
  });

  it('enqueue treats "already exists" as deduped', async () => {
    const add = jest.fn().mockRejectedValue(new Error('Job already exists'));
    const queue: any = { add };
    const config: any = {
      get: () => undefined,
    };
    const svc = new AgentDispatchService(queue, config);

    const res: any = await svc.enqueue({
      runId: 'run-2',
      endpoint: 'http://localhost:9999/webhook',
      payload: { a: 1 },
      workflowKey: 'wf',
    });

    expect(res.status).toBe('QUEUED');
    expect(res.deduped).toBe(true);
  });
});


