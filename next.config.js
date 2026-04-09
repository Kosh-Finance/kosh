const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Packages that ship as ESM and need SWC transpilation.
  // Exclude WASM-bearing packages — webpack's asyncWebAssembly handles those natively.
  transpilePackages: [
    '@midnight-ntwrk/dapp-connector-api',
    '@midnight-ntwrk/midnight-js-network-id',
    // midnight-js-types removed: published as plain JS, transpilation interferes
    // with webpack alias resolution that redirects it to the nested v3.1.0
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
    'classic-level',
    'level',
  ],

  webpack: (config, { isServer }) => {
    // Enable async WASM modules (ledger-v8 ships .wasm)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // Fix: @midnight-ntwrk/compact-runtime 0.15 still has `"types"` after `"default"`
    // in its package.json exports, which webpack rejects with "Default condition should
    // be last one". Alias directly to the dist file to bypass exports resolution.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@midnight-ntwrk/compact-runtime': path.resolve(
        __dirname,
        'node_modules/@midnight-ntwrk/compact-runtime/dist/index.js',
      ),
      // ledger-v8 has proper browser/node exports conditions, but force the explicit
      // file for client vs server to ensure the correct WASM loader is picked.
      '@midnight-ntwrk/ledger-v8': isServer
        ? path.resolve(__dirname, 'node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_fs.js')
        : path.resolve(__dirname, 'node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm.js'),
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
        // Buffer polyfill — needed by midnight-js-utils in browser
        buffer:          require.resolve('buffer/'),
      };

      // midnight-js-contracts, ledger-v8, compact-js, compact-runtime are bundled
      // into the browser for client-side contract deployment.
      const browserOnlyExternals = [
        '@midnight-ntwrk/midnight-js-level-private-state-provider', // uses LevelDB
      ];

      const prevExternals = config.externals;
      config.externals = [
        ...(Array.isArray(prevExternals) ? prevExternals : prevExternals ? [prevExternals] : []),
        ({ request }, callback) => {
          if (browserOnlyExternals.some(pkg => request === pkg || request?.startsWith(`${pkg}/`))) {
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
