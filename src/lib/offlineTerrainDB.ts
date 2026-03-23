/**
 * IndexedDB cache for terrain data (BTs du jour).
 * Enables offline-first saisie for field workers.
 */

const DB_NAME = "altasart_terrain";
const DB_VERSION = 1;
const STORES = {
  operations: "operations",
  pendingUpdates: "pendingUpdates",
  pendingPhotos: "pendingPhotos",
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.operations)) {
        db.createObjectStore(STORES.operations, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.pendingUpdates)) {
        db.createObjectStore(STORES.pendingUpdates, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.pendingPhotos)) {
        db.createObjectStore(STORES.pendingPhotos, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Cache today's operations for offline access */
export async function cacheOperations(operations: any[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.operations, "readwrite");
  const store = tx.objectStore(STORES.operations);
  // Clear old data
  store.clear();
  for (const op of operations) {
    store.put(op);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get cached operations when offline */
export async function getCachedOperations(): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.operations, "readonly");
  const store = tx.objectStore(STORES.operations);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Queue a field update for sync when back online */
export async function queueFieldUpdate(update: {
  table: string;
  id: string;
  field: string;
  value: any;
}): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.pendingUpdates, "readwrite");
  tx.objectStore(STORES.pendingUpdates).put({
    ...update,
    timestamp: Date.now(),
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Queue a photo for upload when back online */
export async function queuePhoto(photo: {
  operationId: string;
  blob: Blob;
  fileName: string;
}): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.pendingPhotos, "readwrite");
  tx.objectStore(STORES.pendingPhotos).put({
    ...photo,
    timestamp: Date.now(),
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all pending updates to sync */
export async function getPendingUpdates(): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.pendingUpdates, "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORES.pendingUpdates).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get all pending photos to upload */
export async function getPendingPhotos(): Promise<any[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.pendingPhotos, "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORES.pendingPhotos).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Clear pending updates after successful sync */
export async function clearPendingUpdates(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.pendingUpdates, "readwrite");
  tx.objectStore(STORES.pendingUpdates).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Clear pending photos after successful upload */
export async function clearPendingPhotos(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.pendingPhotos, "readwrite");
  tx.objectStore(STORES.pendingPhotos).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Sync all pending data when back online */
export async function syncPendingData(supabase: any): Promise<{ updates: number; photos: number; errors: string[] }> {
  const errors: string[] = [];
  let updates = 0;
  let photos = 0;

  // Sync field updates
  const pendingUpdates = await getPendingUpdates();
  for (const update of pendingUpdates) {
    try {
      const { error } = await supabase
        .from(update.table)
        .update({ [update.field]: update.value })
        .eq("id", update.id);
      if (error) throw error;
      updates++;
    } catch (e: any) {
      errors.push(`Update ${update.table}.${update.field}: ${e.message}`);
    }
  }
  if (updates > 0) await clearPendingUpdates();

  // Sync photos
  const pendingPhotos = await getPendingPhotos();
  for (const photo of pendingPhotos) {
    try {
      const path = `operations/${photo.operationId}/${photo.fileName}`;
      const { error } = await supabase.storage
        .from("operation-photos")
        .upload(path, photo.blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      photos++;
    } catch (e: any) {
      errors.push(`Photo ${photo.fileName}: ${e.message}`);
    }
  }
  if (photos > 0) await clearPendingPhotos();

  return { updates, photos, errors };
}
