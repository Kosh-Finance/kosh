/**
 * Kosh — Lace Wallet Provider Adapters
 *
 * Wraps Lace's ConnectedAPI into the walletProvider + midnightProvider duck-typed
 * objects expected by @midnight-ntwrk/midnight-js-contracts at runtime.
 *
 * The runtime interface (from midnight-js-contracts CJS source):
 *   walletProvider.getCoinPublicKey()         → Bech32m coin public key string
 *   walletProvider.getEncryptionPublicKey()   → Bech32m encryption public key string
 *   walletProvider.balanceTx(provenTx)        → Promise<BalancedTransaction>
 *   midnightProvider.submitTx(balancedTx)     → Promise<TransactionId>
 *
 * Note: The TypeScript type definitions in @midnight-ntwrk/midnight-js-types use
 * property syntax (coinPublicKey) and two-argument balanceTx, but the actual CJS
 * implementation uses method syntax and single-argument balanceTx. We match the
 * runtime shape, not the d.ts, and use `any` to avoid type mismatches.
 */

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuntimeWalletProvider = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuntimeMidnightProvider = any;

export interface LaceProviders {
  walletProvider: RuntimeWalletProvider;
  midnightProvider: RuntimeMidnightProvider;
}

/**
 * Create walletProvider + midnightProvider adapters from a connected Lace ConnectedAPI.
 *
 * Pre-fetches shielded public keys so getCoinPublicKey/getEncryptionPublicKey are
 * synchronous (the contracts SDK calls them synchronously during tx construction).
 */
export async function createLaceProviders(api: ConnectedAPI): Promise<LaceProviders> {
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
    await api.getShieldedAddresses();

  const walletProvider: RuntimeWalletProvider = {
    // Both keys are Bech32m strings; parseCoinPublicKeyToHex (used by contracts SDK)
    // handles Bech32m → hex conversion transparently.
    getCoinPublicKey:       () => shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedEncryptionPublicKey,

    /**
     * Balance an unbalanced (proven) transaction via the Lace wallet.
     * Serializes the tx to hex, sends to Lace, deserializes the balanced result.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    balanceTx: async (provenTx: any): Promise<any> => {
      const [{ toHex, fromHex }, ledgerV7] = await Promise.all([
        import('@midnight-ntwrk/midnight-js-utils'),
        import('@midnight-ntwrk/ledger-v7'),
      ]);

      const hex = toHex(provenTx.serialize() as Uint8Array);
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(hex);
      // Deserialize as Transaction<SignatureEnabled='signature', Proof='proof', Binding='binding'>
      // Return value is consumed as-is by midnightProvider.submitTx — no branding needed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ledgerV7 as any).Transaction.deserialize(
        'signature', 'proof', 'binding',
        fromHex(balancedHex),
      );
    },
  };

  const midnightProvider: RuntimeMidnightProvider = {
    /**
     * Submit a balanced transaction via the Lace wallet.
     * Returns the last transaction identifier (matches wallet-sdk-facade pattern).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitTx: async (balancedTx: any): Promise<any> => {
      const { toHex } = await import('@midnight-ntwrk/midnight-js-utils');
      const hex = toHex(balancedTx.serialize() as Uint8Array);
      await api.submitTransaction(hex);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (balancedTx.identifiers() as any[]).at(-1);
    },
  };

  return { walletProvider, midnightProvider };
}
