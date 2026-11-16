import db from './db';

/**
 * Calculates a host's current wallet balance in integer paisa by summing
 * the append-only ledger entries from the WalletTransaction table.
 *
 * @param hostId - User CUID of the host
 * @returns Total balance in integer paisa (0 if no transactions exist)
 */
export async function getWalletBalance(hostId: string): Promise<number> {
  const result = await db.walletTransaction.aggregate({
    where: { hostId },
    _sum: {
      amountPaisa: true,
    },
  });

  return result._sum.amountPaisa ?? 0;
}
