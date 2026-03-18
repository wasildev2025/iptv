import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, CreditTransactionType } from '@prisma/client';
import { TransferCreditsDto } from './dto/transfer-credits.dto';
import { AdminAdjustCreditsDto } from './dto/admin-adjust-credits.dto';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Read Operations ──────────────────────────────────────────────

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true, name: true },
    });
    return { balance: Number(user.creditBalance), name: user.name };
  }

  async getPackages() {
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { credits: 'asc' },
    });
  }

  async getHistory(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      type?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.CreditTransactionWhereInput = { userId };

    // Filter by transaction type
    if (query.type) {
      if (
        !Object.values(CreditTransactionType).includes(
          query.type as CreditTransactionType,
        )
      ) {
        throw new BadRequestException(`Invalid transaction type: ${query.type}`);
      }
      where.type = query.type as CreditTransactionType;
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const endDate = new Date(query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [data, total, summary] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creditTransaction.count({ where }),
      // Aggregate totals for the filtered set
      this.prisma.creditTransaction.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        netAmount: Number(summary._sum.amount || 0),
        transactionCount: summary._count,
      },
    };
  }

  // ─── Transfer (Reseller → Sub-Reseller) ───────────────────────────

  async transfer(fromUserId: string, dto: TransferCreditsDto, ipAddress?: string) {
    const { toUserId, amount } = dto;

    // Self-transfer guard
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot transfer credits to yourself');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Lock BOTH user rows to prevent race conditions
        // Always lock in consistent order (sorted by ID) to prevent deadlocks
        const [firstId, secondId] =
          fromUserId < toUserId
            ? [fromUserId, toUserId]
            : [toUserId, fromUserId];

        const lockedUsers = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number; parent_id: string | null; name: string; is_active: boolean }[]
        >(
          `SELECT id, credit_balance, parent_id, name, is_active FROM users WHERE id IN ($1, $2) FOR UPDATE`,
          firstId,
          secondId,
        );

        const sender = lockedUsers.find((u) => u.id === fromUserId);
        const recipient = lockedUsers.find((u) => u.id === toUserId);

        if (!sender) throw new NotFoundException('Sender not found');
        if (!recipient) throw new NotFoundException('Recipient not found');

        // Verify recipient is a direct sub-reseller of sender
        if (recipient.parent_id !== fromUserId) {
          throw new BadRequestException('Recipient is not your sub-reseller');
        }

        // Verify recipient account is active
        if (!recipient.is_active) {
          throw new BadRequestException('Recipient account is disabled');
        }

        const senderBalance = Number(sender.credit_balance);
        if (senderBalance < amount) {
          throw new BadRequestException(
            `Insufficient credits. Have ${senderBalance}, need ${amount}`,
          );
        }

        const senderNewBalance = senderBalance - amount;
        const recipientNewBalance = Number(recipient.credit_balance) + amount;

        // Update both balances
        await tx.user.update({
          where: { id: fromUserId },
          data: { creditBalance: senderNewBalance },
        });

        await tx.user.update({
          where: { id: toUserId },
          data: { creditBalance: recipientNewBalance },
        });

        // Create paired ledger entries (double-entry bookkeeping)
        const [senderTx, recipientTx] = await Promise.all([
          tx.creditTransaction.create({
            data: {
              userId: fromUserId,
              type: 'transfer_out',
              amount: new Prisma.Decimal(-amount),
              balanceAfter: senderNewBalance,
              referenceId: toUserId,
              description: `Transferred ${amount} credits to ${recipient.name}`,
            },
          }),
          tx.creditTransaction.create({
            data: {
              userId: toUserId,
              type: 'transfer_in',
              amount: new Prisma.Decimal(amount),
              balanceAfter: recipientNewBalance,
              referenceId: fromUserId,
              description: `Received ${amount} credits from ${sender.name}`,
            },
          }),
        ]);

        // Activity log for sender
        await tx.activityLog.create({
          data: {
            userId: fromUserId,
            action: 'credits.transfer',
            ipAddress: ipAddress || '',
            details: {
              toUserId,
              toUserName: recipient.name,
              amount,
              senderNewBalance,
              recipientNewBalance,
              senderTxId: senderTx.id,
              recipientTxId: recipientTx.id,
            },
          },
        });

        return {
          message: 'Transfer successful',
          amount,
          newBalance: senderNewBalance,
          recipient: { id: toUserId, name: recipient.name },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Admin: Adjust Credits ─────────────────────────────────────────

  async adminAdjust(
    adminUserId: string,
    dto: AdminAdjustCreditsDto,
    ipAddress?: string,
  ) {
    const { userId, amount, reason } = dto;

    if (amount === 0) {
      throw new BadRequestException('Amount cannot be zero');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Lock the target user row
        const [user] = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number; name: string }[]
        >(
          `SELECT id, credit_balance, name FROM users WHERE id = $1 FOR UPDATE`,
          userId,
        );

        if (!user) throw new NotFoundException('User not found');

        const currentBalance = Number(user.credit_balance);
        const newBalance = currentBalance + amount;

        // Prevent negative balance on deduction
        if (newBalance < 0) {
          throw new BadRequestException(
            `Cannot deduct ${Math.abs(amount)} credits. User only has ${currentBalance}`,
          );
        }

        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: newBalance },
        });

        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            type: 'admin_adjustment',
            amount: new Prisma.Decimal(amount),
            balanceAfter: newBalance,
            referenceId: adminUserId,
            description: `Admin adjustment: ${reason}`,
          },
        });

        await tx.activityLog.create({
          data: {
            userId: adminUserId,
            action: 'credits.admin_adjust',
            ipAddress: ipAddress || '',
            details: {
              targetUserId: userId,
              targetUserName: user.name,
              amount,
              previousBalance: currentBalance,
              newBalance,
              reason,
              transactionId: transaction.id,
            },
          },
        });

        this.logger.log(
          `Admin ${adminUserId} adjusted ${user.name}'s credits by ${amount} (${reason})`,
        );

        return {
          message: 'Credits adjusted successfully',
          userId,
          userName: user.name,
          previousBalance: currentBalance,
          adjustment: amount,
          newBalance,
          transactionId: transaction.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Admin: View any user's history ────────────────────────────────

  async adminGetUserHistory(
    targetUserId: string,
    query: { page?: number; limit?: number; type?: string },
  ) {
    // Verify user exists
    await this.prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: { id: true },
    });

    return this.getHistory(targetUserId, query);
  }

  // ─── Admin: View any user's balance ────────────────────────────────

  async adminGetUserBalance(targetUserId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        creditBalance: true,
        role: true,
      },
    });

    // Get summary stats
    const [totalIn, totalOut] = await Promise.all([
      this.prisma.creditTransaction.aggregate({
        where: { userId: targetUserId, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      this.prisma.creditTransaction.aggregate({
        where: { userId: targetUserId, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
    ]);

    return {
      ...user,
      creditBalance: Number(user.creditBalance),
      totalCreditsIn: Number(totalIn._sum.amount || 0),
      totalCreditsOut: Math.abs(Number(totalOut._sum.amount || 0)),
    };
  }

  // ─── Ledger Reconciliation (admin diagnostic) ─────────────────────

  async reconcile(userId: string) {
    const [user, lastTransaction] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { creditBalance: true, name: true },
      }),
      this.prisma.creditTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true, createdAt: true },
      }),
    ]);

    const storedBalance = Number(user.creditBalance);
    const ledgerBalance = lastTransaction
      ? Number(lastTransaction.balanceAfter)
      : 0;
    const isConsistent = storedBalance === ledgerBalance || !lastTransaction;

    // Also compute from scratch: sum all transactions
    const computed = await this.prisma.creditTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const computedBalance = Number(computed._sum.amount || 0);

    return {
      userId,
      userName: user.name,
      storedBalance,
      lastLedgerBalance: ledgerBalance,
      computedFromTransactions: computedBalance,
      isConsistent: isConsistent && Math.abs(storedBalance - computedBalance) < 0.01,
      lastTransactionAt: lastTransaction?.createdAt || null,
    };
  }
}
