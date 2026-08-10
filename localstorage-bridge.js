// --- LOCALSTORAGE TO INDEXEDDB BRIDGE (QuotaExceededError Fix) ---
(function() {
  window.localStorageCache = {};
  window.localStorageCacheLoaded = false;
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;
  const redirectedKeys = ['sapi_refacciones_db', 'eurorep_pedidos_sap', 'eurorep_cotizaciones_sap', 'sapi_tickets', 'sapi_ordenes', 'sapi_levantamientos', 'sapi_sync_queue'];

  window.initLocalStorageIndexedDBBridge = function() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve();
        return;
      }
      const request = indexedDB.open('SapiOfflineDB', 2);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('catalogs')) {
          db.createObjectStore('catalogs', { keyPath: 'id' });
        }
      };
      request.onerror = () => resolve();
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('catalogs', 'readonly');
        const store = tx.objectStore('catalogs');
        let completed = 0;
        
        redirectedKeys.forEach(key => {
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result && req.result.data) {
              window.localStorageCache[key] = JSON.stringify(req.result.data);
              originalRemoveItem.call(localStorage, key);
            } else {
              // MIGRACIÓN: Si existe en localStorage real pero no en IndexedDB
              const localVal = originalGetItem.call(localStorage, key);
              if (localVal) {
                window.localStorageCache[key] = localVal;
                try {
                  const txWrite = db.transaction('catalogs', 'readwrite');
                  const storeWrite = txWrite.objectStore('catalogs');
                  storeWrite.put({ id: key, data: JSON.parse(localVal) });
                  originalRemoveItem.call(localStorage, key);
                  console.log(`[Bridge Migration] Migrado ${key} a IndexedDB y liberado localStorage.`);
                } catch (e) {
                  console.error(`[Bridge Migration] Error migrando ${key}:`, e);
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
      };
    });
  };

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
      (async () => {
        try {
          let parsedData = JSON.parse(value);
          const db = await new Promise((res) => {
            const req = indexedDB.open('SapiOfflineDB', 2);
            req.onsuccess = (ev) => res(ev.target.result);
            req.onerror = () => res(null);
          });
          if (db) {
            const tx = db.transaction('catalogs', 'readwrite');
            const store = tx.objectStore('catalogs');
            store.put({ id: key, data: parsedData });
          }
        } catch (e) {
          console.error('[IndexedDB Bridge] Error al guardar:', key, e);
        }
      })();
      return;
    }
    return originalSetItem.call(this, key, value);
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
})();
