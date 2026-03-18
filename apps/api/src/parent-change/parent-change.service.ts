import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { CreateParentChangeDto } from './dto/create-parent-change.dto';

@Injectable()
export class ParentChangeService {
  private readonly logger = new Logger(ParentChangeService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Request Parent Change ─────────────────────────────────────────

  async create(userId: string, dto: CreateParentChangeDto) {
    const { new_parent_email } = dto;

    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, parentId: true },
    });

    if (requester.email === new_parent_email) {
      throw new BadRequestException('You cannot set yourself as your own parent');
    }

    const newParent = await this.prisma.user.findUnique({
      where: { email: new_parent_email },
      select: { id: true, email: true, role: true },
    });

    if (!newParent) {
      throw new NotFoundException('New parent user not found');
    }

    if (
      newParent.role !== UserRole.reseller &&
      newParent.role !== UserRole.admin
    ) {
      throw new BadRequestException(
        'The new parent must be a reseller or admin',
      );
    }

    if (requester.parentId === newParent.id) {
      throw new BadRequestException('This user is already your parent');
    }

    // Check for existing pending request
    const existingPending = await this.prisma.parentChangeRequest.findFirst({
      where: {
        requesterId: userId,
        status: 'pending',
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'You already have a pending parent change request. Please wait for it to be processed or cancel it first.',
      );
    }

    const request = await this.prisma.parentChangeRequest.create({
      data: {
        requesterId: userId,
        currentParentId: requester.parentId,
        newParentEmail: new_parent_email,
        status: 'pending',
      },
    });

    return {
      message: 'Parent change request submitted successfully',
      data: request,
    };
  }

  // ─── Pending Requests (where new parent = current user) ────────────

  async getPending(userId: string) {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    const requests = await this.prisma.parentChangeRequest.findMany({
      where: {
        newParentEmail: currentUser.email,
        status: 'pending',
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: requests };
  }

  // ─── History (where new parent = current user, non-pending) ────────

  async getHistory(
    userId: string,
    query: { page?: number; per_page?: number },
  ) {
    const page = query.page || 1;
    const perPage = Math.min(query.per_page || 20, 100);
    const skip = (page - 1) * perPage;

    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    const where: Prisma.ParentChangeRequestWhereInput = {
      newParentEmail: currentUser.email,
      status: { not: 'pending' },
    };

    const [data, total] = await Promise.all([
      this.prisma.parentChangeRequest.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.parentChangeRequest.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      per_page: perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  // ─── My Sent Requests ─────────────────────────────────────────────

  async getMy(userId: string) {
    const requests = await this.prisma.parentChangeRequest.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: requests };
  }

  // ─── Approve Request ──────────────────────────────────────────────

  async approve(requestId: string, userId: string) {
    const request = await this.prisma.parentChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Parent change request not found');
    }

    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    if (request.newParentEmail !== currentUser.email) {
      throw new ForbiddenException(
        'Only the target new parent can approve this request',
      );
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Request has already been ${request.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Update the user's parentId to the new parent
      await tx.user.update({
        where: { id: request.requesterId },
        data: { parentId: userId },
      });

      // Update request status
      return tx.parentChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          actionAt: new Date(),
        },
        include: {
          requester: { select: { id: true, name: true, email: true } },
        },
      });
    });

    this.logger.log(
      `Parent change request ${requestId} approved: user ${request.requester.email} now under ${currentUser.email}`,
    );

    return {
      message: 'Parent change request approved successfully',
      data: updated,
    };
  }

  // ─── Reject Request ───────────────────────────────────────────────

  async reject(requestId: string, userId: string) {
    const request = await this.prisma.parentChangeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Parent change request not found');
    }

    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    if (request.newParentEmail !== currentUser.email) {
      throw new ForbiddenException(
        'Only the target new parent can reject this request',
      );
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Request has already been ${request.status}`,
      );
    }

    const updated = await this.prisma.parentChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        actionAt: new Date(),
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      message: 'Parent change request rejected',
      data: updated,
    };
  }

  // ─── Count Pending Requests ───────────────────────────────────────

  async countPending(userId: string) {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    const count = await this.prisma.parentChangeRequest.count({
      where: {
        newParentEmail: currentUser.email,
        status: 'pending',
      },
    });

    return { count };
  }
}
