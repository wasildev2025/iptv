import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DeviceStateResponse {
  device: {
    id: string;
    macAddress: string;
    status: 'active' | 'expired' | 'disabled' | 'trial';
    packageType: 'yearly' | 'lifetime';
    activatedAt: string;
    expiresAt: string | null;
    graceEndsAt: string | null;
    isInGrace: boolean;
  };
  app: {
    id: string;
    name: string;
    slug: string;
    iconUrl: string;
  };
  playlists: Array<{
    id: string;
    name: string;
    url: string;
    xmlUrl: string;
    isProtected: boolean;
    createdAt: string;
  }>;
}

@Injectable()
export class DeviceStateBuilder {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns the current state to hand to an Android client.
   * Callers should have already decided whether the device is allowed to proceed
   * (e.g. permitted statuses, grace window). This function does NOT enforce
   * access; it just shapes the response.
   */
  async build(deviceId: string): Promise<DeviceStateResponse | null> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        app: {
          select: { id: true, name: true, slug: true, iconUrl: true },
        },
      },
    });
    if (!device) return null;

    const playlists = await this.prisma.playlist.findMany({
      where: {
        userId: device.userId,
        macAddress: device.macAddress,
        appId: device.appId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        playlistName: true,
        playlistUrl: true,
        xmlUrl: true,
        isProtected: true,
        createdAt: true,
      },
    });

    const graceDays = Number(process.env.GRACE_PERIOD_DAYS ?? 3);
    const graceEndsAt =
      device.expiresAt && device.packageType !== 'lifetime'
        ? new Date(device.expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000)
        : null;
    const now = Date.now();
    const isInGrace =
      !!device.expiresAt &&
      device.expiresAt.getTime() < now &&
      !!graceEndsAt &&
      graceEndsAt.getTime() > now;

    return {
      device: {
        id: device.id,
        macAddress: device.macAddress,
        status: device.status,
        packageType: device.packageType,
        activatedAt: device.activatedAt.toISOString(),
        expiresAt: device.expiresAt?.toISOString() ?? null,
        graceEndsAt: graceEndsAt?.toISOString() ?? null,
        isInGrace,
      },
      app: device.app,
      playlists: playlists.map((p) => ({
        id: p.id,
        name: p.playlistName,
        url: p.playlistUrl,
        xmlUrl: p.xmlUrl || '',
        isProtected: p.isProtected,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }
}
