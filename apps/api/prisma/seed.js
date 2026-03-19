"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@iptv-panel.com' },
        update: {},
        create: {
            email: 'admin@iptv-panel.com',
            passwordHash: adminPassword,
            name: 'Admin',
            role: 'admin',
            creditBalance: 10000,
            emailVerified: true,
        },
    });
    console.log(`Admin user: ${admin.email}`);
    const resellerPassword = await bcrypt.hash('reseller123', 12);
    const reseller = await prisma.user.upsert({
        where: { email: 'demo@reseller.com' },
        update: {},
        create: {
            email: 'demo@reseller.com',
            passwordHash: resellerPassword,
            name: 'Demo Reseller',
            role: 'reseller',
            creditBalance: 100,
            emailVerified: true,
        },
    });
    console.log(`Demo reseller: ${reseller.email}`);
    const apps = [
        { name: 'IBO Player', slug: 'ibo-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'IBO Player Pro', slug: 'ibo-player-pro', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'BOB Player', slug: 'bob-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'BOB Premium', slug: 'bob-premium', creditsYearly: 1, creditsLifetime: 3 },
        { name: 'Virginia Player', slug: 'virginia-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'ABE Player', slug: 'abe-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'IBO Player Gold', slug: 'ibo-player-gold', creditsYearly: 1, creditsLifetime: 3 },
        { name: 'IBO TV Pro', slug: 'ibo-tv-pro', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'FlixNet TV Player', slug: 'flixnet-tv', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'Duplex TV Player', slug: 'duplex-tv', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'IBO STB', slug: 'ibo-stb', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'IBOSOL Player', slug: 'ibosol-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'IBOXX Player', slug: 'iboxx-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'IBOSS IPTV', slug: 'iboss-iptv', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'MAC Media Player', slug: 'mac-media-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'KTN Player', slug: 'ktn-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'King 4K Player', slug: 'king-4k', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'Hush Play', slug: 'hush-play', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'Family 4K Player', slug: 'family-4k', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'CR7 Player', slug: 'cr7-player', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'Smart One Pro', slug: 'smart-one-pro', creditsYearly: 1, creditsLifetime: 2 },
        { name: 'All Player', slug: 'all-player', creditsYearly: 1, creditsLifetime: 2 },
    ];
    for (const app of apps) {
        await prisma.app.upsert({
            where: { slug: app.slug },
            update: {},
            create: app,
        });
    }
    console.log(`Seeded ${apps.length} apps`);
    const packages = [
        { credits: 10, bonusCredits: 0, priceUsd: 15.00, priceBrl: 75.00 },
        { credits: 20, bonusCredits: 1, priceUsd: 28.00, priceBrl: 140.00 },
        { credits: 50, bonusCredits: 3, priceUsd: 57.00, priceBrl: 285.00 },
        { credits: 100, bonusCredits: 8, priceUsd: 107.50, priceBrl: 537.50 },
        { credits: 200, bonusCredits: 20, priceUsd: 209.00, priceBrl: 1045.00 },
        { credits: 500, bonusCredits: 60, priceUsd: 475.00, priceBrl: 2375.00 },
        { credits: 1000, bonusCredits: 150, priceUsd: 790.00, priceBrl: 3950.00 },
    ];
    for (const pkg of packages) {
        const existing = await prisma.creditPackage.findFirst({
            where: { credits: pkg.credits },
        });
        if (!existing) {
            await prisma.creditPackage.create({ data: pkg });
        }
    }
    console.log(`Seeded ${packages.length} credit packages`);
    await prisma.announcement.upsert({
        where: { id: 'welcome-announcement' },
        update: {},
        create: {
            id: 'welcome-announcement',
            title: 'Welcome to IPTV Panel',
            body: 'Your reseller panel is ready. Start activating devices by purchasing credits and adding devices.',
        },
    });
    console.log('Seeding completed!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map