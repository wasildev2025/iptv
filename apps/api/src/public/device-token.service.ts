import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const DEVICE_TOKEN_PREFIX = 'dt_';

export interface ResolvedDeviceToken {
  tokenRecordId: string;
  deviceId: string;
}

@Injectable()
export class DeviceTokenService {
  constructor(private prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Mint a new token bound to a device. Returns the raw token (to send to client). */
  async issue(deviceId: string, userAgent = ''): Promise<string> {
    const raw = DEVICE_TOKEN_PREFIX + randomBytes(32).toString('base64url');
    await this.prisma.deviceToken.create({
      data: {
        tokenHash: this.hash(raw),
        deviceId,
        userAgent: userAgent.slice(0, 255),
      },
    });
    return raw;
  }

  /**
   * Validate a token from an Authorization header. Updates lastUsedAt.
   * Throws UnauthorizedException for missing/invalid/revoked tokens.
   */
  async resolve(token: string | undefined): Promise<ResolvedDeviceToken> {
    if (!token || !token.startsWith(DEVICE_TOKEN_PREFIX)) {
      throw new UnauthorizedException('Missing or malformed device token');
    }

    const record = await this.prisma.deviceToken.findUnique({
      where: { tokenHash: this.hash(token) },
      select: { id: true, deviceId: true, revokedAt: true },
    });

    if (!record || record.revokedAt) {
      throw new UnauthorizedException('Device token is invalid or revoked');
    }

    // Fire-and-forget touch — don't block the request if this write is slow.
    void this.prisma.deviceToken
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return { tokenRecordId: record.id, deviceId: record.deviceId };
  }

  async revokeById(tokenRecordId: string): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: { id: tokenRecordId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForDevice(deviceId: string): Promise<number> {
    const res = await this.prisma.deviceToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }
}
