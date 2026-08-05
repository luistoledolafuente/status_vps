import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ObservabilityState } from '../observability/state';

@Injectable()
export class ResponseTimeMiddleware implements NestMiddleware {
  constructor(private readonly state: ObservabilityState) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const started = Date.now();
    res.on('finish', () => {
      this.state.recordResponseTime(Date.now() - started);
    });
    next();
  }
}