import { Body, Controller, Post, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Public')
@Controller('api/public')
export class PublicController {
  constructor(private prisma: PrismaService) {}

  @Post('check-activation')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Public endpoint for Android/end-user apps to check MAC activation',
  })
  async checkActivation(
    @Body() body: { macAddress: string; appSlug?: string; appId?: string },
  ) {
    const mac = body.macAddress?.trim().toUpperCase();
    if (!mac) {
      throw new NotFoundException('macAddress is required');
    }

    const where: any = {
      OR: [{ macAddress: mac }, { macAddressAlt: mac }],
    };

    if (body.appId) {
      where.appId = body.appId;
    } else if (body.appSlug) {
      where.app = { slug: body.appSlug };
    }

    const device = await this.prisma.device.findFirst({
      where,
      include: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
      },
      orderBy: { activatedAt: 'desc' },
    });

    if (!device) {
      throw new NotFoundException('No activation found for this MAC');
    }

    return {
      id: device.id,
      macAddress: device.macAddress,
      status: device.status,
      packageType: device.packageType,
      activatedAt: device.activatedAt,
      expiresAt: device.expiresAt,
      playlistUrl: device.playlistUrl,
      app: device.app,
    };
  }

  @Post('apps')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Public list of active apps for device selection' })
  async listApps() {
    return this.prisma.app.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, iconUrl: true },
      orderBy: { name: 'asc' },
    });
  }
}
