// Calculate expected tile count for a 60km area from zoom 1 to 16

function calculateTileCount(areaKm, minZoom, maxZoom) {
  console.log(`Calculating tiles for ${areaKm}km area from zoom ${minZoom} to ${maxZoom}`);
  
  let totalTiles = 0;
  const results = [];
  
  for (let z = minZoom; z <= maxZoom; z++) {
    // At zoom level z, each tile covers approximately:
    // Tile size in km = 40075.017 km (Earth circumference) / (2^z)
    const earthCircumferenceKm = 40075.017;
    const tileWidthKm = earthCircumferenceKm / Math.pow(2, z);
    
    // For a square area of areaKm, we need:
    const tilesPerSide = Math.ceil(Math.sqrt(areaKm) / tileWidthKm);
    const tilesAtZoom = tilesPerSide * tilesPerSide;
    
    totalTiles += tilesAtZoom;
    
    results.push({
      zoom: z,
      tileWidthKm: tileWidthKm.toFixed(3),
      tilesPerSide: tilesPerSide,
      tilesAtZoom: tilesAtZoom
    });
    
    console.log(`Zoom ${z}: ${tileWidthKm.toFixed(3)}km per tile, ${tilesPerSide}x${tilesPerSide} = ${tilesAtZoom} tiles`);
  }
  
  console.log(`\nTotal tiles expected: ${totalTiles}`);
  console.table(results);
  
  return totalTiles;
}

// Calculate for 60km area
const area60km = 60 * 60; // 3600 km²
const totalTiles = calculateTileCount(area60km, 1, 16);

console.log(`\nFor a 60km x 60km area (${area60km} km²) from zoom 1-16:`);
console.log(`Expected total tiles: ${totalTiles}`);

// Also calculate a more realistic scenario
console.log(`\n--- Alternative calculation for rectangular bounds ---`);

function calculateTilesForBounds(widthKm, heightKm, minZoom, maxZoom) {
  console.log(`Calculating tiles for ${widthKm}km x ${heightKm}km area from zoom ${minZoom} to ${maxZoom}`);
  
  let totalTiles = 0;
  
  for (let z = minZoom; z <= maxZoom; z++) {
    // At equator, each degree ≈ 111.32 km
    // At zoom z, tile width in degrees = 360 / (2^z)
    const tileWidthDegrees = 360 / Math.pow(2, z);
    const tileHeightDegrees = 180 / Math.pow(2, z);
    
    // Convert km to degrees (rough approximation at equator)
    const widthDegrees = widthKm / 111.32;
    const heightDegrees = heightKm / 111.32;
    
    const tilesX = Math.ceil(widthDegrees / tileWidthDegrees);
    const tilesY = Math.ceil(heightDegrees / tileHeightDegrees);
    const tilesAtZoom = tilesX * tilesY;
    
    totalTiles += tilesAtZoom;
    
    console.log(`Zoom ${z}: ${tilesX}x${tilesY} = ${tilesAtZoom} tiles`);
  }
  
  console.log(`Total tiles: ${totalTiles}`);
  return totalTiles;
}

calculateTilesForBounds(60, 60, 1, 16);
