/**
 * Almacenamiento Local Resiliente (IndexedDB Bridge) - Eurorep / SAPI
 * Diseñado como módulo ES con compatibilidad universal.
 * Previene el desbordamiento de cuota de 5MB en localStorage redirigiendo catálogos pesados a IndexedDB.
 */

export const redirectedKeys = [
  'sapi_refacciones_db',
  'eurorep_pedidos_sap',
  'eurorep_cotizaciones_sap',
  'sapi_tickets',
  'sapi_ordenes',
  'sapi_levantamientos',
  'sapi_sync_queue'
];

let sharedDb = null;
const pendingWrites = new Map();

export function getSharedDb() {
  if (sharedDb) return Promise.resolve(sharedDb);
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open('SapiOfflineDB', 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('catalogs')) {
          db.createObjectStore('catalogs', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        sharedDb = e.target.result;
        sharedDb.onclose = () => { sharedDb = null; };
        sharedDb.onerror = () => { sharedDb = null; };
        resolve(sharedDb);
      };
      req.onerror = () => resolve(null);
    } catch (err) {
      resolve(null);
    }
  });
}

export function scheduleDbWrite(key, data) {
  if (pendingWrites.has(key)) {
    clearTimeout(pendingWrites.get(key));
  }
  const timer = setTimeout(async () => {
    pendingWrites.delete(key);
    try {
      const db = await getSharedDb();
      if (db) {
        const tx = db.transaction('catalogs', 'readwrite');
        const store = tx.objectStore('catalogs');
        store.put({ id: key, data: data });
      }
    } catch (e) {
      console.error('[IndexedDB Bridge] Error al guardar diferido:', key, e);
    }
  }, 50);
  pendingWrites.set(key, timer);
}

export function initLocalStorageIndexedDBBridge() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined' || typeof window === 'undefined') {
      resolve();
      return;
    }
    getSharedDb().then((db) => {
      if (!db) return resolve();
      try {
        const tx = db.transaction('catalogs', 'readonly');
        const store = tx.objectStore('catalogs');
        let completed = 0;
        
        redirectedKeys.forEach(key => {
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result && req.result.data) {
              window.localStorageCache[key] = JSON.stringify(req.result.data);
              if (typeof localStorage !== 'undefined') {
                originalRemoveItem.call(localStorage, key);
              }
            } else {
              if (typeof localStorage !== 'undefined') {
                const localVal = originalGetItem.call(localStorage, key);
                if (localVal) {
                  window.localStorageCache[key] = localVal;
                  try {
                    const txWrite = db.transaction('catalogs', 'readwrite');
                    const storeWrite = txWrite.objectStore('catalogs');
                    storeWrite.put({ id: key, data: JSON.parse(localVal) });
                    originalRemoveItem.call(localStorage, key);
                  } catch (e) {
                    console.error(`[Bridge Migration] Error migrando ${key}:`, e);
                  }
                }
              }
            }
            completed++;
            if (completed === redirectedKeys.length) {
              window.localStorageCacheLoaded = true;
              resolve();
            }
          };
          req.onerror = () => {
            completed++;
            if (completed === redirectedKeys.length) {
              window.localStorageCacheLoaded = true;
              resolve();
            }
          };
        });
      } catch (txErr) {
        console.warn('[IndexedDB Bridge] Advertencia abriendo store catalogs:', txErr);
        resolve();
      }
    }).catch(() => resolve());
  });
}

// Aplicar parche a Storage.prototype si corre en navegador
let originalGetItem, originalSetItem, originalRemoveItem, originalClear;

if (typeof window !== 'undefined' && typeof Storage !== 'undefined') {
  window.localStorageCache = window.localStorageCache || {};
  window.localStorageCacheLoaded = window.localStorageCacheLoaded || false;
  window.initLocalStorageIndexedDBBridge = initLocalStorageIndexedDBBridge;

  originalGetItem = Storage.prototype.getItem;
  originalSetItem = Storage.prototype.setItem;
  originalRemoveItem = Storage.prototype.removeItem;
  originalClear = Storage.prototype.clear;

  Storage.prototype.getItem = function(key) {
    if (this === localStorage && redirectedKeys.includes(key)) {
      if (key in window.localStorageCache) {
        return window.localStorageCache[key];
      }
      return originalGetItem.call(this, key);
    }
    return originalGetItem.call(this, key);
  };

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && redirectedKeys.includes(key)) {
      window.localStorageCache[key] = value;
      originalRemoveItem.call(this, key);
      try {
        let parsedData = JSON.parse(value);
        scheduleDbWrite(key, parsedData);
      } catch (e) {
        console.error('[IndexedDB Bridge] Error al parsear para guardar:', key, e);
      }
      return;
    }
    try {
      return originalSetItem.call(this, key, value);
    } catch (quotaErr) {
      console.warn('[LocalStorage] Advertencia: Cuota de almacenamiento excedida para ' + key + ':', quotaErr?.message);
    }
  };

  Storage.prototype.removeItem = function(key) {
    if (this === localStorage && redirectedKeys.includes(key)) {
      delete window.localStorageCache[key];
      (async () => {
        try {
          const db = await new Promise((res) => {
            const req = indexedDB.open('SapiOfflineDB', 2);
            req.onsuccess = (ev) => res(ev.target.result);
            req.onerror = () => res(null);
          });
          if (db) {
            const tx = db.transaction('catalogs', 'readwrite');
            const store = tx.objectStore('catalogs');
            store.delete(key);
          }
        } catch (e) {}
      })();
    }
    return originalRemoveItem.call(this, key);
  };

  Storage.prototype.clear = function() {
    if (this === localStorage) {
      window.localStorageCache = {};
      (async () => {
        try {
          const db = await new Promise((res) => {
            const req = indexedDB.open('SapiOfflineDB', 2);
            req.onsuccess = (ev) => res(ev.target.result);
            req.onerror = () => res(null);
          });
          if (db) {
            const tx = db.transaction('catalogs', 'readwrite');
            const store = tx.objectStore('catalogs');
            store.clear();
          }
        } catch (e) {}
      })();
    }
    return originalClear.call(this);
  };
}
