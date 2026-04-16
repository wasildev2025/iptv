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
  @ApiOperation({
    summary:
      'Public list of apps. If macAddress is provided, returns only apps that have an active/trial activation for that MAC.',
  })
  async listApps(@Body() body: { macAddress?: string } = {}) {
    const raw = body?.macAddress?.trim();

    if (!raw) {
      return this.prisma.app.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, iconUrl: true },
        orderBy: { name: 'asc' },
      });
    }

    if (!MAC_REGEX.test(raw)) {
      throw new BadRequestException(
        'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
      );
    }
    const mac = raw.toUpperCase().replace(/-/g, ':');

    const devices = await this.prisma.device.findMany({
      where: {
        status: { in: ['active', 'trial'] },
        OR: [{ macAddress: mac }, { macAddressAlt: mac }],
        app: { isActive: true },
      },
      select: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
      },
      orderBy: { activatedAt: 'desc' },
    });

    const seen = new Set<string>();
    const uniqueApps: { id: string; name: string; slug: string; iconUrl: string | null }[] = [];
    for (const d of devices) {
      if (d.app && !seen.has(d.app.id)) {
        seen.add(d.app.id);
        uniqueApps.push(d.app);
      }
    }
    return uniqueApps;
  }
}
