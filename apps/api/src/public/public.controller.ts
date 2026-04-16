import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

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
    const raw = body?.macAddress?.trim();
    if (!raw) {
      throw new BadRequestException('macAddress is required');
    }
    if (!MAC_REGEX.test(raw)) {
      throw new BadRequestException(
        'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
      );
    }
    const mac = raw.toUpperCase().replace(/-/g, ':');

    const where: Record<string, unknown> = {
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
