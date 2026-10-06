/**
 * Eurorep SAPI - Almacén de Estado Reactivo Centralizado (Store)
 * Archivo: src/store.js
 *
 * Proporciona un patrón Store centralizado y reactivo con Pub/Sub.
 * Permite suscribirse a cambios en colecciones (tickets, ordenes, clientes, etc.)
 * y sincronizar automáticamente la UI, memoria y almacenamiento persistente.
 */

function createStore(initialState = {}) {
  const subscribers = new Map();
  const state = { ...initialState };

  const store = {
    getState(key) {
      if (!key) return { ...state };
      return state[key];
    },
    setState(key, value, options = { notify: true, persist: true }) {
      const prev = state[key];
      state[key] = value;

      if (typeof window !== 'undefined') {
        window[key] = value;
        if (options.persist && typeof window.safeSetJSON === 'function') {
          const storageKey = key === 'tickets' ? 'sapi_tickets' :
                             key === 'ordenes' ? 'sapi_ordenes' :
                             key === 'clientesDb' ? 'sapi_clientes_db' :
                             key === 'maquinariaDb' ? 'sapi_maquinaria_db' :
                             key === 'sitiosDb' ? 'sapi_sitios_db' :
                             key === 'gastos' ? 'sapi_gastos' : null;
          if (storageKey) window.safeSetJSON(storageKey, value);
        }
      }

      if (options.notify) {
        store.emit(key, value, prev);
        store.emit('*', { key, value, prev });
      }
      return value;
    },
    subscribe(key, callback) {
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key).add(callback);
      return () => {
        const subs = subscribers.get(key);
        if (subs) subs.delete(callback);
      };
    },
    emit(key, ...args) {
      const subs = subscribers.get(key);
      if (subs) {
        subs.forEach(cb => {
          try {
            cb(...args);
          } catch (e) {
            console.error(`[Store] Error en suscriptor de "${key}":`, e);
          }
        });
      }
    },
    // Métodos de conveniencia para Entidades
    addTicket(ticket) {
      const current = store.getState('tickets') || [];
      const updated = [ticket, ...current];
      return store.setState('tickets', updated);
    },
    updateTicket(id, changes) {
      const current = store.getState('tickets') || [];
      const updated = current.map(t => t.id === id ? { ...t, ...changes } : t);
      return store.setState('tickets', updated);
    },
    removeTicket(id) {
      const current = store.getState('tickets') || [];
      const updated = current.filter(t => t.id !== id);
      return store.setState('tickets', updated);
    },
    addOrden(orden) {
      const current = store.getState('ordenes') || [];
      const updated = [orden, ...current];
      return store.setState('ordenes', updated);
    },
    updateOrden(id, changes) {
      const current = store.getState('ordenes') || [];
      const updated = current.map(o => o.id === id ? { ...o, ...changes } : o);
      return store.setState('ordenes', updated);
    },
    removeOrden(id) {
      const current = store.getState('ordenes') || [];
      const updated = current.filter(o => o.id !== id);
      return store.setState('ordenes', updated);
    }
  };

  return store;
}

const store = createStore();

if (typeof window !== 'undefined') {
  window.SAPIStore = store;
  window.createStore = createStore;
}

export { createStore, store };
export default store;
