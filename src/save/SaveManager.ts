import { Chunk } from '../world/Chunk';

const DB_NAME = 'rafter-voxel';
const STORE_NAME = 'worlds';
const WORLD_KEY = 'default';

export class SaveManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async save(chunks: Chunk[], playerPos: { x: number; y: number; z: number }): Promise<void> {
    if (!this.db) await this.init();
    const payload = {
      version: 1,
      playerPos,
      chunks: chunks.map((c) => ({
        cx: c.cx,
        cz: c.cz,
        data: Array.from(new Uint8Array(c.serialize())),
      })),
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(payload, WORLD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(): Promise<{ chunks: Chunk[]; playerPos: { x: number; y: number; z: number } } | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(WORLD_KEY);
      req.onsuccess = () => {
        const payload = req.result;
        if (!payload) {
          resolve(null);
          return;
        }
        const chunks = payload.chunks.map((entry: { cx: number; cz: number; data: number[] }) => {
          const buf = new Uint8Array(entry.data).buffer;
          return Chunk.deserialize(buf);
        });
        resolve({ chunks, playerPos: payload.playerPos });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async hasSave(): Promise<boolean> {
    const data = await this.load();
    return data !== null;
  }
}
