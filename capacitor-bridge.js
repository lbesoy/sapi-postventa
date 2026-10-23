/**
 * Bridge de Integración Nativa Capacitor para Android - Eurorep / SAPI
 * Proporciona soporte para hardware: Botón atrás de Android, Cámara nativa,
 * Geolocalización precisa, Status Bar, Splash Screen y Conectividad Offline.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.keys(exports).forEach(function(k) {
      root[k] = exports[k];
      if (typeof window !== 'undefined') window[k] = exports[k];
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function() {
  "use strict";

  var ptrInitialized = false;
  var isPtrRefreshing = false;

  function checkIsNative() {
    return !!(typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  }

  function initCapacitorAndroid() {
    if (typeof document === 'undefined') return;
    const isNative = checkIsNative();

    if (isNative) {
      document.body.classList.add('is-native-app', 'is-android');
      try {
        window.scrollTo(0, 0);
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflowX = 'hidden';
      } catch (eScroll) {}

      // 1. Status Bar nativa con paleta Eurorep adaptativa (Modo Oscuro / Modo Claro)
      if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('StatusBar')) {
        try {
          const { StatusBar, Style } = window.Capacitor.Plugins;
          if (StatusBar) {
            const isLight = (document.body && document.body.classList.contains('light-mode')) ||
              (typeof localStorage !== 'undefined' && (localStorage.getItem('eurorep_darkmode') === 'false' || localStorage.getItem('theme_mode') === 'light'));
            StatusBar.setStyle({ style: isLight ? (Style?.Light || 'LIGHT') : (Style?.Dark || 'DARK') }).catch(function() {});
            StatusBar.setBackgroundColor({ color: isLight ? '#ffffff' : '#12141c' }).catch(function() {});
            StatusBar.setOverlaysWebView({ overlay: false }).catch(function() {});
          }
        } catch (e) {
          console.warn('[Capacitor] StatusBar init warning:', e);
        }
      }

      // 2. Ocultar SplashScreen
      if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('SplashScreen')) {
        setTimeout(function() {
          try {
            if (window.Capacitor.Plugins.SplashScreen) {
              window.Capacitor.Plugins.SplashScreen.hide();
            }
          } catch (e) {}
        }, 800);
      }

      // 3. Manejo del botón físico "Atrás" de Android
      if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('App')) {
        try {
          const { App } = window.Capacitor.Plugins;
          let lastBackPressTime = 0;

          App.addListener('backButton', function() {
            // 0. Hoja inferior "Más" abierta: cerrarla
            if (typeof window.isMobileMoreSheetOpen === 'function' && window.isMobileMoreSheetOpen()) {
              if (typeof window.closeMobileMoreSheet === 'function') {
                window.closeMobileMoreSheet();
                return;
              }
            } else {
              const sheetEl = document.getElementById('mobile-more-sheet');
              if (sheetEl && sheetEl.classList.contains('open')) {
                if (typeof window.closeMobileMoreSheet === 'function') {
                  window.closeMobileMoreSheet();
                } else {
                  sheetEl.classList.remove('open');
                  const backdropEl = document.getElementById('mobile-more-backdrop');
                  if (backdropEl) backdropEl.classList.remove('open');
                }
                return;
              }
            }

            // 0.1 Si el panel de notificaciones está abierto: cerrarlo
            const notifDd = document.getElementById('notification-dropdown');
            if (notifDd && notifDd.style.display !== 'none' && notifDd.style.display !== '') {
              notifDd.style.display = 'none';
              return;
            }
            const intNotifDd = document.getElementById('internal-notification-dropdown');
            if (intNotifDd && intNotifDd.style.display !== 'none' && intNotifDd.style.display !== '') {
              intNotifDd.style.display = 'none';
              return;
            }

            // A) Verificar si hay algún modal abierto y cerrarlo
            const modales = Array.from(document.querySelectorAll('.modal-overlay, .modal-backdrop'));
            const modalAbierto = modales.reverse().find(function(m) {
              const comp = window.getComputedStyle(m);
              return comp.display !== 'none' && comp.visibility !== 'hidden' && comp.opacity !== '0';
            });

            if (modalAbierto) {
              const closeBtn = modalAbierto.querySelector('.btn-close, .modal-close, button[onclick*="remove"], button[onclick*="cerrar"], [data-action="close"]');
              if (closeBtn) {
                closeBtn.click();
              } else if (typeof modalAbierto.remove === 'function') {
                modalAbierto.remove();
              } else {
                modalAbierto.style.display = 'none';
              }
              return;
            }

            // B) Visores de adjuntos o manuales
            const visorOverlay = document.getElementById('modal-visor-adjunto') || document.getElementById('modal-visor-manual-overlay');
            if (visorOverlay && visorOverlay.style.display !== 'none') {
              visorOverlay.style.display = 'none';
              return;
            }

            // C) Si estamos en una vista secundaria, regresar a la vista principal
            if (typeof window.currentView !== 'undefined' && window.currentView !== 'servicios' && window.currentView !== 'dashboard') {
              if (typeof window.showView === 'function') {
                const defaultView = (typeof window.currentSession !== 'undefined' && window.currentSession?.rol === 'tecnico') ? 'servicios' : 'dashboard';
                window.showView(defaultView);
                return;
              }
            }

            // D) Confirmación antes de salir de la aplicación
            const now = Date.now();
            if (now - lastBackPressTime < 2500) {
              App.exitApp();
            } else {
              lastBackPressTime = now;
              if (typeof window.showToast === 'function') {
                window.showToast('Presiona atrás de nuevo para salir de SAPI', 'info');
              } else if (typeof window.mostrarNotificacion === 'function') {
                window.mostrarNotificacion('Presiona atrás de nuevo para salir', 'info');
              }
            }
          });
        } catch (eApp) {
          console.warn('[Capacitor] App plugin listener warning:', eApp);
        }
      }

      // 4. Detección de conectividad de red nativa (Network)
      if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Network')) {
        try {
          const { Network } = window.Capacitor.Plugins;
          Network.addListener('networkStatusChange', function(status) {
            console.log('[Capacitor Network] Cambio de conectividad:', status.connected ? 'ONLINE' : 'OFFLINE');
            if (status.connected) {
              if (typeof window.sincronizarPendientesSupabase === 'function') {
                window.sincronizarPendientesSupabase();
              }
              if (typeof window.syncSupabase === 'function') {
                window.syncSupabase();
              }
              if (typeof window.showToast === 'function') {
                window.showToast('Conexión reestablecida: Datos sincronizados con el servidor.', 'success');
              }
            } else {
              if (typeof window.showToast === 'function') {
                window.showToast('Modo Offline: Puedes seguir capturando reportes y bitácoras.', 'info');
              }
            }
          });
        } catch (eNet) {
          console.warn('[Capacitor] Network listener warning:', eNet);
        }
      }

      // 5. Inicializar Botón Flotante (FAB) en App Móvil
      updateMobileFabVisibility();

      // 6. Inicializar Gesto Táctil Deslizar para Actualizar (Pull-to-Refresh)
      initPullToRefresh();

      // 7. Inicializar Notificaciones Push Nativas (FCM / Firebase)
      initPushNotifications();
    } else if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      updateMobileFabVisibility();
      initPullToRefresh();
    }
  }

  /**
   * Compresión automática de imágenes vía Canvas (utilizable en Web y fallback)
   */
  function comprimirImagenDataUrl(fileOrBlob, maxDimension, quality) {
    return new Promise(function(resolve, reject) {
      maxDimension = maxDimension || 1400;
      quality = quality || 0.75;
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let w = img.width;
          let h = img.height;
          if (w > maxDimension || h > maxDimension) {
            if (w > h) {
              h = Math.round((h * maxDimension) / w);
              w = maxDimension;
            } else {
              w = Math.round((w * maxDimension) / h);
              h = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
  }

  /**
   * Captura de foto nativa con compresión automática
   * Retorna DataURL base64 comprimido o null si el usuario canceló
   */
  async function capturarFotoNativa(options) {
    options = options || {};
    const sourceType = options.sourceType || 'camera'; // 'camera' | 'photos' | 'prompt'
    const quality = options.quality || 75;
    const maxWidth = options.maxWidth || 1400;

    if (checkIsNative() && window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Camera')) {
      try {
        const { Camera, CameraResultType, CameraSource } = window.Capacitor.Plugins;
        let src = CameraSource.Camera;
        if (sourceType === 'photos') src = CameraSource.Photos;
        else if (sourceType === 'prompt') src = CameraSource.Prompt;

        const image = await Camera.getPhoto({
          quality: quality,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: src,
          width: maxWidth,
          height: maxWidth,
          correctOrientation: true,
          saveToGallery: false
        });
        return image.dataUrl;
      } catch (err) {
        if (err.message && (err.message.includes('User cancelled') || err.message.includes('canceled') || err.message.includes('cancel'))) {
          return null;
        }
        console.warn('[Capacitor Camera] Error en captura nativa, recurriendo a selector web:', err);
      }
    }

    // Fallback Web: abrir input file con selector de cámara y comprimir en canvas
    return new Promise(function(resolve) {
      if (typeof document === 'undefined') return resolve(null);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (sourceType === 'camera') {
        input.capture = 'environment';
      }
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = async function(e) {
        const file = e.target.files && e.target.files[0];
        try { document.body.removeChild(input); } catch(eIgn) {}
        if (!file) return resolve(null);
        try {
          const compressed = await comprimirImagenDataUrl(file, maxWidth, quality / 100);
          resolve(compressed);
        } catch (errCompress) {
          const reader = new FileReader();
          reader.onload = function(re) { resolve(re.target.result); };
          reader.onerror = function() { resolve(null); };
          reader.readAsDataURL(file);
        }
      };
      input.oncancel = function() {
        try { document.body.removeChild(input); } catch(eIgn) {}
        resolve(null);
      };
      input.click();
    });
  }

  /**
   * Obtener geolocalización nativa precisa
   */
  async function obtenerGeolocalizacionNativa(options) {
    options = options || {};
    if (checkIsNative() && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Geolocation')) {
      try {
        const { Geolocation } = window.Capacitor.Plugins;
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: options.timeout || 12000,
          maximumAge: 60000
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp
        };
      } catch (err) {
        console.warn('[Capacitor Geolocation] Error:', err);
      }
    }
    // Fallback a API del navegador
    return new Promise(function(resolve) {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        function(p) { resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }); },
        function() { resolve(null); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  /**
   * Acción del botón flotante principal (FAB) en App Móvil
   * Ejecuta la acción primaria según la vista activa del técnico
   */
  function handleMobileFabClick() {
    const view = (typeof window !== 'undefined' && window.currentView) ? window.currentView : 'dashboard';
    try {
      switch (view) {
        case 'servicios':
        case 'ordenes':
          if (typeof window !== 'undefined' && typeof window.abrirFormulario === 'function') {
            window.abrirFormulario();
          }
          break;

        case 'tickets':
          if (typeof window !== 'undefined' && typeof window.abrirTicket === 'function') {
            window.abrirTicket();
          }
          break;

        case 'levantamientos':
          if (typeof window !== 'undefined' && typeof window.abrirModalNuevoLevantamiento === 'function') {
            window.abrirModalNuevoLevantamiento();
          }
          break;

        case 'gastos':
          if (typeof window !== 'undefined' && typeof window.abrirModalGasto === 'function') {
            window.abrirModalGasto();
          }
          break;

        case 'envios':
          if (typeof window !== 'undefined' && typeof window.abrirModalNuevoEnvio === 'function') {
            window.abrirModalNuevoEnvio();
          }
          break;

        case 'calendario':
          if (typeof window !== 'undefined' && typeof window.abrirProgramarTecnico === 'function' && ['superadmin', 'admin', 'supervisor'].includes(window.currentSession?.viewMode || window.currentSession?.rol)) {
            window.abrirProgramarTecnico();
          } else if (typeof window !== 'undefined' && typeof window.abrirRegistrarActividad === 'function') {
            window.abrirRegistrarActividad();
          } else if (typeof window !== 'undefined' && typeof window.abrirFormulario === 'function') {
            window.abrirFormulario();
          }
          break;

        case 'dashboard':
        default:
          if (typeof window !== 'undefined' && typeof window.abrirFormulario === 'function') {
            window.abrirFormulario();
          } else if (typeof window !== 'undefined' && typeof window.showView === 'function') {
            window.showView('servicios');
          }
          break;
      }
    } catch (err) {
      console.error('[Capacitor FAB] Error ejecutando acción de FAB:', err);
    }
  }

  /**
   * Navegación programática unificada para móvil y desktop
   */
  function showView(viewName) {
    if (typeof document === 'undefined') return;
    const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navItem) {
      navItem.click();
      return;
    }
    const viewEl = document.getElementById('view-' + viewName);
    if (!viewEl) return;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    viewEl.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
      if (n.dataset.view === viewName) n.classList.add('active');
      else n.classList.remove('active');
    });
    const MORE_VIEWS = ['gastos', 'preferencias', 'levantamientos', 'envios'];
    const masNavItem = document.getElementById('nav-mobile-mas');
    if (masNavItem) {
      if (MORE_VIEWS.includes(viewName)) {
        masNavItem.classList.add('active');
      } else {
        masNavItem.classList.remove('active');
      }
    }
    if (typeof window !== 'undefined') {
      window.currentView = viewName;
      if (typeof window.updateMobileFabVisibility === 'function') {
        window.updateMobileFabVisibility(viewName);
      }
    }
  }

  /**
   * Control dinámico de visibilidad del Botón Flotante (FAB)
   * En Dashboard se oculta porque la pantalla principal ya tiene accesos directos táctiles en cuadrícula.
   * En otras vistas de técnicos se muestra con la acción rápida correspondiente.
   */
  function updateMobileFabVisibility(currentView) {
    const fab = document.getElementById('mobile-fab-container');
    if (!fab) return;
    const isMobile = (typeof window !== 'undefined' && (
      window.innerWidth <= 768 ||
      window.IS_MOBILE_APP ||
      (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
      (document.body && (document.body.classList.contains('is-native-app') || document.body.classList.contains('is-android')))
    ));
    if (!isMobile) {
      fab.classList.remove('visible');
      fab.classList.add('hidden');
      fab.style.display = 'none';
      return;
    }
    const view = currentView || (typeof window !== 'undefined' && window.currentView) || 'dashboard';
    if (view === 'dashboard' || view === 'servicios' || view === 'ordenes') {
      fab.classList.remove('visible');
      fab.classList.add('hidden');
      fab.style.display = 'none';
    } else {
      fab.classList.remove('hidden');
      fab.classList.add('visible');
      fab.style.display = 'flex';
    }
    if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function syncCapacitorStatusBar(isLightParam) {
    if (typeof window === 'undefined' || !window.Capacitor || !window.Capacitor.isPluginAvailable || !window.Capacitor.isPluginAvailable('StatusBar')) return;
    try {
      const { StatusBar, Style } = window.Capacitor.Plugins;
      if (!StatusBar) return;
      const isLight = typeof isLightParam === 'boolean'
        ? isLightParam
        : (document.body ? document.body.classList.contains('light-mode') : false);
      StatusBar.setStyle({ style: isLight ? (Style?.Light || 'LIGHT') : (Style?.Dark || 'DARK') }).catch(function() {});
      StatusBar.setBackgroundColor({ color: isLight ? '#ffffff' : '#12141c' }).catch(function() {});
    } catch (e) {}
  }

  /**
   * ============================================================
   * GESTO TÁCTIL PULL-TO-REFRESH (DESLIZAR PARA ACTUALIZAR)
   * ============================================================
   */
  function initPullToRefresh() {
    if (typeof document === 'undefined' || ptrInitialized) return;
    ptrInitialized = true;

    // Crear píldora indicadora en el DOM si no existe
    let ptrIndicator = document.getElementById('sapi-ptr-indicator');
    if (!ptrIndicator) {
      ptrIndicator = document.createElement('div');
      ptrIndicator.id = 'sapi-ptr-indicator';
      ptrIndicator.className = 'sapi-ptr-indicator';
      ptrIndicator.innerHTML = `
        <div class="sapi-ptr-pill">
          <i data-lucide="refresh-cw" class="sapi-ptr-icon" id="sapi-ptr-icon"></i>
          <span class="sapi-ptr-text" id="sapi-ptr-text">Desliza para actualizar...</span>
        </div>
      `;
      document.body.appendChild(ptrIndicator);
      if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }

    const iconEl = document.getElementById('sapi-ptr-icon');
    const textEl = document.getElementById('sapi-ptr-text');

    let touchStartY = 0;
    let touchStartX = 0;
    let isPulling = false;
    let pullDistance = 0;
    const PULL_THRESHOLD = 60;
    const MAX_PULL = 90;

    function isAtTopOfScroll() {
      if (window.scrollY > 5) return false;
      const activeView = document.querySelector('.view.active');
      if (activeView && activeView.scrollTop > 5) return false;
      return true;
    }

    function isModalOrSheetOpen() {
      const openModal = document.querySelector('.modal-overlay.open, .modal-backdrop.open');
      if (openModal) return true;
      const sheet = document.getElementById('mobile-more-sheet');
      if (sheet && sheet.classList.contains('open')) return true;
      return false;
    }

    document.addEventListener('touchstart', function(e) {
      if (isPtrRefreshing || isModalOrSheetOpen()) return;
      if (!isAtTopOfScroll()) return;
      const touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
      isPulling = false;
      pullDistance = 0;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (isPtrRefreshing || isModalOrSheetOpen()) return;
      if (!isAtTopOfScroll()) return;

      const touch = e.touches[0];
      const dy = touch.clientY - touchStartY;
      const dx = Math.abs(touch.clientX - touchStartX);

      // Si el movimiento es horizontal, ignorar
      if (dx > dy) return;

      if (dy > 12) {
        isPulling = true;
        pullDistance = Math.min(MAX_PULL, (dy - 12) * 0.45);
        if (ptrIndicator) {
          ptrIndicator.style.transform = `translateY(${pullDistance + 10}px)`;
          ptrIndicator.style.opacity = String(Math.min(1, pullDistance / 40));
        }

        if (pullDistance >= PULL_THRESHOLD) {
          if (textEl) textEl.textContent = 'Suelta para actualizar';
          if (iconEl) iconEl.style.transform = 'rotate(180deg)';
        } else {
          if (textEl) textEl.textContent = 'Desliza para actualizar...';
          if (iconEl) iconEl.style.transform = 'rotate(' + (pullDistance * 2.5) + 'deg)';
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', async function() {
      if (!isPulling || isPtrRefreshing) return;
      isPulling = false;

      if (pullDistance >= PULL_THRESHOLD) {
        // Disparar sincronización
        isPtrRefreshing = true;
        if (ptrIndicator) {
          ptrIndicator.classList.add('ptr-refreshing');
          ptrIndicator.style.transform = 'translateY(70px)';
          ptrIndicator.style.opacity = '1';
        }
        if (textEl) textEl.textContent = 'Sincronizando con el servidor...';
        if (iconEl) iconEl.style.transform = '';

        if (navigator.vibrate) {
          try { navigator.vibrate(25); } catch(e) {}
        }

        try {
          await ejecutarSincronizacionPullToRefresh();
          if (textEl) textEl.textContent = '¡Datos actualizados!';
          if (navigator.vibrate) {
            try { navigator.vibrate([15, 40, 15]); } catch(e) {}
          }
          await new Promise(r => setTimeout(r, 600));
        } catch (errSync) {
          console.warn('[PTR] Error durante sincronización:', errSync);
          if (textEl) textEl.textContent = 'Actualizado localmente';
          await new Promise(r => setTimeout(r, 500));
        } finally {
          if (ptrIndicator) {
            ptrIndicator.style.transform = 'translateY(0)';
            ptrIndicator.style.opacity = '0';
            setTimeout(() => {
              ptrIndicator.classList.remove('ptr-refreshing');
              if (textEl) textEl.textContent = 'Desliza para actualizar...';
              isPtrRefreshing = false;
            }, 300);
          } else {
            isPtrRefreshing = false;
          }
        }
      } else {
        // No llegó al threshold, retraer
        if (ptrIndicator) {
          ptrIndicator.style.transform = 'translateY(0)';
          ptrIndicator.style.opacity = '0';
        }
      }
      pullDistance = 0;
    }, { passive: true });
  }

  async function ejecutarSincronizacionPullToRefresh() {
    // 1. Sincronizar cola offline hacia Supabase
    if (typeof window.sincronizarPendientesSupabase === 'function') {
      try { await window.sincronizarPendientesSupabase(); } catch (eQ) {}
    } else if (typeof window.syncSupabase === 'function') {
      try { await window.syncSupabase(); } catch (eS) {}
    }

    // 2. Descargar datos frescos de Supabase
    if (typeof window.cargarDatosDeSupabase === 'function') {
      try { await window.cargarDatosDeSupabase(); } catch (eD) {}
    }

    // 3. Re-renderizar la vista actual activa
    const curView = (typeof window.currentView !== 'undefined') ? window.currentView : 'servicios';
    try {
      if (curView === 'servicios' || curView === 'ordenes') {
        if (typeof window.renderTabla === 'function') window.renderTabla();
      } else if (curView === 'levantamientos') {
        if (typeof window.renderLevantamientos === 'function') window.renderLevantamientos();
      } else if (curView === 'envios') {
        if (typeof window.renderEnviosCards === 'function') window.renderEnviosCards();
      } else if (curView === 'gastos') {
        if (typeof window.renderGastos === 'function') window.renderGastos();
      } else if (curView === 'calendario') {
        if (typeof window.recargarCalendario === 'function') window.recargarCalendario();
        else if (window.calendarInstance && typeof window.calendarInstance.refetchEvents === 'function') window.calendarInstance.refetchEvents();
      } else if (curView === 'dashboard') {
        if (typeof window.renderDashboardStats === 'function') window.renderDashboardStats();
      }
    } catch (eRender) {
      console.warn('[PTR] Error re-renderizando vista activa:', eRender);
    }
  }

  /**
   * ============================================================
   * NOTIFICACIONES PUSH NATIVAS (FCM / FIREBASE CLOUD MESSAGING)
   * ============================================================
   */
  function initPushNotifications() {
    if (typeof window === 'undefined') return;
    if (!checkIsNative() || !window.Capacitor || !window.Capacitor.isPluginAvailable || !window.Capacitor.isPluginAvailable('PushNotifications')) {
      console.log('[Push] Plugin PushNotifications no activo o esperando vinculación de google-services.json.');
      return;
    }

    try {
      const { PushNotifications } = window.Capacitor.Plugins;
      if (!PushNotifications) return;

      // 1. Solicitar permisos de notificación nativa (Android 13+ POST_NOTIFICATIONS)
      PushNotifications.requestPermissions().then(result => {
        if (result && result.receive === 'granted') {
          PushNotifications.register();
        } else {
          console.log('[Push] Permiso de notificaciones:', result ? result.receive : 'denegado');
        }
      }).catch(err => {
        console.warn('[Push] Error solicitando permisos de push:', err);
      });

      // 2. Registro exitoso y obtención del FCM Registration Token
      PushNotifications.addListener('registration', token => {
        console.log('[Push] FCM Token registrado con éxito:', token ? token.value : 'N/A');
        if (token && token.value) {
          localStorage.setItem('sapi_fcm_token', token.value);
          registrarFcmTokenEnBackend(token.value);
        }
      });

      // 3. Error en el registro
      PushNotifications.addListener('registrationError', err => {
        console.warn('[Push] Error en registro de FCM:', err ? err.error : err);
      });

      // 4. Recepción en primer plano (Foreground)
      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[Push] Notificación recibida en primer plano:', notification);
        const title = notification.title || 'Eurorep SAPI';
        const body = notification.body || 'Tienes una nueva actualización';
        if (typeof window.showToast === 'function') {
          window.showToast(`${title}: ${body}`, 'info');
        } else if (typeof window.mostrarNotificacion === 'function') {
          window.mostrarNotificacion(`${title}: ${body}`, 'info');
        }
        if (navigator.vibrate) {
          try { navigator.vibrate([80, 50, 80]); } catch(e) {}
        }
        if (typeof window.cargarNotificaciones === 'function') {
          window.cargarNotificaciones();
        }
      });

      // 5. Clic sobre la notificación nativa (Background / Deep Link)
      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        console.log('[Push] Clic en notificación push:', action);
        const data = (action && action.notification && action.notification.data) || {};
        if (data.ordenId && typeof window.verDetalle === 'function') {
          if (typeof window.showView === 'function') window.showView('servicios');
          setTimeout(() => {
            window.verDetalle(data.ordenId);
          }, 350);
        } else if (data.view && typeof window.showView === 'function') {
          window.showView(data.view);
        }
      });
    } catch (ePush) {
      console.warn('[Push] Excepción al configurar Push Notifications:', ePush);
    }
  }

  function registrarFcmTokenEnBackend(token) {
    if (!token || typeof window === 'undefined') return;
    try {
      const session = (window.currentSession) || (function() {
        try { return JSON.parse(localStorage.getItem('sapi_session') || '{}'); } catch(e) { return {}; }
      })();
      if (session && session.id && window.supabaseClient) {
        window.supabaseClient
          .from('usuarios')
          .update({ fcm_token: token, updated_at: new Date().toISOString() })
          .eq('id', session.id)
          .then(({ error }) => {
            if (error) {
              console.log('[Push] Columna fcm_token en espera de migración en BD remota.');
            } else {
              console.log('[Push] Token FCM vinculado al usuario:', session.nombre || session.id);
            }
          }).catch(() => {});
      }
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    window.showView = showView;
    window.handleMobileFabClick = handleMobileFabClick;
    window.updateMobileFabVisibility = updateMobileFabVisibility;
    window.syncCapacitorStatusBar = syncCapacitorStatusBar;
    window.capturarFotoNativa = capturarFotoNativa;
    window.comprimirImagenDataUrl = comprimirImagenDataUrl;
    window.initPullToRefresh = initPullToRefresh;
    window.initPushNotifications = initPushNotifications;
    window.ejecutarSincronizacionPullToRefresh = ejecutarSincronizacionPullToRefresh;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCapacitorAndroid);
    } else {
      initCapacitorAndroid();
    }
  }

  return {
    isNativeApp: checkIsNative,
    initCapacitorAndroid: initCapacitorAndroid,
    capturarFotoNativa: capturarFotoNativa,
    comprimirImagenDataUrl: comprimirImagenDataUrl,
    obtenerGeolocalizacionNativa: obtenerGeolocalizacionNativa,
    handleMobileFabClick: handleMobileFabClick,
    updateMobileFabVisibility: updateMobileFabVisibility,
    syncCapacitorStatusBar: syncCapacitorStatusBar,
    showView: showView,
    initPullToRefresh: initPullToRefresh,
    initPushNotifications: initPushNotifications
  };
});
