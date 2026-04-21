import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DeviceTokenService, ResolvedDeviceToken } from '../device-token.service';

export interface DeviceAuthedRequest extends Request {
  deviceAuth: ResolvedDeviceToken;
}

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private tokenService: DeviceTokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<DeviceAuthedRequest>();
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Expected Bearer token');
    }
    req.deviceAuth = await this.tokenService.resolve(token);
    return true;
  }
}
