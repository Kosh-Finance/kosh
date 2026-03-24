import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/prerequisites',
        'getting-started/local-dev',
        'getting-started/funding-wallets',
        'getting-started/running-the-app',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/compact-model',
        'architecture/privacy-scheme',
        'architecture/state-machine',
        'architecture/token-flow',
      ],
    },
    {
      type: 'category',
      label: 'Contract Reference',
      items: [
        'contract/ledger-state',
        'contract/circuits',
        'contract/witnesses',
      ],
    },
    {
      type: 'category',
      label: 'DApp Layer',
      items: [
        'dapp/providers',
        'dapp/deploy',
        'dapp/interact',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security/privacy-guarantees',
        'security/threat-model',
        'security/assumptions',
        'security/audit-checklist',
      ],
    },
    {
      type: 'doc',
      id: 'roadmap',
      label: 'Roadmap',
    },
  ],
};

export default sidebars;
