import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Complete Offline Support',
    description: (
      <>
        Download and store entire map regions including vector/raster tiles,
        fonts, glyphs, sprites, and styles. Works seamlessly when offline.
      </>
    ),
  },
  {
    title: 'Modern UI Control',
    description: (
      <>
        Beautiful glassmorphic UI with dark/light theme support, interactive
        polygon drawing for region selection, and real-time download progress.
      </>
    ),
  },
  {
    title: 'MBTiles Import/Export',
    description: (
      <>
        Round-trip regions as real binary v1.3 SQLite MBTiles files. Vector
        tiles are gzipped and <code>vector_layers</code> is emitted, so the
        output opens directly in QGIS, tippecanoe, and maplibre-native.
      </>
    ),
  },
  {
    title: 'Full TypeScript Support',
    description: (
      <>
        Written in TypeScript with complete type definitions. Enjoy full
        autocomplete and type checking in your IDE.
      </>
    ),
  },
  {
    title: 'Storage Management',
    description: (
      <>
        Built-in analytics, automatic cleanup, and quota management. Keep track
        of storage usage and optimize performance.
      </>
    ),
  },
  {
    title: 'Easy Integration',
    description: (
      <>
        Drop-in MapLibre GL JS control. Add offline capabilities to your
        existing map application with just a few lines of code.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md padding-vert--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
