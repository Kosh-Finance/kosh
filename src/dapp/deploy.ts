/**
 * Kosh — Contract Deployment
 *
 * Deploys the rosca.compact contract to the local Midnight network.
 * Run via: npm run deploy
 *
 * Prerequisites:
 *   1. midnight-local-dev Docker stack running (ports 9944, 8088, 6300)
 *   2. Compact contract compiled: npm run compile
 *   3. Test wallet funded via midnight-local-dev funding CLI
 */

// deployContract is imported dynamically to avoid compile-time binding to
// its strongly-typed generics (which require the compiled contract type).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { deployContract as _deployContractType } from '@midnight-ntwrk/midnight-js-contracts';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { createProviders } from './providers';
import { createWitnesses, generateMemberSecrets, saveMemberState, PRIVATE_STATE_ID } from './witnesses';
import path from 'path';
import fs from 'fs/promises';

// ─── Deployment Configuration ─────────────────────────────────────────────────

export interface CircleConfig {
  contributionAmount: bigint;  // In smallest denomination (1 NIGHT = 1_000_000)
  memberCap: number;           // 2–16
  roundCount: number;          // Should equal memberCap
  roundDuration: bigint;       // In seconds (600 = 10 minutes for testing)
}

const DEFAULT_CIRCLE_CONFIG: CircleConfig = {
  contributionAmount: 1_000_000n,  // 1 NIGHT
  memberCap: 4,                    // 4 members for local testing
  roundCount: 4,
  roundDuration: 600n,             // 10 minutes per round
};

// ─── Deploy ───────────────────────────────────────────────────────────────────

/**
 * Deploys a new Kosh ROSCA circle contract.
 *
 * @param config - Circle parameters
 * @param wallet - The deploying wallet (organizer)
 * @returns The deployed contract address
 */
export async function deployKoshCircle(
  config: CircleConfig = DEFAULT_CIRCLE_CONFIG,
  buildDir = path.resolve('./build'),
): Promise<{ contractAddress: string }> {
  console.log('🔨 Deploying Kosh ROSCA circle...');
  console.log('   Config:', {
    contributionAmount: `${config.contributionAmount} (${Number(config.contributionAmount) / 1_000_000} NIGHT)`,
    memberCap: config.memberCap,
    roundCount: config.roundCount,
    roundDuration: `${config.roundDuration}s`,
  });

  // 1. Set up providers
  const providers = await createProviders(buildDir);
  console.log('✅ Providers configured');

  // 2. Generate deployer's member secrets (organizer is also a member)
  const { memberSecret, memberNonce } = generateMemberSecrets();

  // 3. Create witnesses (stateless factory — private state injected at proof time)
  const witnesses = createWitnesses();

  // 4. Load compiled contract artifacts
  const contractModule = await loadContractArtifacts(buildDir);

  // 5. Deploy with initial state
  console.log('📡 Submitting deployment transaction...');
  const deployStart = Date.now();

  // Wrap raw contract module in a CompiledContract with attached witnesses.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js') as any;
  const compiledContract = CompiledContract.withWitnesses(
    CompiledContract.make('kosh-rosca', contractModule.Contract),
    witnesses,
  );

  // Use dynamic import to avoid compile-time binding to the strongly-typed
  // deployContract generics (which require the compiled contract type at TS time).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts') as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deployResult: any = await deployContract(providers, {
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {
      memberSecret,
      memberNonce,
      leafIndex: -1,
      circleId: '',
      joinedAt: 0,
      recipientIsWallet: true,
    },
  });

  // FinalizedDeployTxData shape: { public: { contractAddress }, ... }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deployed = {
    contractAddress: (deployResult?.deployTxData?.public?.contractAddress ??
      deployResult?.contractAddress ??
      deployResult?.public?.contractAddress) as string,
  };

  const deployTime = ((Date.now() - deployStart) / 1000).toFixed(1);
  console.log(`✅ Contract deployed in ${deployTime}s`);
  console.log(`   Address: ${deployed.contractAddress}`);

  // 5b. Initialize ROSCA parameters — createCircle must be called after deployContract
  //     because deployContract only creates an empty initial state (no args).
  //     For server-side/CLI use, token color defaults to the native NIGHT type (all zeros).
  // NIGHT native token type on preview (32 zero bytes = untyped native token)
  const tokenColor: Uint8Array = new Uint8Array(32);
  console.log('📡 Calling createCircle...');
  await deployResult.callTx.createCircle(
    config.contributionAmount,
    BigInt(config.memberCap),
    BigInt(config.roundCount),
    config.roundDuration,
    tokenColor,
  );
  console.log('✅ Circle parameters set');

  // 6. Save organizer's private state under the real contract address
  await saveMemberState(providers.privateStateProvider, deployed.contractAddress, {
    memberSecret,
    memberNonce,
    leafIndex: -1,    // Not yet a member (organizer joins separately via joinCircle)
    circleId: deployed.contractAddress,
    joinedAt: 0,
    recipientIsWallet: true,
  });

  // 7. Save deployment record to disk for subsequent interactions
  const deploymentRecord = {
    contractAddress: deployed.contractAddress,
    config,
    deployedAt: new Date().toISOString(),
    network: 'preview',
  };
  await fs.writeFile(
    path.resolve('./deployment.json'),
    JSON.stringify(deploymentRecord, null, 2),
  );
  console.log('💾 Deployment record saved to deployment.json');

  return { contractAddress: deployed.contractAddress };
}

