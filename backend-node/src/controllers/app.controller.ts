import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { settings } from '../config/settings';
import { Public } from '../auth/guard';
import { createAccessToken, verifyCredentials } from '../auth/security';

@Controller('api')
export class AppController {
  @Get()
  root(): Record<string, unknown> {
    return {
      service: settings.appName,
      version: settings.appVersion,
      docs: '/docs',
      health: '/api/health',
      metrics: ['/api/metrics/summary', '/api/metrics/processes', '/api/metrics/history'],
      services: '/api/services',
      alerts: '/api/alerts',
      auth: '/api/auth/token',
      websocket: '/ws/metrics',
    };
  }
}

@Controller('api/auth')
export class AuthController {
  @Public()
  @Post('/token')
  login(
    @Body('username') username: string,
    @Body('password') password: string,
  ): Record<string, unknown> {
    try {
      const user = verifyCredentials(settings, username ?? '', password ?? '');
      const token = createAccessToken(user.username, user.role, settings);
      return {
        access_token: token,
        token_type: 'bearer',
        expires_in: settings.tokenExpireMinutes * 60,
        username: user.username,
        role: user.role,
      };
    } catch {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
  }
}