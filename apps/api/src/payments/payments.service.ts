import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(private prisma: PrismaService) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — payments disabled');
    }
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Payment processing is not configured');
    }
    return this.stripe;
  }

  async createCheckoutSession(userId: string, packageId: string) {
    const stripe = this.ensureStripe();

    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('Credit package not found or inactive');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const totalCredits = pkg.credits + pkg.bonusCredits;
    const bonusLabel = pkg.bonusCredits > 0 ? ` (+${pkg.bonusCredits} bonus)` : '';

    // Create payment record first
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        packageId,
        amountUsd: pkg.priceUsd,
        paymentMethod: 'stripe',
        status: 'pending',
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${totalCredits} Credits${bonusLabel}`,
              description: `IPTV Panel Credit Package`,
            },
            unit_amount: Math.round(Number(pkg.priceUsd) * 100), // cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentId: payment.id,
        userId,
        packageId,
        credits: String(pkg.credits),
        bonusCredits: String(pkg.bonusCredits),
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard/credits?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/credits?payment=cancelled`,
    });

    // Store stripe session ID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    return { url: session.url, sessionId: session.id, paymentId: payment.id };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const stripe = this.ensureStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.fulfillPayment(session);
    }

    return { received: true };
  }

  private async fulfillPayment(session: Stripe.Checkout.Session) {
    const { paymentId, userId, credits, bonusCredits } = session.metadata || {};

    if (!paymentId || !userId) {
      this.logger.error('Missing metadata in Stripe session');
      return;
    }

    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === 'completed') {
      this.logger.warn(`Payment ${paymentId} already fulfilled or not found`);
      return;
    }

    const totalCredits = Number(credits || 0) + Number(bonusCredits || 0);

    await this.prisma.$transaction(
      async (tx) => {
        // Lock user row
        const [user] = await tx.$queryRawUnsafe<
          { id: string; credit_balance: number }[]
        >(
          `SELECT id, credit_balance FROM users WHERE id = $1 FOR UPDATE`,
          userId,
        );

        if (!user) {
          this.logger.error(`User ${userId} not found during fulfillment`);
          return;
        }

        const newBalance = Number(user.credit_balance) + totalCredits;

        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: newBalance },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'purchase',
            amount: new Prisma.Decimal(totalCredits),
            balanceAfter: newBalance,
            referenceId: paymentId,
            description: `Purchased ${credits} credits${Number(bonusCredits) > 0 ? ` + ${bonusCredits} bonus` : ''} via Stripe`,
          },
        });

        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'completed',
            paymentRef: session.payment_intent as string || session.id,
          },
        });

        await tx.activityLog.create({
          data: {
            userId,
            action: 'credits.purchase',
            ipAddress: '',
            details: {
              paymentId,
              totalCredits,
              baseCredits: Number(credits),
              bonusCredits: Number(bonusCredits),
              amountUsd: session.amount_total ? session.amount_total / 100 : 0,
              stripeSessionId: session.id,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(`Fulfilled payment ${paymentId}: ${totalCredits} credits for user ${userId}`);
  }

  async getPaymentHistory(
    userId: string,
    query: { page?: number; limit?: number },
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { package: true },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
