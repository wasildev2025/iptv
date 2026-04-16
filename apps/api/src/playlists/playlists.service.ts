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
import { Prisma } from '@prisma/client';

@Injectable()
export class PlaylistsService {
  private readonly logger = new Logger(PlaylistsService.name);

  constructor(private prisma: PrismaService) {}

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
          pin: dto.pin || undefined,
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

    return playlist;
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

    const [data, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.playlist.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async checkStatus(userId: string, macAddress: string, appId: string) {
    // Check if device exists and belongs to the user
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

    // Get existing playlists for this device
    const playlists = await this.prisma.playlist.findMany({
      where: {
        macAddress,
        appId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      device,
      playlists,
    };
  }
}
