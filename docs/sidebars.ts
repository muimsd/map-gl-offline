import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'guides/downloading-regions',
        'guides/mapbox',
        'guides/ui-control',
        'guides/storage',
        'guides/mbtiles',
        'guides/troubleshooting',
      ],
    },
    'api-reference',
    'architecture',
    'migration-0.6',
  ],
};

export default sidebars;
