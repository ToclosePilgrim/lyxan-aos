import { AgentDispatchWorker } from './agent-dispatch.worker';

describe('AgentDispatchWorker', () => {
  it('handleFailed pushes to DLQ on final attempt', async () => {
    const config: any = { get: () => undefined };
    const prisma: any = {
      agentRun: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const queue: any = {};
    const dlq: any = {
      add: jest.fn().mockResolvedValue({ id: 'dlq-1' }),
    };

    const worker = new AgentDispatchWorker(config, prisma, queue, dlq);

    const job: any = {
      id: 'job-1',
      name: 'agent-dispatch',
      data: { runId: 'run-1', endpoint: 'http://x', payload: {} },
      attemptsMade: 5,
      opts: { attempts: 5 },
    };

    await worker.handleFailed(job, new Error('boom'));

    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'ERROR' }),
      }),
    );
    expect(dlq.add).toHaveBeenCalled();
  });

  it('handleFailed does not push to DLQ if not final', async () => {
    const config: any = { get: () => undefined };
    const prisma: any = { agentRun: { update: jest.fn() } };
    const queue: any = {};
    const dlq: any = { add: jest.fn() };
    const worker = new AgentDispatchWorker(config, prisma, queue, dlq);

    const job: any = {
      id: 'job-1',
      name: 'agent-dispatch',
      data: { runId: 'run-1', endpoint: 'http://x', payload: {} },
      attemptsMade: 1,
      opts: { attempts: 5 },
    };

    await worker.handleFailed(job, new Error('boom'));
    expect(dlq.add).not.toHaveBeenCalled();
  });
});


