import { dbPromise } from '@/storage/indexedDbManager';

export async function downloadSprites(): Promise<void> {
  // Logic to download and store sprites
}

export async function loadSprites(): Promise<void> {
  // Logic to load sprites from storage
}

export async function deleteSprites(): Promise<void> {
  const db = await dbPromise;
  // Logic to delete sprites from storage
}