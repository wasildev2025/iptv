import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceAuthedRequest } from '../guards/device-token.guard';
import { ResolvedDeviceToken } from '../device-token.service';

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ResolvedDeviceToken => {
    const req = ctx.switchToHttp().getRequest<DeviceAuthedRequest>();
    return req.deviceAuth;
  },
);
