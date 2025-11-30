# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-30

### Added

#### Core Features
- **Complete Offline Map Support**: Download and store entire map regions with polygon-based selection
- **Smart Tile Management**: Efficient vector/raster tile downloading, caching, and retrieval with zoom-level optimization
- **Font & Glyph Support**: Comprehensive font and glyph management with Unicode range support
- **Sprite Management**: Multi-resolution sprite support (@1x, @2x) with intelligent caching
- **Real-time Analytics**: Detailed storage analytics, performance metrics, and optimization recommendations
- **Import/Export**: Support for JSON, PMTiles, and MBTiles formats for data portability
- **Data Portability**: Seamless transfer of offline maps between devices and applications

#### Modern UI Control
- **Glassmorphic Design**: Beautiful modern interface with glassmorphism effects and smooth animations
- **Dark/Light Theme**: Automatic theme switching with system preference detection and manual toggle
- **Polygon Drawing**: Interactive polygon tool for precise region selection
- **Live Progress Tracking**: Real-time download progress with detailed statistics and visual feedback
- **Region Management**: Easy-to-use interface for managing multiple offline regions
- **Responsive Design**: Mobile-friendly UI that adapts to all screen sizes

#### Technical Features
- **IndexedDB Storage**: Efficient browser storage with quota management and transaction safety
- **Full TypeScript Support**: Complete type definitions, interfaces, and compile-time safety
- **Performance Optimized**: Concurrent downloads, async/await patterns, and memory-efficient operations
- **Intelligent Cleanup**: Smart cleanup of expired data with customizable policies
- **Robust Error Handling**: Comprehensive error recovery, retry mechanisms, and graceful degradation
- **Enhanced Logging**: Detailed debugging with zoom-level specific logging (Z12 tracking)

### Fixed

- **Fractional Zoom Tiles**: Fixed tile loading at fractional zoom levels (12.000001-12.99999)
  - MapLibre requests tiles with fractional zoom (e.g., 12.5)
  - Tiles are stored with integer zoom (12)
  - Added `Math.floor()` to zoom level parsing in `idbFetchHandler.ts`
- **Sprite Loading**: Corrected sprite key format for proper offline sprite retrieval
- **Theme Toggle**: Fixed event listener attachment in Modal component
- **Modal Sizing**: Unified sizing logic between Modal and Panel components
- **Dark Mode**: Fixed input styling, header gradients, and nested backgrounds
- **Zoom Display**: Positioned zoom level indicator properly within map bounds

### Technical Improvements

- **Logger System**: Centralized logging with scoped loggers and configurable log levels
- **Constants**: Centralized configuration values and magic numbers
- **Error Utilities**: Consistent error handling and categorization
- **Type Safety**: Enhanced TypeScript types and JSDoc documentation
- **Code Quality**: Reduced console.log usage, fixed unused variables, improved maintainability

### Dependencies

- **Core**: `@mapbox/tilebelt`, `idb`, `@turf/turf`, `@tabler/icons`
- **Build**: TypeScript, Rollup, Vite
- **Styling**: Tailwind CSS v4
- **Peer Dependencies**: MapLibre GL JS >=1.0.0 or Mapbox GL JS >=2.0.0 (optional)

### Breaking Changes

None (initial release)

### Known Issues

None

### Migration Guide

This is the initial release. For future versions, migration guides will be provided here.

---

## Unreleased

### Planned Features

- **Pause/Resume Downloads**: Allow users to pause and resume ongoing downloads
- **Coverage Visualization**: Display map overlay showing offline coverage areas
- **Tile Verification Tool**: Enhanced diagnostics for missing or corrupted tiles
- **Background Sync**: Automatic update of changed tiles/styles
- **Performance Metrics**: Advanced monitoring and optimization tools
- **Multi-Region Selection**: Select multiple regions in single operation
- **Region Merging**: Combine overlapping regions automatically
- **Storage Optimization**: Advanced compression and deduplication
- **Offline Search**: Search functionality within downloaded regions
- **Custom Style Support**: Enhanced support for custom map styles

---

For more details, see the [README](README.md) and [documentation](https://github.com/muimsd/map-gl-offline).

[0.1.0]: https://github.com/muimsd/map-gl-offline/releases/tag/v0.1.0
