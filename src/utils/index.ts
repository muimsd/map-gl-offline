export async function fetchResource(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: ${response.statusText}`);
  }
  return (await response.arrayBuffer()) || response.blob();
}
