/**
 * Polygon Selection Control Component
 * Handles polygon drawing, area calculation, and map visualization
 */

import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import { area } from '@turf/area';
import { bboxPolygon } from '@turf/bbox-polygon';
import { difference } from '@turf/difference';
import { convertArea, featureCollection, polygon } from '@turf/helpers';
import { icons } from '@/utils/icons';
import { logger } from '@/utils/logger';
import type { CssPrefix } from '@/utils/cssPrefix';

const polygonLogger = logger.scope('PolygonControl');

export interface PolygonControlOptions {
  onSave: (bounds: [number, number, number, number], area: number) => void;
  onCancel: () => void;
  cssPrefix?: CssPrefix;
}

export class PolygonControl {
  private map: MaplibreMap;
  private container: HTMLDivElement | undefined;
  private saveButton: HTMLButtonElement | undefined;
  private areaDisplay: HTMLSpanElement | undefined;
  private currentBounds: [number, number, number, number] | null = null;
  private currentArea = 0;
  private options: PolygonControlOptions;

  constructor(map: MaplibreMap, options: PolygonControlOptions) {
    this.map = map;
    this.options = options;
  }

  /**
   * Initialize polygon control mode
   */
  public enter(): void {
    this.createUI();
    this.updateVisualization();
    this.addMapListeners();
    this.showSaveButton();
  }

  /**
   * Exit polygon control mode
   */
  public exit(): void {
    this.removeUI();
    this.removeVisualization();
    this.removeMapListeners();
    this.hideSaveButton();
    this.currentBounds = null;
    this.currentArea = 0;
  }

  /**
   * Get current selection bounds
   */
  public getCurrentBounds(): [number, number, number, number] | null {
    return this.currentBounds;
  }

  /**
   * Get current selection area
   */
  public getCurrentArea(): number {
    return this.currentArea;
  }

  /**
   * Create the polygon control UI - area display at bottom center, next to zoom chip
   */
  private createUI(): void {
    // Check if bottom-chips container exists, create if not
    const mapContainer = this.map.getContainer();
    let chipsContainer = mapContainer.querySelector('.bottom-chips-container') as HTMLDivElement;

    if (!chipsContainer) {
      chipsContainer = document.createElement('div');
      chipsContainer.className =
        'bottom-chips-container absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-[999]';
      mapContainer.appendChild(chipsContainer);
    }

    // Create area display chip
    this.container = document.createElement('div');
    this.container.className =
      'offline-manager-control bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full shadow-xl px-4 py-2 font-sans text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap flex items-center gap-2';

    // Add area icon
    const areaIcon = document.createElement('span');
    areaIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    this.container.appendChild(areaIcon);

    this.areaDisplay = document.createElement('span');
    this.areaDisplay.textContent = 'Area: 0 km²';
    this.container.appendChild(this.areaDisplay);

    // Insert area chip at the beginning of the container (before zoom chip)
    chipsContainer.insertBefore(this.container, chipsContainer.firstChild);
  }

  /**
   * Create save polygon button
   */
  public createSaveButton(parentContainer: HTMLElement): void {
    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    const prefix = this.options.cssPrefix || 'maplibregl';
    this.saveButton.className = `${prefix}-ctrl-icon offline-manager-control mt-0.5 bg-gradient-to-br from-green-600 to-green-700 border border-green-700 rounded-sm cursor-pointer relative w-[29px] h-[29px] flex items-center justify-center hover:from-green-700 hover:to-green-800 transition-all duration-200`;
    this.saveButton.innerHTML = icons.check({ size: 16, color: 'white' });
    this.saveButton.title = 'Save Selected Region';
    this.saveButton.addEventListener('click', () => this.handleSave());

    // Initially hidden
    this.saveButton.style.display = 'none';

    parentContainer.appendChild(this.saveButton);
  }

