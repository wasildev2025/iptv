import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PackageType } from '@prisma/client';
import { CreateCodeDto } from './dto/create-code.dto';
import { ActivateCodeDto } from './dto/activate-code.dto';

@Injectable()
export class ActivationCodesService {
  private readonly logger = new Logger(ActivationCodesService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Generate Activation Codes ──────────────────────────────────

  async generate(userId: string, dto: CreateCodeDto) {
    const { subscriptionType, codeCount } = dto;

    const creditCost = subscriptionType === 'yearly' ? 1 : 2;
    const totalCost = codeCount * creditCost;

    return this.prisma.$transaction(
      async (tx) => {
        // Lock user row to prevent race conditions on credit balance
        const [user] = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number }[]
        >(
          `SELECT id, credit_balance FROM users WHERE id = $1 FOR UPDATE`,
          userId,
        );

        if (!user) throw new NotFoundException('User not found');

        const currentBalance = Number(user.credit_balance);
        if (currentBalance < totalCost) {
          throw new BadRequestException(
            `Insufficient credits. Need ${totalCost}, have ${currentBalance}`,
          );
        }

        // Generate unique codes
        const codes: string[] = [];
        for (let i = 0; i < codeCount; i++) {
          let code: string;
          let isUnique = false;

          while (!isUnique) {
            code = this.generateRandomCode(8);
            const existing = await tx.activationCode.findUnique({
              where: { code },
            });
            if (!existing) isUnique = true;
          }

          codes.push(code!);
        }

        // Create activation code records
        await tx.activationCode.createMany({
          data: codes.map((code) => ({
            userId,
            code,
            subscriptionType,
            status: 'available' as const,
          })),
        });

        // Deduct credits
        const newBalance = currentBalance - totalCost;
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: newBalance },
        });

        // Create credit transaction record
        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'activation',
            amount: new Prisma.Decimal(-totalCost),
            balanceAfter: newBalance,
            description: `Generated ${codeCount} ${subscriptionType} activation code(s)`,
          },
        });

        this.logger.log(
          `User ${userId} generated ${codeCount} ${subscriptionType} activation codes`,
        );

        return {
          message: 'Activation codes generated successfully',
          codes,
          totalCost,
          newBalance,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Activate a Code on Device ──────────────────────────────────

  async activate(userId: string, dto: ActivateCodeDto) {
    const { subscriptionType, macAddress } = dto;

    return this.prisma.$transaction(
      async (tx) => {
        // Find an available code for this user with matching subscription type
        const code = await tx.activationCode.findFirst({
          where: {
            userId,
            subscriptionType,
            status: 'available',
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!code) {
          throw new NotFoundException(
            `No available ${subscriptionType} activation codes found`,
          );
        }

        // Check if device already exists for this MAC
        const existingDevice = await tx.device.findFirst({
          where: { macAddress, userId },
        });

        if (!existingDevice) {
          // Calculate expiration for yearly
          const expiresAt =
            subscriptionType === 'yearly'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : null;

          // Get the first active app for linking the device
          const firstApp = await tx.app.findFirst({ where: { isActive: true } });
          if (!firstApp) {
            throw new BadRequestException('No active app found to link device');
          }

          await tx.device.create({
            data: {
              userId,
              appId: firstApp.id,
              macAddress,
              packageType: subscriptionType,
              status: 'active',
              expiresAt,
            },
          });
        }

        // Update activation code status
        const updatedCode = await tx.activationCode.update({
          where: { id: code.id },
          data: {
            status: 'used',
            linkedMac: macAddress,
            linkedAt: new Date(),
          },
        });

        this.logger.log(
          `User ${userId} activated code ${code.code} on MAC ${macAddress}`,
        );

        return {
          message: 'Code activated successfully',
          code: updatedCode.code,
          macAddress,
          subscriptionType,
          linkedAt: updatedCode.linkedAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── List User's Codes ──────────────────────────────────────────

  async findAll(
    userId: string,
    query: {
      page?: number;
      per_page?: number;
      search_query?: string;
      sort_key?: string;
      sort_type?: string;
      date_from?: string;
      date_to?: string;
    },
  ) {
    const page = query.page || 1;
    const perPage = Math.min(query.per_page || 20, 100);
    const skip = (page - 1) * perPage;

    const where: Prisma.ActivationCodeWhereInput = { userId };

    // Search by code or MAC address
    if (query.search_query) {
      where.OR = [
        { code: { contains: query.search_query, mode: 'insensitive' } },
        { linkedMac: { contains: query.search_query, mode: 'insensitive' } },
      ];
    }

    // Date range filter
    if (query.date_from || query.date_to) {
      where.createdAt = {};
      if (query.date_from) where.createdAt.gte = new Date(query.date_from);
      if (query.date_to) {
        const endDate = new Date(query.date_to);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Sorting
    const sortKey = query.sort_key || 'createdAt';
    const sortType = query.sort_type?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    const allowedSortKeys = [
      'createdAt',
      'code',
      'status',
      'subscriptionType',
      'linkedAt',
    ];
    const orderBy: any = {};
    if (allowedSortKeys.includes(sortKey)) {
      orderBy[sortKey] = sortType;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await Promise.all([
      this.prisma.activationCode.findMany({
        where,
        skip,
        take: perPage,
        orderBy,
      }),
      this.prisma.activationCode.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      per_page: perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
