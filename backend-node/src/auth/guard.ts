import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { settings } from '../config/settings';
import { resolveUser } from './security';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (!settings.authEnabled) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    try {
      request.user = resolveUser(settings, request.headers.authorization);
    } catch {
      throw new HttpException('Token requerido. Inicia sesión en /api/auth/token.', HttpStatus.UNAUTHORIZED);
    }
    return true;
  }
}