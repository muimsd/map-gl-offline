import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'map-gl-offline',
  tagline: 'Complete offline map functionality for MapLibre GL JS',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://map-gl-offline.netlify.app',
  baseUrl: '/',

  organizationName: 'muimsd',
  projectName: 'map-gl-offline',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  markdown: {
    preprocessor: ({filePath, fileContent}) => fileContent,
  },

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
          editUrl: 'https://github.com/muimsd/map-gl-offline/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'map-gl-offline',
      logo: {
        alt: 'map-gl-offline Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.npmjs.com/package/map-gl-offline',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/muimsd/map-gl-offline',
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
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'API Reference',
              to: '/docs/api-reference',
            },
            {
              label: 'Examples',
              to: '/docs/examples',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/muimsd/map-gl-offline/issues',
            },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/muimsd/map-gl-offline/discussions',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/muimsd/map-gl-offline',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/map-gl-offline',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Muhammad Imran Siddique. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
