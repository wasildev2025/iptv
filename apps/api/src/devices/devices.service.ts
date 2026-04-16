import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResellersService } from '../resellers/resellers.service';
import { MailerService } from '../mailer/mailer.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { BulkActivateDto } from './dto/bulk-activate.dto';
import { MultiAppActivateDto } from './dto/check-device.dto';
import { Prisma, DeviceStatus, UserRole } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private prisma: PrismaService,
    private resellersService: ResellersService,
    private mailerService: MailerService,
  ) {}

  async createTrial(userId: string, dto: Pick<CreateDeviceDto, 'macAddress' | 'appId'>, ipAddress?: string) {
    // Verify app exists and is active
    const app = await this.prisma.app.findUnique({
      where: { id: dto.appId },
    });
    if (!app || !app.isActive) {
      throw new NotFoundException('App not found or inactive');
    }

    // Check if user already has a trial or active device for this MAC + App
    const existingDevice = await this.prisma.device.findFirst({
      where: {
        macAddress: dto.macAddress,
        appId: dto.appId,
        status: { in: ['trial', 'active'] },
      },
    });
    if (existingDevice) {
      throw new ConflictException(
        `MAC address ${dto.macAddress} already has an active or trial device for ${app.name}`,
      );
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const device = await this.prisma.device.create({
      data: {
        userId,
        appId: dto.appId,
        macAddress: dto.macAddress,
        packageType: 'yearly',
        status: 'trial',
        expiresAt,
      },
      include: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'device.trial',
        ipAddress: ipAddress || '',
        details: {
          deviceId: device.id,
          appName: app.name,
          macAddress: dto.macAddress,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return device;
  }

  async create(userId: string, dto: CreateDeviceDto, ipAddress?: string) {
    // Verify app exists and is active
    const app = await this.prisma.app.findUnique({
      where: { id: dto.appId },
    });
    if (!app || !app.isActive) {
      throw new NotFoundException('App not found or inactive');
    }

    // Check for duplicate MAC + App combination
    const existingDevice = await this.prisma.device.findFirst({
      where: {
        macAddress: dto.macAddress,
        appId: dto.appId,
      },
    });
    if (existingDevice) {
      throw new ConflictException(
        `MAC address ${dto.macAddress} is already registered for ${app.name}`,
      );
    }

    // Calculate credits needed (with profit margin for sub-resellers)
    const baseCost =
      dto.packageType === 'yearly' ? app.creditsYearly : app.creditsLifetime;
    const { effectiveCost: creditsNeeded, marginApplied } =
      await this.resellersService.calculateEffectiveCost(userId, baseCost);

    // Calculate expiration
    const expiresAt =
      dto.packageType === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : null;

    // Transaction: check balance + create device + deduct credits + log
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the user row to prevent race conditions on credit balance
        const [user] = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number }[]
        >(
          `SELECT id, credit_balance FROM users WHERE id = $1 FOR UPDATE`,
          userId,
        );

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const currentBalance = Number(user.credit_balance);
        if (currentBalance < creditsNeeded) {
          throw new BadRequestException(
            `Insufficient credits. Need ${creditsNeeded}, have ${currentBalance}`,
          );
        }

        const device = await tx.device.create({
          data: {
            userId,
            appId: dto.appId,
            macAddress: dto.macAddress,
            macAddressAlt: dto.macAddressAlt,
            packageType: dto.packageType,
            expiresAt,
            notes: dto.notes,
            playlistUrl: dto.playlistUrl,
          },
          include: {
            app: { select: { id: true, name: true, slug: true, iconUrl: true } },
          },
        });

        const newBalance = currentBalance - creditsNeeded;

        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: newBalance },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'activation',
            amount: new Prisma.Decimal(-creditsNeeded),
            balanceAfter: newBalance,
            referenceId: device.id,
            description: `Activated ${app.name} (${dto.packageType}) for ${dto.macAddress}`,
          },
        });

        await tx.activityLog.create({
          data: {
            userId,
            action: 'device.activate',
            ipAddress: ipAddress || '',
            details: {
              deviceId: device.id,
              appName: app.name,
              macAddress: dto.macAddress,
              packageType: dto.packageType,
              baseCost,
              creditsDeducted: creditsNeeded,
              marginApplied,
            },
          },
        });

        return device;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async findAll(
    userId: string,
    role: UserRole,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      appId?: string;
      search?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.DeviceWhereInput = {};

    // Admin sees all, others see only their own
    if (role !== UserRole.admin) {
      where.userId = userId;
    }

    if (query.status) {
      if (!Object.values(DeviceStatus).includes(query.status as DeviceStatus)) {
        throw new BadRequestException(`Invalid status: ${query.status}`);
      }
      where.status = query.status as DeviceStatus;
    }

    if (query.appId) where.appId = query.appId;

    if (query.search) {
      where.OR = [
        { macAddress: { contains: query.search, mode: 'insensitive' } },
        { macAddressAlt: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        include: {
          app: { select: { id: true, name: true, slug: true, iconUrl: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(userId: string, id: string, role?: UserRole) {
    const where: Prisma.DeviceWhereInput = { id };
    if (role !== UserRole.admin) {
      where.userId = userId;
    }

    const device = await this.prisma.device.findFirst({
      where,
      include: {
        app: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async renew(userId: string, id: string, ipAddress?: string) {
    const device = await this.findOne(userId, id);
    const app = device.app;

    if (device.packageType === 'lifetime') {
      throw new BadRequestException('Lifetime devices cannot be renewed');
    }

    if (device.status === 'disabled') {
      throw new BadRequestException(
        'Cannot renew a disabled device. Enable it first.',
      );
    }

    // Apply profit margin for sub-resellers
    const { effectiveCost: creditsNeeded, marginApplied: renewMargin } =
      await this.resellersService.calculateEffectiveCost(userId, app.creditsYearly);

    // Use row-level lock to prevent double-spend
    return this.prisma.$transaction(
      async (tx) => {
        const [user] = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number }[]
        >(
          `SELECT id, credit_balance FROM users WHERE id = $1 FOR UPDATE`,
          userId,
        );

        if (!user) throw new NotFoundException('User not found');

        const currentBalance = Number(user.credit_balance);
        if (currentBalance < creditsNeeded) {
          throw new BadRequestException(
            `Insufficient credits. Need ${creditsNeeded}, have ${currentBalance}`,
          );
        }

        // Extend from current expiry if still active, otherwise from now
        const currentExpiry = device.expiresAt
          ? new Date(device.expiresAt)
          : new Date();
        const baseDate =
          currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiry = new Date(
          baseDate.getTime() + 365 * 24 * 60 * 60 * 1000,
        );

        const updated = await tx.device.update({
          where: { id },
          data: { expiresAt: newExpiry, status: 'active' },
          include: {
            app: { select: { id: true, name: true, slug: true, iconUrl: true } },
          },
        });

        const newBalance = currentBalance - creditsNeeded;

        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: newBalance },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'renewal',
            amount: new Prisma.Decimal(-creditsNeeded),
            balanceAfter: newBalance,
            referenceId: device.id,
            description: `Renewed ${app.name} for ${device.macAddress} until ${newExpiry.toISOString().split('T')[0]}`,
          },
        });

        await tx.activityLog.create({
          data: {
            userId,
            action: 'device.renew',
            ipAddress: ipAddress || '',
            details: {
              deviceId: device.id,
              appName: app.name,
              macAddress: device.macAddress,
              previousExpiry: device.expiresAt?.toISOString(),
              newExpiry: newExpiry.toISOString(),
              baseCost: app.creditsYearly,
              creditsDeducted: creditsNeeded,
              marginApplied: renewMargin,
            },
          },
        });

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async toggleStatus(
    userId: string,
    id: string,
    disable: boolean,
    ipAddress?: string,
    role?: UserRole,
  ) {
    const device = await this.findOne(userId, id, role);

    // Prevent enabling an expired device — they must renew instead
    if (
      !disable &&
      device.expiresAt &&
      new Date(device.expiresAt) < new Date()
    ) {
      throw new BadRequestException(
        'Cannot enable an expired device. Renew it first.',
      );
    }

    const newStatus: DeviceStatus = disable ? 'disabled' : 'active';

    if (device.status === newStatus) {
      throw new BadRequestException(`Device is already ${newStatus}`);
    }

    const [updated] = await Promise.all([
      this.prisma.device.update({
        where: { id },
        data: { status: newStatus },
        include: {
          app: { select: { id: true, name: true, slug: true, iconUrl: true } },
        },
      }),
      this.prisma.activityLog.create({
        data: {
          userId,
          action: disable ? 'device.disable' : 'device.enable',
          ipAddress: ipAddress || '',
          details: {
            deviceId: device.id,
            appName: device.app.name,
            macAddress: device.macAddress,
            previousStatus: device.status,
            newStatus,
          },
        },
      }),
    ]);

    return updated;
  }

  async updateDevice(
    userId: string,
    id: string,
    data: { macAddress?: string; macAddressAlt?: string; notes?: string },
    ipAddress?: string,
    role?: UserRole,
  ) {
    const device = await this.findOne(userId, id, role);

    const macNormalized = data.macAddress?.trim().toUpperCase();
    const macAltNormalized = data.macAddressAlt?.trim().toUpperCase() || null;

    if (macNormalized && macNormalized !== device.macAddress) {
      const conflict = await this.prisma.device.findFirst({
        where: {
          macAddress: macNormalized,
          appId: device.appId,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new BadRequestException(
          `Another device is already registered with MAC ${macNormalized} for this app`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.device.update({
        where: { id },
        data: {
          ...(macNormalized ? { macAddress: macNormalized } : {}),
          ...(data.macAddressAlt !== undefined ? { macAddressAlt: macAltNormalized } : {}),
          ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        },
        include: {
          app: { select: { id: true, name: true, slug: true, iconUrl: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          userId,
          action: 'device.update',
          ipAddress: ipAddress || '',
          details: {
            deviceId: id,
            before: {
              macAddress: device.macAddress,
              macAddressAlt: device.macAddressAlt,
              notes: device.notes,
            },
            after: {
              macAddress: result.macAddress,
              macAddressAlt: result.macAddressAlt,
              notes: result.notes,
            },
          },
        },
      });

      return result;
    });

    return updated;
  }

  async remove(userId: string, id: string, ipAddress?: string, role?: UserRole) {
    const device = await this.findOne(userId, id, role);

    await this.prisma.$transaction([
      this.prisma.device.delete({ where: { id } }),
      this.prisma.activityLog.create({
        data: {
          userId,
          action: 'device.delete',
          ipAddress: ipAddress || '',
          details: {
            deviceId: device.id,
            appName: device.app.name,
            macAddress: device.macAddress,
            packageType: device.packageType,
            status: device.status,
          },
        },
      }),
    ]);

    return { message: 'Device deleted successfully' };
  }

  // --- Check device status by MAC + single app ---
  async checkDeviceStatus(userId: string, macAddress: string, appId: string, role: UserRole) {
    const where: Prisma.DeviceWhereInput = { macAddress, appId };
    if (role !== UserRole.admin) {
      where.userId = userId;
    }

    const device = await this.prisma.device.findFirst({
      where,
      include: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!device) {
      throw new NotFoundException(`No device found for MAC ${macAddress} with this app`);
    }

    return device;
  }

  // --- Check device status by MAC + multiple apps ---
  async checkDeviceStatusMultiApp(userId: string, macAddress: string, appIds: string[], role: UserRole) {
    const where: Prisma.DeviceWhereInput = {
      macAddress,
      appId: { in: appIds },
    };
    if (role !== UserRole.admin) {
      where.userId = userId;
    }

    const devices = await this.prisma.device.findMany({
      where,
      include: {
        app: { select: { id: true, name: true, slug: true, iconUrl: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      macAddress,
      devices,
      checkedApps: appIds.length,
      foundApps: devices.length,
    };
  }

  // --- Multi-App Activation: activate 1 MAC across multiple apps at once ---
  async multiAppActivate(userId: string, dto: MultiAppActivateDto, ipAddress?: string) {
    // Validate: max 4 apps
    if (dto.appIds.length > 4) {
      throw new BadRequestException('Maximum 4 apps can be activated at once');
    }
    if (dto.appIds.length === 0) {
      throw new BadRequestException('At least 1 app is required');
    }

    // Fetch all apps
    const apps = await this.prisma.app.findMany({
      where: { id: { in: dto.appIds }, isActive: true },
    });

    if (apps.length !== dto.appIds.length) {
      throw new BadRequestException('One or more apps not found or inactive');
    }

    // Check for duplicates
    const existing = await this.prisma.device.findMany({
      where: { macAddress: dto.macAddress, appId: { in: dto.appIds } },
      select: { appId: true, app: { select: { name: true } } },
    });
    if (existing.length > 0) {
      const names = existing.map(e => e.app.name).join(', ');
      throw new ConflictException(`MAC ${dto.macAddress} already registered for: ${names}`);
    }

    // Calculate total credits
    let totalCreditsNeeded = 0;
    const appCosts: { app: typeof apps[0]; effectiveCost: number; marginApplied: number }[] = [];

    for (const app of apps) {
      const baseCost = dto.packageType === 'yearly' ? app.creditsYearly : app.creditsLifetime;
      const { effectiveCost, marginApplied } = await this.resellersService.calculateEffectiveCost(userId, baseCost);
      totalCreditsNeeded += effectiveCost;
      appCosts.push({ app, effectiveCost, marginApplied });
    }

    // Transaction: verify balance, create all devices, deduct credits
    return this.prisma.$transaction(
      async (tx) => {
        const [user] = await tx.$queryRawUnsafe<{ id: string; credit_balance: number }[]>(
          `SELECT id, credit_balance FROM users WHERE id = $1 FOR UPDATE`,
          userId,
        );

        if (!user) throw new NotFoundException('User not found');

        const currentBalance = Number(user.credit_balance);
        if (currentBalance < totalCreditsNeeded) {
          throw new BadRequestException(
            `Insufficient credits. Need ${totalCreditsNeeded}, have ${currentBalance}`,
          );
        }

        const createdDevices: any[] = [];

        for (const { app, effectiveCost, marginApplied } of appCosts) {
          const expiresAt = dto.packageType === 'yearly'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            : null;

          const device = await tx.device.create({
            data: {
              userId,
              appId: app.id,
              macAddress: dto.macAddress,
              packageType: dto.packageType,
              expiresAt,
              notes: dto.remarks,
            },
            include: {
              app: { select: { id: true, name: true, slug: true, iconUrl: true } },
            },
          });

          createdDevices.push(device);

          await tx.activityLog.create({
            data: {
              userId,
              action: 'device.activate',
              ipAddress: ipAddress || '',
              details: {
                deviceId: device.id,
                appName: app.name,
                macAddress: dto.macAddress,
                packageType: dto.packageType,
                creditsDeducted: effectiveCost,
                marginApplied,
                multiApp: true,
              },
            },
          });
        }

        const newBalance = currentBalance - totalCreditsNeeded;

        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: newBalance },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'activation',
            amount: new Prisma.Decimal(-totalCreditsNeeded),
            balanceAfter: newBalance,
            description: `Multi-app activation: ${apps.map(a => a.name).join(', ')} (${dto.packageType}) for ${dto.macAddress}`,
          },
        });

        return {
          devices: createdDevices,
          totalCreditsDeducted: totalCreditsNeeded,
          newBalance,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // --- Cron: Auto-expire yearly devices past their expiry date ---
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredDevices() {
    const result = await this.prisma.device.updateMany({
      where: {
        status: { in: ['active', 'trial'] },
        expiresAt: { lt: new Date() },
        NOT: { packageType: 'lifetime' },
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      this.logger.log(`Auto-expired ${result.count} device(s)`);
    }
  }

  // --- Cron: Send email warnings for devices expiring within 7 days ---
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendExpiryWarnings() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Find devices expiring in the next 7 days that are still active
    const expiringDevices = await this.prisma.device.findMany({
      where: {
        status: { in: ['active', 'trial'] },
        expiresAt: { gte: tomorrow, lte: sevenDaysFromNow },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        app: { select: { name: true } },
      },
    });

    // Group by user
    const byUser = new Map<string, typeof expiringDevices>();
    for (const device of expiringDevices) {
      const list = byUser.get(device.userId) || [];
      list.push(device);
      byUser.set(device.userId, list);
    }

    // Send one email per user
    for (const [, devices] of byUser) {
      const user = devices[0].user;
      const deviceList = devices
        .map(
          (d) =>
            `- ${d.app.name} (${d.macAddress}) — expires ${d.expiresAt?.toISOString().split('T')[0]}`,
        )
        .join('\n');

      await this.mailerService.sendMail(
        user.email,
        'Device Expiry Warning — IPTV Panel',
        `Hi ${user.name},\n\nThe following devices will expire soon:\n\n${deviceList}\n\nPlease renew them to avoid service interruption.\n\nIPTV Panel`,
      );

      this.logger.log(
        `Sent expiry warning to ${user.email} for ${devices.length} device(s)`,
      );
    }
  }

  // --- Bulk activate devices ---
  async bulkActivate(
    userId: string,
    dto: BulkActivateDto,
    ipAddress?: string,
  ) {
    const results: {
      success: number;
      failed: number;
      errors: string[];
      devices: any[];
    } = { success: 0, failed: 0, errors: [], devices: [] };

    // Pre-fetch all referenced apps
    const appIds: string[] = [...new Set(dto.devices.map((d: { appId: string }) => d.appId))];
    const apps = await this.prisma.app.findMany({
      where: { id: { in: appIds } },
    });
    const appMap = new Map(apps.map((a) => [a.id, a]));

    // Calculate total credits needed (pre-validate)
    let totalCreditsNeeded = 0;
    const validEntries: {
      entry: (typeof dto.devices)[0];
      app: (typeof apps)[0];
      creditsNeeded: number;
      marginApplied: number;
    }[] = [];

    for (let i = 0; i < dto.devices.length; i++) {
      const entry = dto.devices[i];
      const app = appMap.get(entry.appId);

      if (!app || !app.isActive) {
        results.failed++;
        results.errors.push(
          `Row ${i + 1}: App not found or inactive (${entry.appId})`,
        );
        continue;
      }

      // Check for duplicate MAC + App
      const existing = await this.prisma.device.findFirst({
        where: { macAddress: entry.macAddress, appId: entry.appId },
      });
      if (existing) {
        results.failed++;
        results.errors.push(
          `Row ${i + 1}: MAC ${entry.macAddress} already registered for ${app.name}`,
        );
        continue;
      }

      const baseCost =
        entry.packageType === 'yearly'
          ? app.creditsYearly
          : app.creditsLifetime;
      const { effectiveCost, marginApplied } =
        await this.resellersService.calculateEffectiveCost(userId, baseCost);

      totalCreditsNeeded += effectiveCost;
      validEntries.push({
        entry,
        app,
        creditsNeeded: effectiveCost,
        marginApplied,
      });
    }

    if (validEntries.length === 0) {
      return results;
    }

    // Execute all valid activations in a single transaction
    const devices = await this.prisma.$transaction(
      async (tx) => {
        // Lock user row for credit balance
        const [user] = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number }[]
        >(
          `SELECT id, credit_balance FROM users WHERE id = $1 FOR UPDATE`,
          userId,
        );

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const currentBalance = Number(user.credit_balance);
        if (currentBalance < totalCreditsNeeded) {
          throw new BadRequestException(
            `Insufficient credits. Need ${totalCreditsNeeded}, have ${currentBalance}`,
          );
        }

        const createdDevices: any[] = [];

        for (const { entry, app, creditsNeeded, marginApplied } of validEntries) {
          const expiresAt =
            entry.packageType === 'yearly'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : null;

          const device = await tx.device.create({
            data: {
              userId,
              appId: entry.appId,
              macAddress: entry.macAddress,
              packageType: entry.packageType,
              expiresAt,
              notes: entry.notes,
              playlistUrl: entry.playlistUrl,
            },
            include: {
              app: {
                select: { id: true, name: true, slug: true, iconUrl: true },
              },
            },
          });

          await tx.creditTransaction.create({
            data: {
              userId,
              type: 'activation',
              amount: new Prisma.Decimal(-creditsNeeded),
              balanceAfter: currentBalance - totalCreditsNeeded, // Final balance after all deductions
              referenceId: device.id,
              description: `Bulk: Activated ${app.name} (${entry.packageType}) for ${entry.macAddress}`,
            },
          });

          await tx.activityLog.create({
            data: {
              userId,
              action: 'device.activate',
              ipAddress: ipAddress || '',
              details: {
                deviceId: device.id,
                appName: app.name,
                macAddress: entry.macAddress,
                packageType: entry.packageType,
                baseCost:
                  entry.packageType === 'yearly'
                    ? app.creditsYearly
                    : app.creditsLifetime,
                creditsDeducted: creditsNeeded,
                marginApplied,
                bulk: true,
              },
            },
          });

          createdDevices.push(device);
        }

        // Deduct all credits at once
        const newBalance = currentBalance - totalCreditsNeeded;
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: newBalance },
        });

        return createdDevices;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    results.success = devices.length;
    results.devices = devices;

    return results;
  }
}
