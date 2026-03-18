import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const EMAIL_VERIFY_EXPIRES_HOURS = 24;
const RESET_TOKEN_EXPIRES_HOURS = 1;

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  creditBalance: any;
  language: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailer: MailerService,
  ) {}

  // ─── REGISTER ───────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const emailVerifyToken = this.generateSecureToken();
    const emailVerifyExpires = new Date(
      Date.now() + EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000,
    );

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        emailVerifyToken,
        emailVerifyExpires,
      },
    });

    // Send verification email (non-blocking)
    this.mailer
      .sendEmailVerification(user.email, user.name, emailVerifyToken)
      .catch((err) => this.logger.error('Failed to send verification email', err));

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  // ─── LOGIN ──────────────────────────────────────────────

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Log failed attempt (unknown user) — but don't reveal that
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account locked. Try again in ${minutesLeft} minutes`,
      );
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.loginAttempts, user.email, user.name);
      await this.logLogin(user.id, ip, userAgent, false);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account status
    if (!user.isActive) {
      await this.logLogin(user.id, ip, userAgent, false);
      throw new ForbiddenException('Account is disabled. Contact support.');
    }

    // Reset login attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.logLogin(user.id, ip, userAgent, true);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  // ─── VERIFY EMAIL ───────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    // Send welcome email (non-blocking)
    this.mailer
      .sendWelcome(user.email, user.name)
      .catch((err) => this.logger.error('Failed to send welcome email', err));

    return { message: 'Email verified successfully' };
  }

  // ─── RESEND VERIFICATION ────────────────────────────────

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent enumeration
    if (!user || user.emailVerified) {
      return { message: 'If the email exists and is unverified, a new link has been sent' };
    }

    const emailVerifyToken = this.generateSecureToken();
    const emailVerifyExpires = new Date(
      Date.now() + EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken, emailVerifyExpires },
    });

    this.mailer
      .sendEmailVerification(user.email, user.name, emailVerifyToken)
      .catch((err) => this.logger.error('Failed to resend verification', err));

    return { message: 'If the email exists and is unverified, a new link has been sent' };
  }

  // ─── FORGOT PASSWORD ───────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent enumeration
    const response = { message: 'If the email exists, a reset link has been sent' };

    if (!user) return response;

    const resetPasswordToken = this.generateSecureToken();
    const resetPasswordExpires = new Date(
      Date.now() + RESET_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken, resetPasswordExpires },
    });

    this.mailer
      .sendPasswordReset(user.email, user.name, resetPasswordToken)
      .catch((err) => this.logger.error('Failed to send reset email', err));

    return response;
  }

  // ─── RESET PASSWORD ────────────────────────────────────

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null, // Invalidate all sessions
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Notify user (non-blocking)
    this.mailer
      .sendPasswordChanged(user.email, user.name)
      .catch((err) => this.logger.error('Failed to send password changed email', err));

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ─── CHANGE PASSWORD (authenticated) ───────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        refreshToken: null, // Invalidate other sessions
      },
    });

    this.mailer
      .sendPasswordChanged(user.email, user.name)
      .catch((err) => this.logger.error('Failed to send password changed email', err));

    // Generate fresh tokens so the current session stays alive
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Password changed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ─── LOGOUT ─────────────────────────────────────────────

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  // ─── REFRESH TOKENS ─────────────────────────────────────

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const isRefreshValid = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!isRefreshValid) {
      // Potential token reuse attack — invalidate all tokens
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
      throw new UnauthorizedException('Access denied — please log in again');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // ─── GET PROFILE ────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        creditBalance: true,
        language: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  // ─── UPDATE PROFILE ───────────────────────────────────

  async updateProfile(userId: string, dto: { name?: string; language?: string }) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.language !== undefined) data.language = dto.language;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        creditBalance: true,
        language: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET', 'super-secret-key'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>(
          'JWT_REFRESH_SECRET',
          'super-refresh-secret',
        ),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed },
    });
  }

  private async handleFailedLogin(
    userId: string,
    currentAttempts: number,
    email: string,
    name: string,
  ) {
    const attempts = currentAttempts + 1;
    const updateData: any = { loginAttempts: attempts };

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
      );
      // Send lock notification (non-blocking)
      this.mailer
        .sendAccountLocked(email, name, LOCK_DURATION_MINUTES)
        .catch((err) => this.logger.error('Failed to send lock email', err));
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  private async logLogin(
    userId: string,
    ip: string,
    userAgent: string,
    success: boolean,
  ) {
    await this.prisma.loginLog.create({
      data: { userId, ipAddress: ip, userAgent, success },
    });
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private sanitizeUser(user: any): UserPayload {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      creditBalance: user.creditBalance,
      language: user.language,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}
