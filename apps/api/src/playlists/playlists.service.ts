import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SavePlaylistDto } from './dto/save-playlist.dto';
import { ResetPlaylistDto } from './dto/reset-playlist.dto';
import { ChangeDomainDto } from './dto/change-domain.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { Prisma } from '@prisma/client';
import { PlaylistPinService } from '../public/playlist-pin.service';

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);

  constructor(
    private prisma: PrismaService,
    private pinService: PlaylistPinService,
  ) {}

  async save(userId: string, dto: SavePlaylistDto) {
    // Verify the device exists for this MAC + app and belongs to the user
    const device = await this.prisma.device.findFirst({
      where: {
        macAddress: dto.macAddress,
        appId: dto.appId,
        userId,
      },
      include: {
        app: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!device) {
      throw new NotFoundException(
        'Device not found for this MAC address and app, or you do not own it',
      );
    }

    const pinHash = await this.pinService.hashForStorage(dto.pin);

    const playlist = await this.prisma.$transaction(async (tx) => {
      const created = await tx.playlist.create({
        data: {
          userId,
          macAddress: dto.macAddress,
          appId: dto.appId,
          appPlatform: dto.appPlatform ?? device.app.slug,
          playlistUrl: dto.playlistUrl,
          playlistName: dto.playlistName,
          xmlUrl: dto.xmlUrl || '',
          pinHash: pinHash ?? undefined,
          isProtected: dto.isProtected ?? false,
        },
      });

      // Keep the device's primary playlistUrl in sync so the Android app's
      // public/check-activation response carries it without extra lookups.
      await tx.device.update({
        where: { id: device.id },
        data: { playlistUrl: dto.playlistUrl },
      });

      return created;
    });

    this.logger.log(
      `Playlist "${dto.playlistName}" saved for device ${dto.macAddress} by user ${userId}`,
    );

    return stripPinHash(playlist);
  }

  async reset(userId: string, dto: ResetPlaylistDto, ipAddress?: string) {
    // Verify the device exists and belongs to the user
    const device = await this.prisma.device.findFirst({
      where: {
        macAddress: dto.mac_address,
        appId: dto.app_id,
        userId,
      },
      include: {
        app: { select: { id: true, name: true } },
      },
    });

    if (!device) {
      throw new NotFoundException(
        'Device not found for this MAC address and app, or you do not own it',
      );
    }

    // Delete all playlists for this MAC + app for the user
    const deleted = await this.prisma.playlist.deleteMany({
      where: {
        macAddress: dto.mac_address,
        appId: dto.app_id,
        userId,
      },
    });

    // Log the activity
    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'playlist.reset',
        ipAddress: ipAddress || '',
        details: {
          macAddress: dto.mac_address,
          appId: dto.app_id,
          appName: device.app.name,
          module: dto.module,
          playlistType: dto.playlist_type,
          deviceKey: dto.device_key,
          deletedCount: deleted.count,
        },
      },
    });

    this.logger.log(
      `Reset ${deleted.count} playlist(s) for device ${dto.mac_address} by user ${userId}`,
    );

    return {
      message: 'Playlists reset successfully',
      deletedCount: deleted.count,
    };
  }

  async changeDomain(userId: string, dto: ChangeDomainDto) {
    // Extract the old domain from the current playlist URL
    let oldDomain: string;
    try {
      const parsed = new URL(dto.current_playlist_url);
      oldDomain = `${parsed.protocol}//${parsed.host}`;
    } catch {
      throw new BadRequestException('Invalid current_playlist_url format');
    }

    // Normalize new domain (remove trailing slash)
    const newDomain = dto.new_domain.replace(/\/+$/, '');

    // Find all devices belonging to this user with the given app
    const userDevices = await this.prisma.device.findMany({
      where: {
        userId,
        appId: dto.app_id,
      },
      select: { macAddress: true },
    });

    if (userDevices.length === 0) {
      throw new NotFoundException('No devices found for this app');
    }

    const macAddresses = userDevices.map((d) => d.macAddress);

    // Find all playlists matching the current URL for user's devices
    const matchingPlaylists = await this.prisma.playlist.findMany({
      where: {
        userId,
        macAddress: { in: macAddresses },
        appId: dto.app_id,
        playlistUrl: { startsWith: oldDomain },
        appPlatform: dto.app_platform,
      },
    });

    if (matchingPlaylists.length === 0) {
      return { message: 'No playlists found matching the current URL', updatedCount: 0 };
    }

    // Update each playlist, replacing the old domain with the new one
    let updatedCount = 0;
    for (const playlist of matchingPlaylists) {
      const updatedUrl = playlist.playlistUrl.replace(oldDomain, newDomain);
      await this.prisma.playlist.update({
        where: { id: playlist.id },
        data: { playlistUrl: updatedUrl },
      });
      updatedCount++;
    }

    this.logger.log(
      `Changed domain from ${oldDomain} to ${newDomain} for ${updatedCount} playlist(s) by user ${userId}`,
    );

    return {
      message: 'Domain updated successfully',
      updatedCount,
    };
  }

  async findAll(
    userId: string,
    query: {
      mac_address?: string;
      app_id?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PlaylistWhereInput = { userId };

    if (query.mac_address) {
      where.macAddress = query.mac_address;
    }
    if (query.app_id) {
      where.appId = query.app_id;
    }

    const [rows, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          macAddress: true,
          appId: true,
          appPlatform: true,
          playlistUrl: true,
          playlistName: true,
          xmlUrl: true,
          isProtected: true,
          pinHash: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.playlist.count({ where }),
    ]);

    // Never ship the hash to the dashboard — surface a boolean flag instead.
    const data = rows.map(({ pinHash, ...rest }) => ({
      ...rest,
      hasPin: !!pinHash,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async checkStatus(userId: string, macAddress: string, appId: string) {
    const device = await this.prisma.device.findFirst({
      where: {
        macAddress,
        appId,
        userId,
      },
      include: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
      },
    });

    if (!device) {
      throw new NotFoundException(
        'Device not found for this MAC address and app, or you do not own it',
      );
    }

    const playlists = await this.prisma.playlist.findMany({
      where: {
        macAddress,
        appId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      found: true,
      macAddress: device.macAddress,
      appId: device.appId,
      appName: device.app.name,
      status: device.status,
      expiresAt: device.expiresAt ?? undefined,
      playlists: playlists.map((p) => ({
        id: p.id,
        name: p.playlistName,
        url: p.playlistUrl,
        xmlUrl: p.xmlUrl || '',
        isProtected: p.isProtected,
        createdAt: p.createdAt,
      })),
    };
  }

  async update(userId: string, id: string, dto: UpdatePlaylistDto) {
    const existing = await this.prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Playlist not found');
    }

    // Only hash the PIN if the caller actually sent one. `undefined` means
    // "leave unchanged"; an empty string means "clear it".
    let pinHashUpdate: string | null | undefined = undefined;
    if (dto.pin !== undefined) {
      pinHashUpdate = dto.pin === '' ? null : await this.pinService.hashForStorage(dto.pin);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.playlist.update({
        where: { id },
        data: {
          playlistUrl: dto.playlistUrl ?? undefined,
          playlistName: dto.playlistName ?? undefined,
          xmlUrl: dto.xmlUrl ?? undefined,
          pinHash: pinHashUpdate,
          isProtected: dto.isProtected ?? undefined,
        },
      });

      if (dto.playlistUrl && dto.playlistUrl !== existing.playlistUrl) {
        await tx.device.updateMany({
          where: {
            userId,
            macAddress: existing.macAddress,
            appId: existing.appId,
            playlistUrl: existing.playlistUrl,
          },
          data: { playlistUrl: dto.playlistUrl },
        });
      }

      return next;
    });

    this.logger.log(
      `Playlist ${id} updated by user ${userId} (device ${existing.macAddress})`,
    );

    return stripPinHash(updated);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.playlist.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Playlist not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.playlist.delete({ where: { id } });

      // If the device was pointing at this playlist, fall back to the next most
      // recent playlist for the same device (or clear it if none left).
      const remaining = await tx.playlist.findFirst({
        where: {
          userId,
          macAddress: existing.macAddress,
          appId: existing.appId,
        },
        orderBy: { createdAt: 'desc' },
      });

      await tx.device.updateMany({
        where: {
          userId,
          macAddress: existing.macAddress,
          appId: existing.appId,
          playlistUrl: existing.playlistUrl,
        },
        data: { playlistUrl: remaining?.playlistUrl ?? null },
      });
    });

    this.logger.log(
      `Playlist ${id} deleted by user ${userId} (device ${existing.macAddress})`,
    );

    return { message: 'Playlist deleted successfully' };
  }
}

type PlaylistRowLike = { pinHash?: string | null } & Record<string, unknown>;

function stripPinHash<T extends PlaylistRowLike>(
  row: T,
): Omit<T, 'pinHash'> & { hasPin: boolean } {
  const { pinHash, ...rest } = row;
  return { ...rest, hasPin: !!pinHash };
}
