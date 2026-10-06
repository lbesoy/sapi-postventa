/**
 * Eurorep SAPI - Almacén de Estado Reactivo Centralizado (Bundle UMD)
 * Archivo: store.js
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exp = factory();
    root.SAPIStore = exp.store;
    root.createStore = exp.createStore;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function createStore(initialState) {
    initialState = initialState || {};
    var subscribers = new Map();
    var state = Object.assign({}, initialState);

    var s = {
      getState: function(key) {
        if (!key) return Object.assign({}, state);
        return state[key];
      },
      setState: function(key, value, options) {
        options = options || { notify: true, persist: true };
        var prev = state[key];
        state[key] = value;

        if (typeof window !== 'undefined') {
          window[key] = value;
          if (options.persist && typeof window.safeSetJSON === 'function') {
            var storageKey = key === 'tickets' ? 'sapi_tickets' :
                             key === 'ordenes' ? 'sapi_ordenes' :
                             key === 'clientesDb' ? 'sapi_clientes_db' :
                             key === 'maquinariaDb' ? 'sapi_maquinaria_db' :
                             key === 'sitiosDb' ? 'sapi_sitios_db' :
                             key === 'gastos' ? 'sapi_gastos' : null;
            if (storageKey) window.safeSetJSON(storageKey, value);
          }
        }

        if (options.notify) {
          s.emit(key, value, prev);
          s.emit('*', { key: key, value: value, prev: prev });
        }
        return value;
      },
      subscribe: function(key, callback) {
        if (!subscribers.has(key)) subscribers.set(key, new Set());
        subscribers.get(key).add(callback);
        return function() {
          var subs = subscribers.get(key);
          if (subs) subs.delete(callback);
        };
      },
      emit: function(key) {
        var args = Array.prototype.slice.call(arguments, 1);
        var subs = subscribers.get(key);
        if (subs) {
          subs.forEach(function(cb) {
            try {
              cb.apply(null, args);
            } catch (e) {
              console.error('[Store] Error en suscriptor de "' + key + '":', e);
            }
          });
        }
      },
      addTicket: function(ticket) {
        var current = s.getState('tickets') || [];
        var updated = [ticket].concat(current);
        return s.setState('tickets', updated);
      },
      updateTicket: function(id, changes) {
        var current = s.getState('tickets') || [];
        var updated = current.map(function(t) { return t.id === id ? Object.assign({}, t, changes) : t; });
        return s.setState('tickets', updated);
      },
      removeTicket: function(id) {
        var current = s.getState('tickets') || [];
        var updated = current.filter(function(t) { return t.id !== id; });
        return s.setState('tickets', updated);
      },
      addOrden: function(orden) {
        var current = s.getState('ordenes') || [];
        var updated = [orden].concat(current);
        return s.setState('ordenes', updated);
      },
      updateOrden: function(id, changes) {
        var current = s.getState('ordenes') || [];
        var updated = current.map(function(o) { return o.id === id ? Object.assign({}, o, changes) : o; });
        return s.setState('ordenes', updated);
      },
      removeOrden: function(id) {
        var current = s.getState('ordenes') || [];
        var updated = current.filter(function(o) { return o.id !== id; });
        return s.setState('ordenes', updated);
      }
    };

    return s;
  }

  var defaultStore = createStore();
  return { createStore: createStore, store: defaultStore };
});
