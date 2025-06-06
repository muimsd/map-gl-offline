// Test the tile key extraction function
function extractTileKey(url) {
  // Match z/x/y pattern with optional file extension
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/);
  if (match) {
    const [, z, x, y, ext] = match;
    return `${z}/${x}/${y}.${ext}`;
  }
  
  // Fallback: try to extract just the filename part
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  if (filename.includes('.')) {
    return filename;
  }
  
  // Last resort: use the full URL
  console.warn(`Could not extract tile key from URL: ${url}`);
  return url;
}

// Test URLs
const testUrls = [
  'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/0/0/0.mvt',
  'https://tiles.example.com/v1/5/16/10.pbf',
  'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/10/512/384.png',
  'https://example.com/tiles/14/8192/6144.mvt'
];

console.log('Testing tile key extraction:');
testUrls.forEach(url => {
  const key = extractTileKey(url);
  console.log(`URL: ${url}`);
  console.log(`Key: ${key}`);
  console.log('---');
});
