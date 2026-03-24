import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Kosh',
  tagline: 'Privacy-preserving savings circles on Midnight Network',
  favicon: 'img/favicon.ico',

  url: 'https://docs.kosh.finance',
  baseUrl: '/',

  organizationName: 'kosh-finance',
  projectName: 'kosh',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/kosh-finance/kosh/edit/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/kosh-social.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'k∅sh',
      logo: {
        alt: 'Kosh Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://kosh.finance',
          label: 'App',
          position: 'right',
        },
        {
          href: 'https://github.com/kosh-finance/kosh',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/' },
            { label: 'Getting Started', to: '/getting-started/prerequisites' },
            { label: 'Architecture', to: '/architecture/overview' },
            { label: 'Security', to: '/security/privacy-guarantees' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/kosh-finance/kosh' },
            { label: 'Midnight Network', href: 'https://midnight.network' },
          ],
        },
        {
          title: 'Built on',
          items: [
            { label: 'Midnight Network', href: 'https://midnight.network' },
            { label: 'Compact Language', href: 'https://docs.midnight.network/develop/reference/compact/lang-ref' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Kosh Finance. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.dracula,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'json', 'yaml'],
    },
    algolia: undefined,
  } satisfies Preset.ThemeConfig,
};

export default config;