// ─── Artifact Loading ─────────────────────────────────────────────────────────

async function loadContractArtifacts(buildDir: string) {
  // The Compact compiler outputs:
  //   build/contract/     TypeScript bindings
  //   build/keys/         Proving and verifying keys
  //   build/zkir/         ZK Intermediate Representation
  const contractPath = path.join(buildDir, 'contract', 'index.js');

  try {
    const module = await import(contractPath);
    return module;
  } catch (err) {
    throw new Error(
      `Failed to load contract artifacts from ${contractPath}.\n` +
      'Run "npm run compile" first to generate the build artifacts.\n' +
      `Original error: ${err}`,
    );
  }
}

// ─── Browser Deployment ───────────────────────────────────────────────────────

/**
 * Deploy a new Kosh ROSCA circle from the browser using a connected Lace wallet.
 *
 * Unlike deployKoshCircle (which uses the server-side Node.js providers), this
 * function runs entirely in the browser:
 *   - ZK keys are fetched from /build/ (served from public/build/)
 *   - walletProvider + midnightProvider are backed by the Lace ConnectedAPI
 *   - Private state is in-memory (no LevelDB)
 *   - No Docker, no local proof server — uses the remote preview proof server
 *
 * Prerequisites:
 *   1. User has Lace Midnight extension connected to preview
 *   2. Wallet has tDUST/tNight for gas
 *   3. ZK artifacts are in /public/build/ (run `npm run compile && cp -r build public/build`)
 */
export async function deployFromBrowser(
  config: CircleConfig,
  connectedApi: ConnectedAPI,
): Promise<{ contractAddress: string }> {
  const { createBrowserProviders } = await import('./providers');
  const {
    createWitnesses: mkWitnesses,
    generateMemberSecrets: genSecrets,
    PRIVATE_STATE_ID: psId,
    saveMemberState: saveState,
  } = await import('./witnesses');

  // All 6 providers including walletProvider + midnightProvider from Lace
  const providers = await createBrowserProviders(connectedApi);

  if (!providers.walletProvider || !providers.midnightProvider) {
    throw new Error('Wallet not connected — call createBrowserProviders with a ConnectedAPI');
  }

  const { memberSecret, memberNonce } = genSecrets();
  const witnesses = mkWitnesses();

  // Load compiled contract from public/build/ (committed to git, served statically)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractModule = await import('../../public/build/contract/index.js') as any;

  // Wrap raw contract module in a CompiledContract with attached witnesses.
  // The SDK accesses compiledContract[CompactContextInternal.TypeId].ctor — passing
  // the raw ES module causes "Cannot read properties of undefined (reading 'ctor')".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js') as any;
  const compiledContract = CompiledContract.withWitnesses(
    CompiledContract.make('kosh-rosca', contractModule.Contract),
    witnesses,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts') as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deployResult: any = await deployContract(providers, {
    compiledContract,
    privateStateId: psId,
    initialPrivateState: {
      memberSecret,
      memberNonce,
      leafIndex: -1,
      circleId: '',       // updated below after contractAddress is known
      joinedAt: 0,
      recipientIsWallet: true,
    },
  });

  const contractAddress: string =
    deployResult?.deployTxData?.public?.contractAddress ??
    deployResult?.contractAddress ??
    deployResult?.public?.contractAddress;

  if (!contractAddress) {
    throw new Error('Deployment failed — no contract address returned');
  }

  // Initialize the ROSCA parameters by calling createCircle on the fresh contract.
  // deployContract only creates the empty contract state; createCircle sets amount,
  // cap, rounds, duration, and the token color (the shielded token type from Lace).
  const shielded = await connectedApi.getShieldedBalances();
  const rawTokenType = Object.keys(shielded)[0];
  if (!rawTokenType) {
    throw new Error('No shielded token balance found. Fund the wallet with tNight first.');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { encodeRawTokenType } = await import('@midnight-ntwrk/compact-runtime') as any;
  const tokenColor: Uint8Array = encodeRawTokenType(rawTokenType);

  await deployResult.callTx.createCircle(
    config.contributionAmount,
    BigInt(config.memberCap),
    BigInt(config.roundCount),
    config.roundDuration,
    tokenColor,
  );

  // Persist organizer's private state in-memory under the real contract address
  await saveState(providers.privateStateProvider, contractAddress, {
    memberSecret,
    memberNonce,
    leafIndex: -1,
    circleId: contractAddress,
    joinedAt: 0,
    recipientIsWallet: true,
  });

  return { contractAddress };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (require.main === module) {
  deployKoshCircle()
    .then(({ contractAddress }) => {
      console.log('\n🎉 Deployment complete!');
      console.log(`   Circle address: ${contractAddress}`);
      console.log('   Share this address with members to join.');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Deployment failed:', err.message);
      process.exit(1);
    });
}
