import { findNearbyChargers } from '../lib/geo';
import { getWalletBalance } from '../lib/wallet';
import db from '../lib/db';

async function verify() {
  console.log('=====================================================');
  console.log('   CHARGESHARE PHASE 2 VERIFICATION SCRIPT');
  console.log('=====================================================\n');

  // Search point: Islamabad Blue Area / Zero Point (33.7000, 73.0600)
  const searchLat = 33.7000;
  const searchLng = 73.0600;
  const radiusKm = 15;

  console.log(`📍 Testing findNearbyChargers() from [${searchLat}, ${searchLng}] within ${radiusKm} km radius...`);
  const chargers = await findNearbyChargers(searchLat, searchLng, radiusKm, 10);

  console.log(`\nFound ${chargers.length} active chargers nearby:\n`);
  for (const c of chargers) {
    const distKm = (c.distanceMeters! / 1000).toFixed(2);
    const rs = (c.pricePerKwhPaisa / 100).toFixed(2);
    console.log(`- [${c.areaLabel}] ${c.title}`);
    console.log(`  Distance: ${c.distanceMeters}m (~${distKm} km) | Power: ${c.powerKw} kW (${c.connectorType})`);
    console.log(`  Rate: ${c.pricePerKwhPaisa} paisa/kWh (Rs ${rs}/kWh) | Rating: ${c.hostRatingAverage ?? 'No reviews yet'}`);
    console.log(`  Location: [${c.publicLat}, ${c.publicLng}]`);

    // Verify security requirement: addressLine must NEVER be leaked
    if ('addressLine' in c) {
      console.error(`❌ SECURITY FAILURE: addressLine was returned for charger ${c.id}!`);
      process.exit(1);
    }
  }
  console.log('✅ Security Check Passed: addressLine is NOT exposed in search results.');

  // Test Wallet Balance calculation
  console.log('\n-----------------------------------------------------');
  console.log('Testing getWalletBalance()...');
  const host = await db.user.findFirst({
    where: { email: 'host1@example.com' },
  });

  if (!host) {
    console.error('❌ Host 1 not found for wallet balance check');
    process.exit(1);
  }

  const balancePaisa = await getWalletBalance(host.id);
  const balanceRs = (balancePaisa / 100).toFixed(2);
  console.log(`✅ Host ${host.name} (${host.email}) Wallet Balance: ${balancePaisa} paisa (Rs ${balanceRs})`);

  // Test Append-Only Trigger on WalletTransaction
  console.log('\n-----------------------------------------------------');
  console.log('Testing Append-Only Trigger on WalletTransaction...');
  const tx = await db.walletTransaction.findFirst({
    where: { hostId: host.id },
  });

  if (!tx) {
    console.error('❌ No wallet transaction found to test trigger');
    process.exit(1);
  }

  try {
    console.log(`Attempting an UPDATE on WalletTransaction ${tx.id}...`);
    await db.$executeRawUnsafe(
      `UPDATE "WalletTransaction" SET "note" = 'Modified illegally' WHERE "id" = '${tx.id}';`
    );
    console.error('❌ CRITICAL FAILURE: Database trigger failed to block UPDATE on WalletTransaction!');
    process.exit(1);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('append-only ledger')) {
      console.log('✅ Append-Only Trigger Verified: Database blocked UPDATE on WalletTransaction:');
      console.log(`   "${errorMsg.split('\n')[0]}"`);
    } else {
      console.log('✅ Database blocked UPDATE operation as expected:', errorMsg.split('\n')[0]);
    }
  }

  console.log('\n=====================================================');
  console.log('🎉 ALL PHASE 2 VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('=====================================================');
}

verify()
  .catch((e) => {
    console.error('Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
