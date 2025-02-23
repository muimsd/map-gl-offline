export function generateFontUrls(): string[] {
  const fonts = ['OpenSans-Regular', 'OpenSans-Bold']; // Add more fonts as needed
  const urls: string[] = [];

  for (const font of fonts) {
    const fontUrl = `https://example.com/fonts/${font}.pbf`; // Replace with actual font URL template
    urls.push(fontUrl);
  }

  return urls;
}