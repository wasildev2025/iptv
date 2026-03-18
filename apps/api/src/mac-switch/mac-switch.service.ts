import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SwitchMacDto } from './dto/switch-mac.dto';

const MAX_SWITCHES = 10;

@Injectable()
export class MacSwitchService {
  private readonly logger = new Logger(MacSwitchService.name);

  constructor(private prisma: PrismaService) {}

  async switchMac(userId: string, role: string, dto: SwitchMacDto, ipAddress?: string) {
    // Check lifetime switch limit
    const usedCount = await this.prisma.macSwitch.count({
      where: { userId, status: 'success' },
    });

    if (usedCount >= MAX_SWITCHES) {
      throw new BadRequestException(
        `You have reached the maximum of ${MAX_SWITCHES} MAC switches`,
      );
    }

    // Find the app by slug
    const app = await this.prisma.app.findUnique({
      where: { slug: dto.application },
    });

    if (!app) {
      throw new BadRequestException('Application not found');
    }

    // Find the device by old_mac + app
    const device = await this.prisma.device.findFirst({
      where: {
        macAddress: dto.old_mac,
        appId: app.id,
      },
    });

    if (!device) {
      // Log failed attempt
      await this.prisma.macSwitch.create({
        data: {
          userId,
          application: dto.application,
          oldMac: dto.old_mac,
          newMac: dto.new_mac,
          status: 'failed',
          errorMessage: 'Current device not found',
        },
      });

      throw new BadRequestException('Current device not found');
    }

    // Check ownership (unless admin)
    if (role !== 'admin' && device.userId !== userId) {
      throw new ForbiddenException('You do not own this device');
    }

    // Perform the switch in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedDevice = await tx.device.update({
        where: { id: device.id },
        data: { macAddress: dto.new_mac },
        include: {
          app: { select: { id: true, name: true, slug: true, iconUrl: true } },
        },
      });

      const macSwitch = await tx.macSwitch.create({
        data: {
          userId,
          application: dto.application,
          oldMac: dto.old_mac,
          newMac: dto.new_mac,
          status: 'success',
        },
      });

      return { device: updatedDevice, macSwitch };
    });

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'mac-switch.switch',
        ipAddress: ipAddress || '',
        details: {
          deviceId: device.id,
          application: dto.application,
          oldMac: dto.old_mac,
          newMac: dto.new_mac,
        },
      },
    });

    this.logger.log(
      `User ${userId} switched MAC from ${dto.old_mac} to ${dto.new_mac} for app ${dto.application}`,
    );

    return result;
  }

  async getInfo(userId: string) {
    const used = await this.prisma.macSwitch.count({
      where: { userId, status: 'success' },
    });

    return {
      totalAllowed: MAX_SWITCHES,
      used,
      remaining: MAX_SWITCHES - used,
    };
  }

  async getHistory(userId: string, page: number, perPage: number) {
    const skip = (page - 1) * perPage;

    const [records, total] = await Promise.all([
      this.prisma.macSwitch.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.macSwitch.count({
        where: { userId },
      }),
    ]);

    return {
      data: records,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }
}
