import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class CreditPasscodeService {
  constructor(private prisma: PrismaService) {}

  // ─── Set Passcode (First Time) ──────────────────────────────────

  async set(userId: string, passcode: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditPasscode: true },
    });

    if (user.creditPasscode) {
      throw new ConflictException(
        'Credit passcode is already set. Use /update to change it.',
      );
    }

    const hashed = await bcrypt.hash(passcode, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { creditPasscode: hashed },
    });

    return { message: 'Credit passcode set successfully' };
  }

  // ─── Update Passcode ───────────────────────────────────────────

  async update(userId: string, oldPasscode: string, newPasscode: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditPasscode: true },
    });

    if (!user.creditPasscode) {
      throw new NotFoundException(
        'No credit passcode is set. Use /set to create one first.',
      );
    }

    const isValid = await bcrypt.compare(oldPasscode, user.creditPasscode);
    if (!isValid) {
      throw new BadRequestException('Current passcode is incorrect');
    }

    const hashed = await bcrypt.hash(newPasscode, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { creditPasscode: hashed },
    });

    return { message: 'Credit passcode updated successfully' };
  }

  // ─── Validate Passcode ─────────────────────────────────────────

  async validate(userId: string, passcode: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditPasscode: true },
    });

    if (!user.creditPasscode) {
      throw new NotFoundException('No credit passcode is set');
    }

    const isValid = await bcrypt.compare(passcode, user.creditPasscode);

    return { valid: isValid };
  }
}