  /**
   * Remove UI elements
   */
  private removeUI(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = undefined;
    }
  }

  /**
   * Show save button
   */
  private showSaveButton(): void {
    if (this.saveButton) {
      this.saveButton.style.display = 'flex';
    }
  }

  /**
   * Hide save button
   */
  private hideSaveButton(): void {
    if (this.saveButton) {
      this.saveButton.style.display = 'none';
    }
  }

  /**
   * Handle save button click
   */
  private handleSave(): void {
    if (this.currentBounds) {
      this.options.onSave(this.currentBounds, this.currentArea);
    }
  }

  /**
   * Trigger save programmatically
   */
  public triggerSave(): void {
    this.handleSave();
  }

  /**
   * Add map event listeners
   */
  private addMapListeners(): void {
    this.map.on('move', this.handleMapMove);
    this.map.on('zoomend', this.handleMapMove);
  }

  /**
   * Remove map event listeners
   */
  private removeMapListeners(): void {
    this.map.off('move', this.handleMapMove);
    this.map.off('zoomend', this.handleMapMove);
  }

  /**
   * Handle map move/zoom events
   */
  private handleMapMove = (): void => {
    this.updateVisualization();
  };

  /**
   * Update polygon visualization based on current map bounds
   */
  private updateVisualization(): void {
    const bboxArray = this.map.getBounds().toArray() as [number, number][];
    if (!bboxArray) return;

    const [minLng, minLat] = bboxArray[0];
    const [maxLng, maxLat] = bboxArray[1];

    const lngDiff = (maxLng - minLng) * 0.2;
    const latDiff = (maxLat - minLat) * 0.2;

    const clippedBbox = [minLng + lngDiff, minLat + latDiff, maxLng - lngDiff, maxLat - latDiff];

    // Store current bounds for later use
    this.currentBounds = clippedBbox as [number, number, number, number];

    const clippedPolygon = bboxPolygon([
      clippedBbox[0],
      clippedBbox[1],
      clippedBbox[2],
      clippedBbox[3],
    ]);

    const originalPolygon = polygon([
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ]);

    // Calculate area
    const clippedPolygonAreaM2 = area(clippedPolygon);
    const clippedPolygonAreaKM2 = convertArea(clippedPolygonAreaM2, 'meters', 'kilometers');
    this.currentArea = parseFloat(clippedPolygonAreaKM2.toFixed(2));

    // Update area display
    if (this.areaDisplay) {
      this.areaDisplay.textContent = `Area: ${this.currentArea} km²`;
    }

    // Calculate leftover polygon (dimmed area)
    const leftoverPolygon = difference(featureCollection([originalPolygon, clippedPolygon]));

    if (!leftoverPolygon) {
      polygonLogger.error('Failed to compute the difference between polygons');
      return;
    }

    // Update map visualization
    if (this.map.getSource('leftoverPolygon')) {
      (this.map.getSource('leftoverPolygon') as GeoJSONSource).setData(leftoverPolygon);
    } else {
      this.map.addSource('leftoverPolygon', {
        type: 'geojson',
        data: leftoverPolygon,
      });

      this.map.addLayer({
        id: 'leftoverPolygon',
        type: 'fill',
        source: 'leftoverPolygon',
        layout: {},
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0.7,
        },
      });
    }

    // Add selection polygon visualization
    if (this.map.getSource('selectionPolygon')) {
      (this.map.getSource('selectionPolygon') as GeoJSONSource).setData(clippedPolygon);
    } else {
      this.map.addSource('selectionPolygon', {
        type: 'geojson',
        data: clippedPolygon,
      });

      this.map.addLayer({
        id: 'selectionPolygon',
        type: 'line',
        source: 'selectionPolygon',
        layout: {},
        paint: {
          'line-color': '#8B5CF6', // Primary purple color
          'line-width': 3,
          'line-dasharray': [2, 2],
        },
      });
    }
  }

  /**
   * Remove polygon visualization from map
   */
  private removeVisualization(): void {
    // Remove layers and sources
    if (this.map.getLayer('leftoverPolygon')) {
      this.map.removeLayer('leftoverPolygon');
    }
    if (this.map.getLayer('selectionPolygon')) {
      this.map.removeLayer('selectionPolygon');
    }
    if (this.map.getSource('leftoverPolygon')) {
      this.map.removeSource('leftoverPolygon');
    }
    if (this.map.getSource('selectionPolygon')) {
      this.map.removeSource('selectionPolygon');
    }
  }
}
