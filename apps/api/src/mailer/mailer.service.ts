import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: Transporter;
  private readonly logger = new Logger(MailerService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;

  constructor(private config: ConfigService) {
    this.fromEmail = this.config.get('SMTP_FROM_EMAIL', 'noreply@iptv-panel.com');
    this.fromName = this.config.get('SMTP_FROM_NAME', 'IPTV Panel');
    this.frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');

    const host = this.config.get('SMTP_HOST');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT', '587')),
        secure: this.config.get('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    } else {
      // Dev mode: log emails to console
      this.logger.warn(
        'SMTP_HOST not configured — emails will be logged to console',
      );
    }
  }

  private async send(to: string, subject: string, html: string) {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
    };

    if (!this.transporter) {
      this.logger.log('========== EMAIL (dev mode) ==========');
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(html.replace(/<[^>]*>/g, ''));
      this.logger.log('=======================================');
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
    }
  }

  async sendMail(to: string, subject: string, text: string) {
    const html = this.wrapTemplate(
      text
        .split('\n')
        .map((line) => `<p>${this.escapeHtml(line)}</p>`)
        .join('\n'),
    );
    await this.send(to, subject, html);
  }

  async sendEmailVerification(to: string, name: string, token: string) {
    const verifyUrl = `${this.frontendUrl}/auth/verify-email?token=${token}`;
    const html = this.wrapTemplate(`
      <h2>Verify your email address</h2>
      <p>Hi ${this.escapeHtml(name)},</p>
      <p>Thanks for signing up for IPTV Panel. Please verify your email address by clicking the button below:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${verifyUrl}" style="background-color:#2563eb;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
          Verify Email Address
        </a>
      </div>
      <p style="color:#6b7280;font-size:14px">Or copy and paste this URL into your browser:</p>
      <p style="color:#6b7280;font-size:14px;word-break:break-all">${verifyUrl}</p>
      <p style="color:#6b7280;font-size:14px">This link expires in 24 hours.</p>
    `);

    await this.send(to, 'Verify your email — IPTV Panel', html);
  }

  async sendPasswordReset(to: string, name: string, token: string) {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${token}`;
    const html = this.wrapTemplate(`
      <h2>Reset your password</h2>
      <p>Hi ${this.escapeHtml(name)},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${resetUrl}" style="background-color:#2563eb;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
          Reset Password
        </a>
      </div>
      <p style="color:#6b7280;font-size:14px">Or copy and paste this URL into your browser:</p>
      <p style="color:#6b7280;font-size:14px;word-break:break-all">${resetUrl}</p>
      <p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `);

    await this.send(to, 'Reset your password — IPTV Panel', html);
  }

  async sendPasswordChanged(to: string, name: string) {
    const html = this.wrapTemplate(`
      <h2>Password changed</h2>
      <p>Hi ${this.escapeHtml(name)},</p>
      <p>Your password was successfully changed. If you did not make this change, please contact support immediately.</p>
    `);

    await this.send(to, 'Your password was changed — IPTV Panel', html);
  }

  async sendWelcome(to: string, name: string) {
    const loginUrl = `${this.frontendUrl}/auth/login`;
    const html = this.wrapTemplate(`
      <h2>Welcome to IPTV Panel!</h2>
      <p>Hi ${this.escapeHtml(name)},</p>
      <p>Your email has been verified and your account is ready. You can now:</p>
      <ul>
        <li>Purchase credits</li>
        <li>Activate IPTV apps on devices</li>
        <li>Manage sub-resellers</li>
      </ul>
      <div style="text-align:center;margin:32px 0">
        <a href="${loginUrl}" style="background-color:#2563eb;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
          Go to Dashboard
        </a>
      </div>
    `);

    await this.send(to, 'Welcome to IPTV Panel!', html);
  }

  async sendAccountLocked(to: string, name: string, minutesLocked: number) {
    const html = this.wrapTemplate(`
      <h2>Account temporarily locked</h2>
      <p>Hi ${this.escapeHtml(name)},</p>
      <p>Your account has been temporarily locked due to multiple failed login attempts. It will be unlocked in <strong>${minutesLocked} minutes</strong>.</p>
      <p>If this wasn't you, we recommend resetting your password immediately.</p>
    `);

    await this.send(to, 'Account locked — IPTV Panel', html);
  }

  private wrapTemplate(body: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px">
        <div style="background-color:#ffffff;border-radius:8px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#2563eb;font-size:24px;margin:0">IPTV Panel</h1>
          </div>
          ${body}
        </div>
        <div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px">
          <p>&copy; ${new Date().getFullYear()} IPTV Panel. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
