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
    //
    // @midnight-ntwrk/ledger is a virtual peer dep re-exported by midnight-js-types.
    // Deduplicate ledger-v7 so compact-js (which nests its own 7.0.0) uses the
    // top-level 7.0.2 and we only load one copy of the 10 MB WASM.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@midnight-ntwrk/compact-runtime': path.resolve(
        __dirname,
        'node_modules/@midnight-ntwrk/compact-runtime/dist/index.js',
      ),
      // Use browser WASM for client builds, FS WASM for server/Node builds.
      '@midnight-ntwrk/ledger': isServer
        ? path.resolve(__dirname, 'node_modules/@midnight-ntwrk/ledger-v7/midnight_ledger_wasm_fs.js')
        : path.resolve(__dirname, 'node_modules/@midnight-ntwrk/ledger-v7/midnight_ledger_wasm.js'),
      // Deduplicate: compact-js nests ledger-v7@7.0.0; force all imports to top-level 7.0.2
      '@midnight-ntwrk/ledger-v7': path.resolve(
        __dirname,
        'node_modules/@midnight-ntwrk/ledger-v7',
      ),
      // midnight-js-contracts v3.1.0 needs midnight-js-types v3.1.0 (nested copy).
      // webpack hoisting resolves to the top-level v2.0.2 which lacks 'Transaction'.
      // Force the v3.1.0 bundle for browser builds; server-side contracts is external.
      ...(!isServer && {
        '@midnight-ntwrk/midnight-js-types': path.resolve(
          __dirname,
          'node_modules/@midnight-ntwrk/midnight-js-contracts/node_modules/@midnight-ntwrk/midnight-js-types',
        ),
      }),
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

      // Only externalize packages that are truly Node.js-only.
      // midnight-js-contracts, ledger-v7, compact-js, compact-runtime are needed
      // for browser-side contract deployment and must be bundled (not externalized).
      const browserOnlyExternals = [
        '@midnight-ntwrk/midnight-js-level-private-state-provider', // uses LevelDB
        '@midnight-ntwrk/ledger-v8',                                 // wallet-sdk only
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
