// Calculate tiles for the actual region from your logs
// Area: 81.12 km², Zoom: 1-14

function analyzeActualRegion() {
  console.log('=== ACTUAL REGION ANALYSIS ===');
  console.log('Area: 81.12 km²');
  console.log('Zoom range: 1 to 14');
  console.log('');
  
  // From your logs:
  const tilesByZoom = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 
    6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 
    11: 4, 12: 4, 13: 12, 14: 30
  };
  
  let totalTiles = 0;
  console.log('Zoom Level | Tiles | Running Total');
  console.log('-----------|-------|---------------');
  
  for (let z = 1; z <= 14; z++) {
    const tilesAtZoom = tilesByZoom[z];
    totalTiles += tilesAtZoom;
    console.log(`    ${z.toString().padStart(2)}     |  ${tilesAtZoom.toString().padStart(3)}  |     ${totalTiles.toString().padStart(3)}`);
  }
  
  console.log(`\nTotal tiles: ${totalTiles}`);
  console.log('Downloaded: 65 tiles');
  console.log('Difference: ' + (totalTiles - 65) + ' tiles');
  
  if (totalTiles - 65 <= 2) {
    console.log('✅ RESULT: Tile download is working correctly!');
    console.log('The small difference could be due to:');
    console.log('- Edge cases in coordinate calculation');
    console.log('- Existing tiles being skipped');
    console.log('- Minor rounding differences');
  }
  
  return totalTiles;
}

analyzeActualRegion();

console.log('\n=== COMPARISON WITH 60KM x 60KM AREA ===');
console.log('If you actually wanted a 60km x 60km area (3,600 km²):');

// Calculate what 60x60km would be at zoom 1-14
function calculateFor60kmSquare() {
  let totalTiles = 0;
  const area60km = 60 * 60; // 3600 km²
  
  for (let z = 1; z <= 14; z++) {
    const earthCircumferenceKm = 40075.017;
    const tileWidthKm = earthCircumferenceKm / Math.pow(2, z);
    const tilesPerSide = Math.ceil(Math.sqrt(area60km) / tileWidthKm);
    const tilesAtZoom = tilesPerSide * tilesPerSide;
    totalTiles += tilesAtZoom;
    
    if (z <= 5 || z >= 12) { // Show first few and last few
      console.log(`Zoom ${z}: ${tilesAtZoom} tiles`);
    } else if (z === 6) {
      console.log('...');
    }
  }
  
  console.log(`Total for 60x60km area (zoom 1-14): ${totalTiles} tiles`);
  console.log(`Your current area is much smaller: ${(81.12/3600*100).toFixed(1)}% of 60x60km`);
}

calculateFor60kmSquare();
