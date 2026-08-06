import { Controller, ForbiddenException, Get, HttpException, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { settings } from '../config/settings';
import { getPm2Logs, getPm2Processes, isPm2Action, runPm2Action, type Pm2LogsResponse, type Pm2Response } from '../pm2/pm2';

@Controller('api/pm2')
export class Pm2Controller {
  @Get()
  list(): Promise<Pm2Response> {
    return getPm2Processes();
  }

  @Get('logs/:id')
  logs(@Param('id') id: string, @Query('lines') lines?: string): Promise<Pm2LogsResponse> {
    const count = Number(lines) || 200;
    return getPm2Logs(id, count);
  }

  @Post(':id/:action')
  async act(
    @Param('id') id: string,
    @Param('action') action: string,
    @Req() request: Request & { user?: { role?: string } },
  ): Promise<{ ok: boolean; detail: string }> {
    const role = request.user?.role ?? (settings.authEnabled ? undefined : 'admin');
    if (role !== 'admin') {
      throw new ForbiddenException('Permisos insuficientes. Solo el administrador puede gestionar procesos PM2.');
    }
    if (!isPm2Action(action)) {
      throw new HttpException(`Acción desconocida: ${action}`, HttpStatus.BAD_REQUEST);
    }
    const result = await runPm2Action(id, action);
    if (!result.ok) {
      throw new HttpException(result.detail, HttpStatus.BAD_GATEWAY);
    }
    return result;
  }
}
