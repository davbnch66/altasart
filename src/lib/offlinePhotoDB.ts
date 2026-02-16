/**
 * IndexedDB-based offline photo storage.
 * Stores photo blobs locally when offline and replays uploads when back online.
 */

const DB_NAME = "gruespro_offline_photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

export interface OfflinePhoto {
  id: string;
  visiteId: string;
  pieceId: string | null;
  companyId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  timestamp: number;
  caption?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("visiteId", "visiteId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflinePhoto(photo: OfflinePhoto): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(photo);
    tx.oncomplete = () => {
      window.dispatchEvent(new CustomEvent("offline-photos-change"));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllOfflinePhotos(): Promise<OfflinePhoto[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflinePhotosByVisite(visiteId: string): Promise<OfflinePhoto[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("visiteId");
    const request = index.getAll(visiteId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflinePhoto(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      window.dispatchEvent(new CustomEvent("offline-photos-change"));
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflinePhotoCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
