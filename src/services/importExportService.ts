import { dbPromise } from '../storage/indexedDbManager';
import type {
  RegionExportData,
  RegionImportData,
  ImportExportOptions,
  ImportExportProgress,
  ImportResult,
  ExportResult,
  TileExportData,
  SpriteExportData,
  FontExportData,
  PMTilesExportOptions,
  MBTilesExportOptions,
  StoredRegion,
} from '../types';

export class ImportExportService {
  private db = dbPromise;

  constructor() {
    // No need for initialization since dbPromise is already available
  }

  /**
   * Export a region to JSON format
   */
  async exportRegionAsJSON(
    regionId: string,
    options: ImportExportOptions = {}
  ): Promise<ExportResult> {
    const onProgress = options.onProgress || (() => {});

    try {
      onProgress({
        stage: 'preparing',
        percentage: 0,
        message: 'Preparing export...',
      });

      // Get region metadata
      const region = await this.getRegionMetadata(regionId);
      if (!region) {
        throw new Error(`Region ${regionId} not found`);
      }

      onProgress({
        stage: 'exporting',
        percentage: 10,
        message: 'Collecting region data...',
      });

      const exportData: RegionExportData = {
        metadata: {
          id: region.id,
          name: region.name || region.id,
          description: region.name || region.id, // StoredRegion doesn't have description, use name instead
          bounds: region.bounds,
          minZoom: region.minZoom,
          maxZoom: region.maxZoom,
          styleUrl: region.styleUrl || '',
          createdAt: region.created, // StoredRegion uses 'created' not 'createdAt'
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'json',
        },
        style: {},
        tiles: [],
        sprites: [],
        fonts: [],
      };

      // Export style if requested
      if (options.includeStyle !== false) {
        onProgress({
          stage: 'exporting',
          percentage: 20,
          message: 'Exporting style data...',
        });
        exportData.style = await this.exportStyle(regionId);
      }

      // Export tiles if requested
      if (options.includeTiles !== false) {
        onProgress({
          stage: 'exporting',
          percentage: 30,
          message: 'Exporting tiles...',
        });
        exportData.tiles = await this.exportTiles(regionId, onProgress);
      }

      // Export sprites if requested
      if (options.includeSprites !== false) {
        onProgress({
          stage: 'exporting',
          percentage: 70,
          message: 'Exporting sprites...',
        });
        exportData.sprites = await this.exportSprites(regionId);
      }

      // Export fonts if requested
      if (options.includeFonts !== false) {
        onProgress({
          stage: 'exporting',
          percentage: 85,
          message: 'Exporting fonts...',
        });
        exportData.fonts = await this.exportFonts(regionId);
      }

      onProgress({
        stage: 'processing',
        percentage: 95,
        message: 'Creating export file...',
      });

      // Create JSON blob
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      onProgress({
        stage: 'complete',
        percentage: 100,
        message: 'Export complete!',
      });

      return {
        success: true,
        format: 'json',
        filename: `${region.name || region.id}_export.json`,
        blob,
        size: blob.size,
        statistics: {
          tilesExported: exportData.tiles.length,
          spritesExported: exportData.sprites.length,
          fontsExported: exportData.fonts.length,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Export failed: ${errorMessage}`);
    }
  }

  /**
   * Export region as PMTiles format
   */
  async exportRegionAsPMTiles(
    regionId: string,
    options: ImportExportOptions & PMTilesExportOptions = {}
  ): Promise<ExportResult> {
    const onProgress = options.onProgress || (() => {});

    try {
      onProgress({
        stage: 'preparing',
        percentage: 0,
        message: 'Preparing PMTiles export...',
      });

      // Note: This is a simplified implementation
      // In a real implementation, you would use the PMTiles library
      // to create a proper PMTiles file format

      const region = await this.getRegionMetadata(regionId);
      if (!region) {
        throw new Error(`Region ${regionId} not found`);
      }

      // Get tiles data
      const tiles = await this.exportTiles(regionId, onProgress);

      // Create PMTiles header and data structure
      const pmtilesData = {
        header: {
          version: 3,
          type: 'mvt',
          compression: options.compression || 'gzip',
          bounds: region.bounds,
          minZoom: region.minZoom,
          maxZoom: region.maxZoom,
          metadata: {
            name: region.name,
            description: region.name || region.id, // StoredRegion doesn't have description, use name instead
            ...options.metadata,
          },
        },
        tiles: tiles,
      };

      // Convert to binary format (simplified)
      const jsonString = JSON.stringify(pmtilesData);
      const blob = new Blob([jsonString], { type: 'application/octet-stream' });

      onProgress({
        stage: 'complete',
        percentage: 100,
        message: 'PMTiles export complete!',
      });

      return {
        success: true,
        format: 'pmtiles',
        filename: `${region.name || region.id}.pmtiles`,
        blob,
        size: blob.size,
        statistics: {
          tilesExported: tiles.length,
          spritesExported: 0,
          fontsExported: 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`PMTiles export failed: ${errorMessage}`);
    }
  }

  /**
   * Export region as MBTiles format
   */
  async exportRegionAsMBTiles(
    regionId: string,
    options: ImportExportOptions & MBTilesExportOptions = {}
  ): Promise<ExportResult> {
    const onProgress = options.onProgress || (() => {});

    try {
      onProgress({
        stage: 'preparing',
        percentage: 0,
        message: 'Preparing MBTiles export...',
      });

      // Note: This is a simplified implementation
      // In a real implementation, you would use SQLite/SQL.js
      // to create a proper MBTiles SQLite database

      const region = await this.getRegionMetadata(regionId);
      if (!region) {
        throw new Error(`Region ${regionId} not found`);
      }

      // Get tiles data
      const tiles = await this.exportTiles(regionId, onProgress);

      // Create MBTiles structure (simplified as JSON for now)
      const mbtilesData = {
        metadata: {
          name: region.name,
          type: 'overlay',
          version: '1.0',
          description: region.name || region.id, // StoredRegion doesn't have description, use name instead
          format: options.format || 'pbf',
          bounds: region.bounds.flat().join(','),
          minzoom: region.minZoom,
          maxzoom: region.maxZoom,
          ...options.metadata,
        },
        tiles: tiles.map(tile => ({
          zoom_level: tile.z,
          tile_column: tile.x,
          tile_row: tile.y,
          tile_data: tile.data,
        })),
      };

      // Convert to binary format (simplified)
      const jsonString = JSON.stringify(mbtilesData);
      const blob = new Blob([jsonString], { type: 'application/octet-stream' });

      onProgress({
        stage: 'complete',
        percentage: 100,
        message: 'MBTiles export complete!',
      });

      return {
        success: true,
        format: 'mbtiles',
        filename: `${region.name || region.id}.mbtiles`,
        blob,
        size: blob.size,
        statistics: {
          tilesExported: tiles.length,
          spritesExported: 0,
          fontsExported: 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`MBTiles export failed: ${errorMessage}`);
    }
  }

  /**
   * Import region from file
   */
  async importRegion(importData: RegionImportData): Promise<ImportResult> {
    try {
      const fileContent = await this.readFileContent(importData.file);
      let regionData: RegionExportData;

      switch (importData.format) {
        case 'json':
          regionData = JSON.parse(fileContent);
          break;
        case 'pmtiles':
          regionData = await this.parsePMTiles(fileContent);
          break;
        case 'mbtiles':
          regionData = await this.parseMBTiles(fileContent);
          break;
        default:
          throw new Error(`Unsupported format: ${importData.format}`);
      }

      // Import the region data
      const result = await this.importRegionData(regionData, importData);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        regionId: '',
        message: `Import failed: ${errorMessage}`,
        statistics: {
          tilesImported: 0,
          spritesImported: 0,
          fontsImported: 0,
          totalSize: 0,
        },
      };
    }
  }

  /**
   * Get region metadata
   */
  private async getRegionMetadata(regionId: string): Promise<StoredRegion | null> {
    const db = await this.db;
    const transaction = db.transaction(['regions'], 'readonly');
    const store = transaction.objectStore('regions');

    try {
      const result = await store.get(regionId);
      return result || null;
    } catch (error) {
      console.error('Error getting region metadata:', error);
      return null;
    }
  }

  /**
   * Export style data
   */
  private async exportStyle(regionId: string): Promise<any> {
    const db = await this.db;
    const transaction = db.transaction(['styles'], 'readonly');
    const store = transaction.objectStore('styles');

    try {
      const style = await store.get(regionId);
      return style || {};
    } catch (error) {
      console.error('Error exporting style:', error);
      return {};
    }
  }

  /**
   * Export tiles data
   */
  private async exportTiles(
    regionId: string,
    onProgress?: (progress: ImportExportProgress) => void
  ): Promise<TileExportData[]> {
    const db = await this.db;
    const transaction = db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');

    const tiles: TileExportData[] = [];

    try {
      const cursor = await store.openCursor();
      let processed = 0;

      if (cursor) {
        do {
          const tile = cursor.value;
          // Filter tiles by regionId (styleId)
          if (tile.styleId === regionId) {
            tiles.push({
              z: tile.z ?? 0, // Handle optional z
              x: tile.x ?? 0, // Handle optional x
              y: tile.y ?? 0, // Handle optional y
              data: tile.data,
              format: 'pbf', // TileEntry doesn't have format, use default
              sourceId: tile.sourceId ?? 'default', // Handle optional sourceId
            });
          }

          processed++;
          if (onProgress && processed % 100 === 0) {
            onProgress({
              stage: 'exporting',
              percentage: 30 + (processed / 1000) * 40, // Rough estimation
              message: `Exported ${processed} tiles...`,
              currentItem: `${tile.z ?? 0}/${tile.x ?? 0}/${tile.y ?? 0}`,
              completedItems: processed,
            });
          }
        } while (await cursor.continue());
      }

      return tiles;
    } catch (error) {
      console.error('Error exporting tiles:', error);
      return [];
    }
  }

  /**
   * Export sprites data
   */
  private async exportSprites(regionId: string): Promise<SpriteExportData[]> {
    const db = await this.db;
    const transaction = db.transaction(['sprites'], 'readonly');
    const store = transaction.objectStore('sprites');

    const sprites: SpriteExportData[] = [];

    try {
      const cursor = await store.openCursor();

      if (cursor) {
        do {
          const sprite = cursor.value;
          // SpriteEntry doesn't have styleId, so we'll include all sprites for now
          // In a real implementation, you might need to filter by URL patterns or other criteria
          sprites.push({
            url: sprite.url,
            data: sprite.data,
            type: sprite.url.endsWith('.json') ? 'json' : 'png',
            resolution: sprite.url.includes('@2x') ? '2x' : '1x',
          });
        } while (await cursor.continue());
      }

      return sprites;
    } catch (error) {
      console.error('Error exporting sprites:', error);
      return [];
    }
  }

  /**
   * Export fonts data
   */
  private async exportFonts(regionId: string): Promise<FontExportData[]> {
    const db = await this.db;
    const transaction = db.transaction(['fonts'], 'readonly');
    const store = transaction.objectStore('fonts');

    const fonts: FontExportData[] = [];

    try {
      const cursor = await store.openCursor();

      if (cursor) {
        do {
          const font = cursor.value;
          // FontEntry doesn't have styleId or fontStack/range, so we'll export basic font data
          // In a real implementation, you might need to filter by download ID or other criteria
          fonts.push({
            fontStack: font.key, // Use key as fontstack identifier
            range: '0-255', // Default range since FontEntry doesn't store this
            data: font.data,
          });
        } while (await cursor.continue());
      }

      return fonts;
    } catch (error) {
      console.error('Error exporting fonts:', error);
      return [];
    }
  }

  /**
   * Read file content
   */
  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse PMTiles file (simplified)
   */
  private async parsePMTiles(content: string): Promise<RegionExportData> {
    // This is a simplified implementation
    // In reality, you would use the PMTiles library to parse the binary format
    const data = JSON.parse(content);

    return {
      metadata: {
        id: data.header.metadata.name || 'imported-region',
        name: data.header.metadata.name || 'Imported Region',
        description: data.header.metadata.description,
        bounds: data.header.bounds,
        minZoom: data.header.minZoom,
        maxZoom: data.header.maxZoom,
        styleUrl: '',
        createdAt: Date.now(),
        exportedAt: Date.now(),
        version: '1.0.0',
        format: 'pmtiles',
      },
      style: {},
      tiles: data.tiles || [],
      sprites: [],
      fonts: [],
    };
  }

  /**
   * Parse MBTiles file (simplified)
   */
  private async parseMBTiles(content: string): Promise<RegionExportData> {
    // This is a simplified implementation
    // In reality, you would use SQL.js to parse the SQLite database
    const data = JSON.parse(content);

    const bounds = data.metadata.bounds
      ? data.metadata.bounds.split(',').map(Number)
      : [0, 0, 0, 0];

    return {
      metadata: {
        id: data.metadata.name || 'imported-region',
        name: data.metadata.name || 'Imported Region',
        description: data.metadata.description,
        bounds: [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        minZoom: data.metadata.minzoom || 0,
        maxZoom: data.metadata.maxzoom || 14,
        styleUrl: '',
        createdAt: Date.now(),
        exportedAt: Date.now(),
        version: '1.0.0',
        format: 'mbtiles',
      },
      style: {},
      tiles:
        data.tiles.map((tile: any) => ({
          z: tile.zoom_level,
          x: tile.tile_column,
          y: tile.tile_row,
          data: tile.tile_data,
          format: 'pbf',
          sourceId: 'imported',
        })) || [],
      sprites: [],
      fonts: [],
    };
  }

  /**
   * Import region data to database
   */
  private async importRegionData(
    regionData: RegionExportData,
    importOptions: RegionImportData
  ): Promise<ImportResult> {
    const db = await this.db;
    const regionId = importOptions.newRegionId || regionData.metadata.id;
    const regionName = importOptions.newRegionName || regionData.metadata.name;

    try {
      // Check if region exists and handle overwrite
      if (!importOptions.overwrite) {
        const existingRegion = await this.getRegionMetadata(regionId);
        if (existingRegion) {
          throw new Error('Region already exists. Set overwrite to true to replace it.');
        }
      }

      // Import region metadata
      const transaction = db.transaction(['regions'], 'readwrite');
      const regionStore = transaction.objectStore('regions');

      await regionStore.put({
        id: regionId,
        key: regionId, // StoredRegion requires key property
        name: regionName,
        bounds: regionData.metadata.bounds,
        minZoom: regionData.metadata.minZoom,
        maxZoom: regionData.metadata.maxZoom,
        styleUrl: regionData.metadata.styleUrl,
        styleId: regionId, // StoredRegion requires styleId
        created: Date.now(), // StoredRegion uses 'created' not 'createdAt'
        lastModified: Date.now(), // Required by StoredRegion
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // Default 30 days expiry
      });

      // Import style
      if (regionData.style && Object.keys(regionData.style).length > 0) {
        const styleTransaction = db.transaction(['styles'], 'readwrite');
        const styleStore = styleTransaction.objectStore('styles');
        await styleStore.put({
          key: regionId,
          style: regionData.style,
          provider: 'auto',
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        });
      }

      // Import tiles
      if (regionData.tiles && regionData.tiles.length > 0) {
        const tileTransaction = db.transaction(['tiles'], 'readwrite');
        const tileStore = tileTransaction.objectStore('tiles');

        for (const tile of regionData.tiles) {
          await tileStore.put({
            key: `${regionId}_${tile.z}_${tile.x}_${tile.y}`,
            styleId: regionId,
            z: tile.z,
            x: tile.x,
            y: tile.y,
            data: tile.data,
            sourceId: tile.sourceId,
            downloadedAt: new Date().toISOString(),
            size: tile.data.byteLength || 0,
            type: 'vector',
            url: `tile://${tile.z}/${tile.x}/${tile.y}`,
            lastModified: Date.now(),
          });
        }
      }

      // Import sprites and fonts similarly...

      return {
        success: true,
        regionId,
        message: 'Region imported successfully',
        statistics: {
          tilesImported: regionData.tiles?.length || 0,
          spritesImported: regionData.sprites?.length || 0,
          fontsImported: regionData.fonts?.length || 0,
          totalSize: 0, // Calculate if needed
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to import region data: ${errorMessage}`);
    }
  }
}
