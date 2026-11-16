import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `c${timestamp}${randomPart}`.substring(0, 25);
}

async function main() {
  console.log('🌱 Starting ChargeShare database seed...');

  // 1. AppConfig: Platform Parameters
  const defaultConfigs = [
    { key: 'commissionPercent', value: '15' },
    { key: 'bookingExpiryMinutes', value: '30' },
    { key: 'autoConfirmHours', value: '24' },
    { key: 'maxSessionKwh', value: '150' },
    { key: 'minTopupPaisa', value: '50000' }, // Rs 500
    { key: 'maxTopupPaisa', value: '5000000' }, // Rs 50,000
  ];

  for (const config of defaultConfigs) {
    await prisma.appConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: { key: config.key, value: config.value },
    });
  }
  console.log('✅ Configured platform AppConfig defaults');

  // 2. Admin User
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@chargeshare.pk').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminPass123!';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: adminEmail,
      name: 'System Administrator',
      passwordHash: adminPasswordHash,
      phone: '+923000000000',
      role: 'ADMIN',
      hostStatus: 'NONE',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Seeded Admin User: ${admin.email}`);

  // 3. Approved Hosts
  const hostPasswordHash = await bcrypt.hash('HostPass123!', 10);

  const hostsData = [
    { email: 'host1@example.com', name: 'Tariq Mehmood', phone: '+923001111111', preferredMode: 'HOST' as const },
    { email: 'host2@example.com', name: 'Bilal Khan', phone: '+923002222222', preferredMode: 'HOST' as const },
    { email: 'host3@example.com', name: 'Zainab Qureshi', phone: '+923003333333', preferredMode: null },
  ];

  const hosts: Array<{ id: string; email: string; name: string }> = [];

  for (const h of hostsData) {
    const hostUser = await prisma.user.upsert({
      where: { email: h.email },
      update: {
        name: h.name,
        phone: h.phone,
        passwordHash: hostPasswordHash,
        hostStatus: 'APPROVED',
        preferredMode: h.preferredMode,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: h.email,
        name: h.name,
        phone: h.phone,
        passwordHash: hostPasswordHash,
        role: 'USER',
        hostStatus: 'APPROVED',
        preferredMode: h.preferredMode,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    hosts.push(hostUser);

    // Initial Wallet Topup & Ledger Transaction (Rs 5,000 = 500,000 paisa)
    const existingTx = await prisma.walletTransaction.findFirst({
      where: { hostId: hostUser.id },
    });

    if (!existingTx) {
      const topup = await prisma.walletTopup.create({
        data: {
          hostId: hostUser.id,
          amountPaisa: 500000,
          screenshotKey: `TOPUP_SCREENSHOT/${hostUser.id}/seed_initial.png`,
          reference: 'EP-INIT-SEED-' + hostUser.id.slice(-4),
          status: 'APPROVED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      await prisma.walletTransaction.create({
        data: {
          hostId: hostUser.id,
          topupId: topup.id,
          type: 'TOPUP',
          amountPaisa: 500000,
          note: 'Initial verified pilot seed top-up (Rs 5,000)',
        },
      });
    }

    console.log(`✅ Seeded Approved Host: ${hostUser.name} (${hostUser.email})`);
  }

  // 4. Upsert / Seed 5 Chargers in Islamabad
  const chargers = [
    {
      hostId: hosts[0].id,
      title: 'F-10 Solar High-Speed Charger',
      powerKw: 22.0,
      connectorType: 'TYPE2',
      pricePerKwhPaisa: 6500,
      areaLabel: 'F-10',
      addressLine: 'House 142, Street 18, Sector F-10/3, Islamabad',
      notes: 'Covered garage parking. Pure solar backup available during load shedding.',
      meterInstalled: true,
      isOnline: true,
      approvalStatus: 'APPROVED',
      lat: 33.6938,
      lng: 73.0116,
    },
    {
      hostId: hosts[0].id,
      title: 'G-11 Fast EV Point',
      powerKw: 11.0,
      connectorType: 'TYPE2',
      pricePerKwhPaisa: 6000,
      areaLabel: 'G-11',
      addressLine: 'House 89, Street 4, Sector G-11/2, Islamabad',
      notes: 'Easy driveway access. 16A certified plug-in meter installed.',
      meterInstalled: true,
      isOnline: true,
      approvalStatus: 'APPROVED',
      lat: 33.6732,
      lng: 72.9984,
    },
    {
      hostId: hosts[1].id,
      title: 'I-8 Commercial Grid Backup Charger',
      powerKw: 7.4,
      connectorType: 'CCS2',
      pricePerKwhPaisa: 7200,
      areaLabel: 'I-8',
      addressLine: 'House 312, Street 35, Sector I-8/4, Islamabad',
      notes: 'Near I-8 Markaz. Fast CCS2 cable on-site.',
      meterInstalled: true,
      isOnline: true,
      approvalStatus: 'APPROVED',
      lat: 33.6685,
      lng: 73.0754,
    },
    {
      hostId: hosts[2].id,
      title: 'E-11 MPCHS Residential Charger',
      powerKw: 22.0,
      connectorType: 'GBT',
      pricePerKwhPaisa: 5800,
      areaLabel: 'E-11',
      addressLine: 'Villa 22, Hill View Enclave, Sector E-11/3, Islamabad',
      notes: 'Suitable for Chinese EV imports (BYD, Deepal).',
      meterInstalled: true,
      isOnline: true,
      approvalStatus: 'APPROVED',
      lat: 33.7087,
      lng: 72.986,
    },
    {
      hostId: hosts[2].id,
      title: 'DHA-2 Sector B EV Haven',
      powerKw: 11.0,
      connectorType: 'SOCKET_3PIN',
      pricePerKwhPaisa: 5000,
      areaLabel: 'DHA',
      addressLine: 'Plot 45, Sector B, DHA Phase 2, Islamabad',
      notes: 'Safe gated community. 3-pin heavy duty socket.',
      meterInstalled: true,
      isOnline: true,
      approvalStatus: 'APPROVED',
      lat: 33.5273,
      lng: 73.1558,
    },
  ];

  const seededChargers: Array<{ id: string; hostId: string; title: string }> = [];

  for (const c of chargers) {
    let existing = await prisma.charger.findFirst({
      where: { hostId: c.hostId, title: c.title },
    });
    // Generate 150-300m random offset
    const distMeters = 150 + Math.random() * 150;
    const bearing = Math.random() * 2 * Math.PI;
    const deltaLat = (distMeters * Math.cos(bearing)) / 111320;
    const deltaLng = (distMeters * Math.sin(bearing)) / (111320 * Math.cos((c.lat * Math.PI) / 180));
    const publicLat = Number((c.lat + deltaLat).toFixed(6));
    const publicLng = Number((c.lng + deltaLng).toFixed(6));

    if (!existing) {
      const chargerId = generateCuid();
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Charger" (
          "id", "hostId", "title", "powerKw", "connectorType", "pricePerKwhPaisa",
          "areaLabel", "addressLine", "notes", "meterInstalled", "isOnline",
          "approvalStatus", "location", "publicLat", "publicLng", "createdAt", "updatedAt"
        ) VALUES (
          ${chargerId},
          ${c.hostId},
          ${c.title},
          ${c.powerKw},
          ${c.connectorType}::"ConnectorType",
          ${c.pricePerKwhPaisa},
          ${c.areaLabel},
          ${c.addressLine},
          ${c.notes},
          ${c.meterInstalled},
          ${c.isOnline},
          ${c.approvalStatus}::"ApprovalStatus",
          ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}), 4326)::geography,
          ${publicLat},
          ${publicLng},
          NOW(),
          NOW()
        );
      `);
      existing = { id: chargerId, hostId: c.hostId, title: c.title } as any;
      console.log(`⚡ Seeded Charger: ${c.title} (${c.areaLabel})`);
    } else {
      // Backfill publicLat/publicLng if missing
      await prisma.charger.update({
        where: { id: existing.id },
        data: {
          publicLat: existing.publicLat ?? publicLat,
          publicLng: existing.publicLng ?? publicLng,
        },
      });
    }
    seededChargers.push({ id: existing!.id, hostId: c.hostId, title: c.title });
  }

  // 5. Seed Test Drivers
  const driverPasswordHash = await bcrypt.hash('DriverPass123!', 10);
  const driver1 = await prisma.user.upsert({
    where: { email: 'driver1@example.com' },
    update: {
      isActive: true,
      emailVerifiedAt: new Date(),
      phone: '+923451234567',
      hostStatus: 'NONE',
      preferredMode: 'DRIVER',
    },
    create: {
      email: 'driver1@example.com',
      name: 'Hamza Abbasi',
      passwordHash: driverPasswordHash,
      phone: '+923451234567',
      role: 'USER',
      hostStatus: 'NONE',
      preferredMode: 'DRIVER',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const driver2 = await prisma.user.upsert({
    where: { email: 'driver2@example.com' },
    update: {
      isActive: true,
      emailVerifiedAt: new Date(),
      phone: '+923457654321',
      hostStatus: 'NONE',
      preferredMode: null,
    },
    create: {
      email: 'driver2@example.com',
      name: 'Ahmed Malik',
      passwordHash: driverPasswordHash,
      phone: '+923459876543',
      role: 'USER',
      hostStatus: 'NONE',
      preferredMode: null,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  // 6. Seed Multi-State Bookings for Demo & Verification (Idempotent)
  const f10Charger = seededChargers[0];
  const g11Charger = seededChargers[1];
  const i8Charger = seededChargers[2];

  // Booking 1: CONFIRMED with Session, Commission & Reviews
  const existingB1 = await prisma.booking.findFirst({
    where: { driverId: driver1.id, chargerId: f10Charger.id, status: 'CONFIRMED' },
  });

  if (!existingB1) {
    const bookingConfirmed = await prisma.booking.create({
      data: {
        driverId: driver1.id,
        chargerId: f10Charger.id,
        startsAt: new Date(Date.now() - 3600 * 1000 * 48),
        endsAt: new Date(Date.now() - 3600 * 1000 * 46),
        status: 'CONFIRMED',
        estimatedKwh: 30.0,
        rateSnapshotPaisa: 6500,
      },
    });

    await prisma.session.create({
      data: {
        bookingId: bookingConfirmed.id,
        kwhDelivered: 28.5,
        rateSnapshotPaisa: 6500,
        totalPaisa: 185250, // Rs 1,852.50
        commissionPaisa: 27788, // Rs 277.88
        hostEnteredAt: new Date(Date.now() - 3600 * 1000 * 46),
        driverConfirmedAt: new Date(Date.now() - 3600 * 1000 * 45),
      },
    });

    await prisma.walletTransaction.create({
      data: {
        hostId: f10Charger.hostId,
        bookingId: bookingConfirmed.id,
        type: 'COMMISSION',
        amountPaisa: -27788,
        note: `Platform commission for booking ${bookingConfirmed.id}`,
      },
    });

    await prisma.review.create({
      data: {
        bookingId: bookingConfirmed.id,
        reviewerId: driver1.id,
        revieweeId: f10Charger.hostId,
        rating: 5,
        comment: 'Excellent host, clean charging setup, smooth transaction!',
      },
    });
  }

  // Booking 2: CHARGING (In Progress)
  const existingB2 = await prisma.booking.findFirst({
    where: { driverId: driver2.id, chargerId: g11Charger.id, status: 'CHARGING' },
  });
  if (!existingB2) {
    await prisma.booking.create({
      data: {
        driverId: driver2.id,
        chargerId: g11Charger.id,
        startsAt: new Date(Date.now() - 3600 * 1000 * 1),
        endsAt: new Date(Date.now() + 3600 * 1000 * 1),
        status: 'CHARGING',
        estimatedKwh: 20.0,
        rateSnapshotPaisa: 6000,
      },
    });
  }

  // Booking 3: REQUESTED (Pending Host Acceptance)
  const existingB3 = await prisma.booking.findFirst({
    where: { driverId: driver1.id, chargerId: i8Charger.id, status: 'REQUESTED' },
  });
  if (!existingB3) {
    await prisma.booking.create({
      data: {
        driverId: driver1.id,
        chargerId: i8Charger.id,
        startsAt: new Date(Date.now() + 3600 * 1000 * 2),
        endsAt: new Date(Date.now() + 3600 * 1000 * 4),
        status: 'REQUESTED',
        estimatedKwh: 15.0,
        expiresAt: new Date(Date.now() + 1800 * 1000), // 30 min expiry
      },
    });
  }

  // Booking 4: DISPUTED with Open Dispute
  const existingB4 = await prisma.booking.findFirst({
    where: { driverId: driver2.id, chargerId: f10Charger.id, status: 'DISPUTED' },
  });
  if (!existingB4) {
    const bookingDisputed = await prisma.booking.create({
      data: {
        driverId: driver2.id,
        chargerId: f10Charger.id,
        startsAt: new Date(Date.now() - 3600 * 1000 * 24),
        endsAt: new Date(Date.now() - 3600 * 1000 * 22),
        status: 'DISPUTED',
        estimatedKwh: 25.0,
        rateSnapshotPaisa: 6500,
      },
    });

    await prisma.session.create({
      data: {
        bookingId: bookingDisputed.id,
        kwhDelivered: 10.0,
        rateSnapshotPaisa: 6500,
        totalPaisa: 65000,
        commissionPaisa: 9750,
        hostEnteredAt: new Date(Date.now() - 3600 * 1000 * 22),
      },
    });

    await prisma.dispute.create({
      data: {
        bookingId: bookingDisputed.id,
        openedById: driver2.id,
        reason: 'Host unplugged car before target charge level was reached without notice.',
        status: 'OPEN',
      },
    });
  }

  console.log('📋 Seeded multi-state bookings (CONFIRMED, CHARGING, REQUESTED, DISPUTED)');

  // 7. Seed Pending Topup for Admin Verification Demo
  const existingTopup = await prisma.walletTopup.findFirst({
    where: { reference: 'MBL-FT-99882233' },
  });
  if (!existingTopup) {
    await prisma.walletTopup.create({
      data: {
        hostId: hosts[1].id,
        amountPaisa: 1000000, // Rs 10,000
        screenshotKey: `TOPUP_SCREENSHOT/${hosts[1].id}/seed_pending_slip.png`,
        reference: 'MBL-FT-99882233',
        status: 'PENDING',
      },
    });
    console.log('💳 Seeded pending wallet top-up for admin dashboard review');
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
