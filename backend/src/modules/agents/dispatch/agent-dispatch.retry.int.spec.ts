import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import net from 'node:net';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { parseRedisUrl } from './agent-dispatch.util';
import { dispatchToN8n } from './agent-dispatch.processor';

describe('Agent dispatch retry (integration, BullMQ + Redis)', () => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = parseRedisUrl(redisUrl);

  it('retries once: first 500 then 200 -> completed', async () => {
    // Skip if Redis is unavailable (avoid creating BullMQ objects to prevent noisy connection logs)
    const redisUp = await new Promise<boolean>((resolve) => {
      const sock = net.createConnection(
        { host: connection.host, port: connection.port },
        () => {
          sock.end();
          resolve(true);
        },
      );
      sock.setTimeout(300, () => {
        sock.destroy();
        resolve(false);
      });
      sock.on('error', () => resolve(false));
    });
    if (!redisUp) return;

    let hit = 0;
    const server = createServer(async (_req, res) => {
      hit += 1;
      if (hit === 1) {
        res.statusCode = 500;
        res.end('fail');
        return;
      }
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const endpoint = `http://127.0.0.1:${port}/webhook`;

    const queueName = `agent-dispatch-it-${Date.now()}`;
    const queue = new Queue(queueName, { connection });
    const events = new QueueEvents(queueName, { connection });
    const worker = new Worker(
      queueName,
      async (job: any) => {
        await dispatchToN8n({
          endpoint: job.data.endpoint,
          payload: job.data.payload,
          headers: job.data.headers,
          timeoutMs: 2000,
        });
        return { ok: true };
      },
      { connection, concurrency: 1 },
    );

    try {
      const job = await queue.add(
        'agent-dispatch',
        { runId: 'run-it-1', endpoint, payload: { x: 1 } },
        { attempts: 2, backoff: { type: 'exponential', delay: 10 } },
      );

      await job.waitUntilFinished(events, 10_000);

      expect(hit).toBe(2);
    } finally {
      await worker.close();
      await events.close();
      await queue.obliterate({ force: true });
      await queue.close();
      server.close();
    }
  }, 20_000);
});


