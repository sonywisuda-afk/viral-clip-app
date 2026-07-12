import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { metricsRegistry } from './metrics-registry';

// Bound globally in AppModule.configure() - records every HTTP response's
// status code into metricsRegistry. 'finish' (not 'close') fires once the
// response has actually been sent, with res.statusCode already set to its
// final value.
@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => metricsRegistry.recordRequest(res.statusCode));
    next();
  }
}
