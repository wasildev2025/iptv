import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRechargeRequestDto } from './dto/create-recharge-request.dto';

@Injectable()
export class RechargeRequestsService {
  private readonly logger = new Logger(RechargeRequestsService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Submit Recharge Request ────────────────────────────────────────

  async create(userId: string, dto: CreateRechargeRequestDto) {
    const { requested_amount, request_from_parent, target_email } = dto;

    if (!request_from_parent && !target_email) {
      throw new BadRequestException(
        'Either request_from_parent or target_email must be provided',
      );
    }

    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, parentId: true },
    });

    let targetId: string | null = null;

    if (request_from_parent) {
      if (!requester.parentId) {
        throw new BadRequestException('You do not have a parent reseller');
      }
      targetId = requester.parentId;
    } else if (target_email) {
      const targetUser = await this.prisma.user.findUnique({
        where: { email: target_email },
        select: { id: true },
      });
      if (!targetUser) {
        throw new NotFoundException('Target user not found');
      }
      targetId = targetUser.id;
    }

    if (targetId === userId) {
      throw new BadRequestException('You cannot request credits from yourself');
    }

    const rechargeRequest = await this.prisma.rechargeRequest.create({
      data: {
        requesterId: userId,
        targetId,
        requestFromParent: !!request_from_parent,
        amount: new Prisma.Decimal(requested_amount),
        status: 'pending',
      },
      include: {
        target: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      message: 'Recharge request submitted successfully',
      data: rechargeRequest,
    };
  }

  // ─── Get Pending Requests (for target user to approve) ─────────────

  async getPending(userId: string) {
    const requests = await this.prisma.rechargeRequest.findMany({
      where: {
        targetId: userId,
        status: 'pending',
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: requests };
  }

  // ─── Get My Sent Requests (paginated) ──────────────────────────────

  async getMy(
    userId: string,
    query: {
      page?: number;
      per_page?: number;
      start_date?: string;
      end_date?: string;
      search?: string;
    },
  ) {
    const page = query.page || 1;
    const perPage = Math.min(query.per_page || 20, 100);
    const skip = (page - 1) * perPage;

    const where: Prisma.RechargeRequestWhereInput = {
      requesterId: userId,
    };

    if (query.start_date || query.end_date) {
      where.createdAt = {};
      if (query.start_date) where.createdAt.gte = new Date(query.start_date);
      if (query.end_date) {
        const endDate = new Date(query.end_date);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    if (query.search) {
      where.target = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.rechargeRequest.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          target: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.rechargeRequest.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      per_page: perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  // ─── Approve Request (transfer credits) ────────────────────────────

  async approve(requestId: string, userId: string) {
    const request = await this.prisma.rechargeRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Recharge request not found');
    }

    if (request.targetId !== userId) {
      throw new ForbiddenException('Only the target user can approve this request');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Request has already been ${request.status}`,
      );
    }

    const amount = Number(request.amount);

    return this.prisma.$transaction(
      async (tx) => {
        // Lock both user rows in sorted order to prevent deadlocks
        const [firstId, secondId] =
          request.targetId! < request.requesterId
            ? [request.targetId!, request.requesterId]
            : [request.requesterId, request.targetId!];

        const lockedUsers = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number; name: string }[]
        >(
          `SELECT id, credit_balance, name FROM users WHERE id IN ($1, $2) FOR UPDATE`,
          firstId,
          secondId,
        );

        const target = lockedUsers.find((u) => u.id === request.targetId);
        const requester = lockedUsers.find((u) => u.id === request.requesterId);

        if (!target || !requester) {
          throw new NotFoundException('User not found');
        }

        const targetBalance = Number(target.credit_balance);
        if (targetBalance < amount) {
          throw new BadRequestException(
            `Insufficient credits. You have ${targetBalance}, need ${amount}`,
          );
        }

        const targetNewBalance = targetBalance - amount;
        const requesterNewBalance = Number(requester.credit_balance) + amount;

        // Update both balances
        await tx.user.update({
          where: { id: request.targetId! },
          data: { creditBalance: targetNewBalance },
        });

        await tx.user.update({
          where: { id: request.requesterId },
          data: { creditBalance: requesterNewBalance },
        });

        // Create paired ledger entries
        await Promise.all([
          tx.creditTransaction.create({
            data: {
              userId: request.targetId!,
              type: 'transfer_out',
              amount: new Prisma.Decimal(-amount),
              balanceAfter: targetNewBalance,
              referenceId: request.requesterId,
              description: `Approved recharge request: ${amount} credits to ${requester.name}`,
            },
          }),
          tx.creditTransaction.create({
            data: {
              userId: request.requesterId,
              type: 'transfer_in',
              amount: new Prisma.Decimal(amount),
              balanceAfter: requesterNewBalance,
              referenceId: request.targetId!,
              description: `Recharge request approved: ${amount} credits from ${target.name}`,
            },
          }),
        ]);

        // Update request status
        const updated = await tx.rechargeRequest.update({
          where: { id: requestId },
          data: {
            status: 'approved',
            approvedAt: new Date(),
          },
          include: {
            requester: { select: { id: true, name: true, email: true } },
          },
        });

        this.logger.log(
          `Recharge request ${requestId} approved: ${amount} credits from ${target.name} to ${requester.name}`,
        );

        return {
          message: 'Recharge request approved successfully',
          data: updated,
          newBalance: targetNewBalance,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Reject Request ────────────────────────────────────────────────

  async reject(requestId: string, userId: string) {
    const request = await this.prisma.rechargeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Recharge request not found');
    }

    if (request.targetId !== userId) {
      throw new ForbiddenException('Only the target user can reject this request');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Request has already been ${request.status}`,
      );
    }

    const updated = await this.prisma.rechargeRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      message: 'Recharge request rejected',
      data: updated,
    };
  }
}
