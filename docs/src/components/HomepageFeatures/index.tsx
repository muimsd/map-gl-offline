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
    title: "Everything the map needs",
    description: <>Regions include the style, tiles, sprites, fonts and 3D models, so the map draws the same with no connection.</>,
  },
  {
    title: "MapLibre and Mapbox GL",
    description: <>Works with both, including Mapbox Standard with its terrain and 3D buildings. Choose which optional features to save.</>,
  },
  {
    title: "A control or an API",
    description: <>Add a ready-made control where people draw an area and download it, or call downloadRegion from your own code.</>,
  },
  {
    title: "Accurate progress",
    description: <>One percentage that only moves forward, with exact counts for each phase, so people know how far along a download is.</>,
  },
  {
    title: "Storage you can manage",
    description: <>See what's using space, set expiry dates, and clean up automatically before the browser runs out of room.</>,
  },
  {
    title: "MBTiles in and out",
    description: <>Export regions to the standard SQLite format that QGIS and tippecanoe read, and import them back.</>,
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
