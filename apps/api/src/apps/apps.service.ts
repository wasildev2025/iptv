import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';

@Injectable()
export class AppsService {
  constructor(private prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    return this.prisma.app.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { devices: true } },
      },
    });
  }

  // Get apps allowed for a specific user (checks allowedApps array, or all active if empty)
  async findAllowedApps(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { allowedApps: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const where: any = { isActive: true };
    if (user.allowedApps.length > 0) {
      where.id = { in: user.allowedApps };
    }

    return this.prisma.app.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, iconUrl: true, creditsYearly: true, creditsLifetime: true },
    });
  }

  // APK download plans (app list with download info for the Download APK page)
  async getApkPlans() {
    const apps = await this.prisma.app.findMany({
      where: {
        isActive: true,
        NOT: { apkUrl: '' },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        iconUrl: true,
        downloaderCode: true,
        apkUrl: true,
        apkVersion: true,
        packageName: true,
      },
    });

    return apps.map((a) => ({
      id: a.id,
      appName: a.name,
      appSlug: a.slug,
      iconUrl: a.iconUrl,
      downloaderCode: a.downloaderCode,
      apkUrl: a.apkUrl,
      version: a.apkVersion || undefined,
      packageName: a.packageName || undefined,
    }));
  }

  async findOne(id: string) {
    const app = await this.prisma.app.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            devices: true,
          },
        },
      },
    });
    if (!app) throw new NotFoundException('App not found');
    return app;
  }

  async create(dto: CreateAppDto) {
    const existing = await this.prisma.app.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`App with slug "${dto.slug}" already exists`);
    }

    return this.prisma.app.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        iconUrl: dto.iconUrl || '',
        creditsYearly: dto.creditsYearly,
        creditsLifetime: dto.creditsLifetime,
        isActive: dto.isActive ?? true,
        downloaderCode: dto.downloaderCode || '',
        apkUrl: dto.apkUrl || '',
        apkVersion: dto.apkVersion || '',
        packageName: dto.packageName || '',
      },
    });
  }

  async update(id: string, dto: UpdateAppDto) {
    await this.findOne(id);

    if (dto.slug) {
      const existing = await this.prisma.app.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`App with slug "${dto.slug}" already exists`);
      }
    }

    return this.prisma.app.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const app = await this.prisma.app.findUnique({
      where: { id },
      include: { _count: { select: { devices: true } } },
    });
    if (!app) throw new NotFoundException('App not found');

    if (app._count.devices > 0) {
      throw new BadRequestException(
        `Cannot delete app with ${app._count.devices} active device(s). Disable it instead.`,
      );
    }

    await this.prisma.app.delete({ where: { id } });
    return { message: 'App deleted successfully' };
  }

  async toggleActive(id: string) {
    const app = await this.findOne(id);
    return this.prisma.app.update({
      where: { id },
      data: { isActive: !app.isActive },
    });
  }
}
