import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { appLogger } from '../logger/app-logger';

const HEADER = 'x-request-id';

function getHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name] ?? (req.headers[name.toLowerCase()] as any);
  if (!v) return undefined;
  if (Array.isArray(v)) return v[0];
  return String(v);
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = getHeader(req, HEADER);
  const requestId =
    incoming && incoming.trim() ? incoming.trim() : randomUUID();

  (req as any).requestId = requestId;
  (res.locals as any).requestId = requestId;

  // Always echo the requestId back to the caller
  res.setHeader(HEADER, requestId);

  const startedAt = Date.now();
  appLogger.info({
    event: 'http.request.start',
    requestId,
    method: req.method,
    path: req.originalUrl ?? req.url,
  });

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const userId =
      (req as any)?.user?.id ?? (req as any)?.user?.sub ?? undefined;
    appLogger.info({
      event: 'http.request.end',
      requestId,
      method: req.method,
      path: req.originalUrl ?? req.url,
      status: res.statusCode,
      durationMs,
      userId,
    });
  });

  next();
}




