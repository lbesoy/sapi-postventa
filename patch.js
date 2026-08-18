window.verDetallesSincronizacion = function() {
  try {
    const queue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
    const oldModal = document.getElementById('sapi-dynamic-sync-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sapi-dynamic-sync-modal';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(5px)';
    overlay.style.zIndex = '9999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';
    
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    const modal = document.createElement('div');
    modal.style.backgroundColor = 'var(--bg-card, #ffffff)';
    modal.style.borderRadius = '16px';
    modal.style.width = '100%';
    modal.style.maxWidth = '550px';
    modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';
    modal.style.border = '1px solid var(--border, #e5e7eb)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.overflow = 'hidden';
    modal.style.color = 'var(--text-primary, #111827)';

    const header = document.createElement('div');
    header.style.padding = '1.25rem 1.5rem';
    header.style.borderBottom = '1px solid var(--border, #e5e7eb)';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    
    const title = document.createElement('h2');
    title.textContent = queue.length === 0 ? 'Estado del Sistema' : 'Cambios Pendientes (' + queue.length + ')';
    title.style.margin = '0';
    title.style.fontSize = '1.25rem';
    title.style.fontWeight = '700';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = 'var(--text-secondary, #6b7280)';
    closeBtn.onclick = () => overlay.remove();
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.padding = '1.5rem';
    body.style.maxHeight = '60vh';
    body.style.overflowY = 'auto';
    
    if (queue.length === 0) {
      body.innerHTML = `
        <div style="text-align:center; color:var(--text-muted, #6b7280); padding: 1rem;">
          <p style="margin:0 0 1rem 0;">Todos tus cambios locales están guardados.</p>
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">✅</div>
        </div>
      `;
    } else {
      const p = document.createElement('p');
      p.textContent = 'Los siguientes cambios se realizaron localmente y están esperando a subir:';
      p.style.margin = '0 0 1rem 0';
      p.style.fontSize = '0.9rem';
      p.style.color = 'var(--text-secondary, #4b5563)';
      body.appendChild(p);
      
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '0.75rem';
      
      queue.forEach((item, index) => {
        const itemBox = document.createElement('div');
        itemBox.style.border = '1px solid var(--border, #e5e7eb)';
        itemBox.style.borderRadius = '10px';
        itemBox.style.padding = '1rem';
        itemBox.style.backgroundColor = 'var(--bg-hover, #f9fafb)';
        
        let desc = 'Sin descripción';
        if (item && item.data) {
          desc = item.data.folio || item.data.asunto || item.data.nombre || item.data.cliente || item.data.id || 'Registro en ' + item.table;
        }
        
        itemBox.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <div style="display:flex; gap:0.5rem;">
              <span style="font-size:0.7rem; font-weight:700; background:rgba(232,130,12,0.1); color:var(--accent,#e8820c); padding:0.2rem 0.5rem; border-radius:6px; border:1px solid rgba(232,130,12,0.2);">${item.table || 'DESCONOCIDO'}</span>
              <span style="font-size:0.7rem; font-weight:700; background:#e5e7eb; color:#4b5563; padding:0.2rem 0.5rem; border-radius:6px;">${item.action || 'UPSERT'}</span>
            </div>
            <button class="sapi-del-queue-btn" data-index="${index}" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:1.1rem; padding:0 5px;" title="Ignorar y borrar">✕</button>
          </div>
          <div style="font-size:0.85rem; font-weight:600; word-break:break-word;">${desc}</div>
        `;
        list.appendChild(itemBox);
      });
      body.appendChild(list);
    }

    // Agregar banner de estado de sincronización (Online/Offline)
    const isOffline = !navigator.onLine && !window.isConnectionVerifiedOnline;
    const lastSyncStr = localStorage.getItem('sapi_last_sync_timestamp') || window.lastSyncTimestamp;
    let lastSyncFormatted = 'Nunca';
    if (lastSyncStr) {
      try {
        const d = new Date(lastSyncStr);
        lastSyncFormatted = d.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } catch (e) {
        lastSyncFormatted = lastSyncStr;
      }
    }

    const statusBanner = document.createElement('div');
    statusBanner.style.marginBottom = '1.25rem';
    statusBanner.style.padding = '0.85rem 1rem';
    statusBanner.style.borderRadius = '10px';
    statusBanner.style.fontSize = '0.85rem';
    statusBanner.style.color = 'var(--text-secondary, #4b5563)';
    statusBanner.style.display = 'flex';
    statusBanner.style.gap = '0.5rem';
    statusBanner.style.alignItems = 'flex-start';

    if (isOffline) {
      statusBanner.style.backgroundColor = 'rgba(232, 130, 12, 0.05)';
      statusBanner.style.border = '1px solid rgba(232, 130, 12, 0.2)';
      statusBanner.innerHTML = `
        <i data-lucide="wifi-off" style="width:16px; height:16px; color:var(--accent,#e8820c); flex-shrink:0; margin-top:0.1rem;"></i>
        <div>
          <span style="font-weight:600; color:var(--text-primary,#111827);">Modo fuera de línea</span>
          <div style="margin-top:0.2rem;">Cuando está fuera de línea se podrá ver a qué hora fue la última vez que se sincronizó.</div>
          <div style="margin-top:0.4rem; font-size:0.78rem; font-weight:700; color:var(--accent,#e8820c);">Última sincronización: ${lastSyncFormatted}</div>
        </div>
      `;
    } else {
      statusBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
      statusBanner.style.border = '1px solid rgba(16, 185, 129, 0.2)';
      statusBanner.innerHTML = `
        <i data-lucide="wifi" style="width:16px; height:16px; color:var(--green,#10b981); flex-shrink:0; margin-top:0.1rem;"></i>
        <div>
          <span style="font-weight:600; color:var(--text-primary,#111827);">Conectado a Supabase</span>
          <div style="margin-top:0.2rem;">El sistema se encuentra sincronizado en tiempo real.</div>
          <div style="margin-top:0.4rem; font-size:0.78rem; font-weight:700; color:var(--green,#10b981);">Última sincronización: ${lastSyncFormatted}</div>
        </div>
      `;
    }
    body.insertBefore(statusBanner, body.firstChild);
    
    const footer = document.createElement('div');
    footer.style.padding = '1rem 1.5rem';
    footer.style.borderTop = '1px solid var(--border, #e5e7eb)';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '0.75rem';
    footer.style.backgroundColor = 'var(--bg-body, #f3f4f6)';
    
    const closeAction = document.createElement('button');
    closeAction.textContent = 'Cerrar';
    closeAction.className = 'btn-secondary';
    closeAction.onclick = () => overlay.remove();
    
    const syncAction = document.createElement('button');
    syncAction.textContent = 'Sincronizar Ahora';
    syncAction.className = 'btn-primary';
    syncAction.onclick = () => {
      overlay.remove();
      if (typeof window.forzarSincronizacionManual === 'function') {
        window.forzarSincronizacionManual();
      }
    };
    
    footer.appendChild(closeAction);
    footer.appendChild(syncAction);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const delBtns = overlay.querySelectorAll('.sapi-del-queue-btn');
    delBtns.forEach(btn => {
      btn.onclick = function(e) {
        if (confirm('¿Seguro que deseas eliminar este cambio local? Se perderán los datos.')) {
          const idx = parseInt(this.getAttribute('data-index'), 10);
          let currentQueue = JSON.parse(localStorage.getItem('sapi_sync_queue') || '[]');
          currentQueue.splice(idx, 1);
          localStorage.setItem('sapi_sync_queue', JSON.stringify(currentQueue));
          overlay.remove();
          window.verDetallesSincronizacion();
          if (window.updateSyncStatusUI) window.updateSyncStatusUI();
        }
      };
    });

  } catch (err) {
    console.error('[Sync] Excepción:', err);
    alert('Error abriendo modal: ' + err.message);
  }
};
