import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import * as express from 'express';
import { AppModule } from './app.module';
import { settings } from './config/settings';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: settings.corsOrigins,
      credentials: true,
    },
  });
  app.use(express.urlencoded({ extended: true }));
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(settings.port);
  console.log(`[startup] System Status API listening on 0.0.0.0:${settings.port}`);
}

void bootstrap();