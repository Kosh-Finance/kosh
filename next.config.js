const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Packages that ship as ESM and need SWC transpilation.
  // Exclude WASM-bearing packages — webpack's asyncWebAssembly handles those natively.
  transpilePackages: [
    '@midnight-ntwrk/dapp-connector-api',
    '@midnight-ntwrk/midnight-js-network-id',
    '@midnight-ntwrk/midnight-js-types',
    '@midnight-ntwrk/wallet-sdk-abstractions',
    '@midnight-ntwrk/wallet-sdk-address-format',
    '@midnight-ntwrk/wallet-sdk-dust-wallet',
    '@midnight-ntwrk/wallet-sdk-facade',
    '@midnight-ntwrk/wallet-sdk-hd',
    '@midnight-ntwrk/wallet-sdk-shielded',
    '@midnight-ntwrk/wallet-sdk-unshielded-wallet',
  ],

  // Node.js-only SDK packages — don't bundle server-side either
  serverExternalPackages: [
    '@midnight-ntwrk/midnight-js-level-private-state-provider',
    '@midnight-ntwrk/midnight-js-contracts',
    '@midnight-ntwrk/compact-runtime',
    '@midnight-ntwrk/ledger-v7',
    '@midnight-ntwrk/ledger-v8',
    '@midnight-ntwrk/compact-js',
    'classic-level',
    'level',
  ],

  webpack: (config, { isServer }) => {
    // Enable async WASM modules (ledger-v7, zkir-v2, etc.)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // Fix: @midnight-ntwrk/compact-runtime has `"types"` after `"default"` in its
    // package.json exports field, which webpack rejects with "Default condition should
    // be last one". Alias directly to the dist file to bypass exports resolution.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@midnight-ntwrk/compact-runtime': path.resolve(
        __dirname,
        'node_modules/@midnight-ntwrk/compact-runtime/dist/index.js',
      ),
    };

    if (!isServer) {
      // Browser bundle: prevent webpack from bundling Node.js-only packages
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:              false,
        net:             false,
        tls:             false,
        crypto:          false,
        level:           false,
        'classic-level': false,
        'abstract-level': false,
      };

      // Externalize heavy SDK packages — only needed at runtime via Lace wallet
      // or when the Midnight node is running (not needed to render the UI)
      const sdkExternals = [
        '@midnight-ntwrk/midnight-js-contracts',
        '@midnight-ntwrk/midnight-js-level-private-state-provider',
        '@midnight-ntwrk/ledger-v7',
        '@midnight-ntwrk/ledger-v8',
        '@midnight-ntwrk/compact-runtime',
        '@midnight-ntwrk/compact-js',
      ];

      const prevExternals = config.externals;
      config.externals = [
        ...(Array.isArray(prevExternals) ? prevExternals : prevExternals ? [prevExternals] : []),
        ({ request }, callback) => {
          if (sdkExternals.some(pkg => request === pkg || request?.startsWith(`${pkg}/`))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }

    // Treat native .node binary files as empty modules
    config.module.rules.push({
      test: /\.node$/,
      loader: 'ignore-loader',
    });

    return config;
  },
};

module.exports = nextConfig;
