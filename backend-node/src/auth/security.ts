import jwt from 'jsonwebtoken';
import type { Settings } from '../config/settings';

export interface TokenPayload {
  sub: string;
  role: 'admin' | 'viewer';
  iat: number;
  exp: number;
}

export interface UserInfo {
  username: string;
  role: 'admin' | 'viewer';
  authenticated: boolean;
}

export function createAccessToken(username: string, role: string, settings: Settings): string {
  return jwt.sign(
    { sub: username, role },
    settings.jwtSecret,
    { algorithm: settings.jwtAlgorithm as 'HS256', expiresIn: settings.tokenExpireMinutes * 60 },
  );
}

export function decodeToken(token: string, settings: Settings): TokenPayload {
  return jwt.verify(token, settings.jwtSecret, {
    algorithms: [settings.jwtAlgorithm as 'HS256'],
  }) as TokenPayload;
}

export function resolveUser(settings: Settings, authorization?: string | null): UserInfo {
  if (!settings.authEnabled) {
    return { username: 'development', role: 'admin', authenticated: false };
  }
  const header = authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    throw new Error('Token requerido. Inicia sesión en /api/auth/token.');
  }
  try {
    const payload = decodeToken(header.slice(7), settings);
    const role = payload.role === 'admin' ? 'admin' : 'viewer';
    return { username: payload.sub, role, authenticated: true };
  } catch {
    throw new Error('Token inválido o expirado.');
  }
}

const USERS = (settings: Settings): Record<string, { password: string; role: 'admin' | 'viewer' }> => ({
  [settings.adminUsername]: { password: settings.adminPassword, role: 'admin' },
  [settings.viewerUsername]: { password: settings.viewerPassword, role: 'viewer' },
});

export function verifyCredentials(settings: Settings, username: string, password: string): UserInfo {
  const users = USERS(settings);
  const user = users[username];
  if (!user || user.password !== password) {
    throw new Error('Usuario o contraseña incorrectos.');
  }
  return { username, role: user.role, authenticated: true };
}

export function requireRole(user: UserInfo, role: 'admin' | 'viewer'): UserInfo {
  if (user.role !== role) {
    throw new Error('Permisos insuficientes.');
  }
  return user;
}