import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user — change these credentials after first login!
  const adminPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'admin123',
    12,
  );
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@iptv-panel.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@iptv-panel.com',
      passwordHash: adminPassword,
      name: 'Admin',
      role: 'admin',
      creditBalance: 0,
      emailVerified: true,
    },
  });
  console.log(`Admin user: ${admin.email}`);

  console.log('Seeding completed! Add apps, credit packages, and resellers via the admin panel.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
