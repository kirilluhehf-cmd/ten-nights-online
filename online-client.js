(() => {
  const $ = id => document.getElementById(id);
  let socket = null, roomCode = '';
  function status(msg) { const el = $('online-status'); if (el) el.textContent = msg; }
  function connect() {
    if (socket && socket.connected) return true;
    if (typeof window.io !== 'function') { status('Онлайн-модуль не загрузился. Открой игру через размещённый сервер.'); return false; }
    if (!socket) {
      socket = window.io();
      socket.on('connect', () => status('Подключено к серверу. Создай комнату или введи код.'));
      socket.on('connect_error', () => status('Нет связи с сервером. Проверь адрес и интернет.'));
      socket.on('room:peer', d => status(d.connected ? 'Друг подключился! Выберите разные камеры.' : 'Друг отключился. Можно подождать его.'));
      socket.on('player:state', d => {
        const el = $('remote-camera-status');
        if (el) el.textContent = d.tabletOpen ? `Друг смотрит CAM ${d.camera}` : 'Друг сейчас не смотрит камеры';
      });
      socket.on('room:joined', d => { roomCode = d.code; status(`Комната ${roomCode}. Отправь код другу.`); if ($('online-room-code')) $('online-room-code').textContent = roomCode; });
    }
    return true;
  }
  function openPanel() { const p = $('online-panel'); if (p) p.style.display = 'flex'; connect(); }
  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.querySelector('.menu-buttons');
    if (menu && !$('online-menu-btn')) {
      const b = document.createElement('button'); b.id = 'online-menu-btn'; b.className = 'menu-btn'; b.type = 'button'; b.textContent = 'ОНЛАЙН'; b.addEventListener('click', openPanel); menu.appendChild(b);
    }
    if (!$('online-panel')) {
      const p = document.createElement('div'); p.id = 'online-panel';
      p.style.cssText = 'display:none;position:absolute;inset:0;z-index:900;align-items:center;justify-content:center;background:rgba(0,0,0,.94);color:#eee;font-family:Arial,sans-serif;padding:20px';
      p.innerHTML = `<div style="width:min(92vw,430px);border:1px solid #733;background:#090909;padding:22px;text-align:center;box-shadow:0 0 30px #000"><h2 style="margin:0 0 8px;color:#ddd">СОВМЕСТНАЯ ИГРА</h2><p style="color:#aaa;font-size:13px">Создай комнату или введи код друга. Максимум 2 игрока.</p><button id="online-create" class="menu-btn" type="button">СОЗДАТЬ КОМНАТУ</button><div style="display:flex;gap:8px;margin:12px 0"><input id="online-code-input" maxlength="8" placeholder="КОД КОМНАТЫ" style="min-width:0;flex:1;background:#151515;color:#fff;border:1px solid #666;padding:12px;text-transform:uppercase"><button id="online-join" class="menu-btn" type="button" style="width:auto;padding:10px">ВОЙТИ</button></div><div style="margin:10px;color:#f66;font-size:20px;font-weight:bold" id="online-room-code"></div><div id="online-status" style="min-height:36px;color:#aaa;font-size:13px">Подключение…</div><button id="online-close" class="menu-btn" type="button">НАЗАД</button></div>`;
      document.getElementById('game-container').appendChild(p);
      $('online-create').addEventListener('click', () => { if (!connect()) return; socket.emit('room:create', r => { if (!r || !r.ok) status((r && r.error) || 'Не удалось создать комнату.'); else { roomCode = r.code; $('online-room-code').textContent = r.code; status('Комната создана. Отправь код другу.'); } }); });
      $('online-join').addEventListener('click', () => { if (!connect()) return; const code = $('online-code-input').value.trim().toUpperCase(); if (!code) return status('Введи код комнаты.'); socket.emit('room:join', code, r => { if (!r || !r.ok) status((r && r.error) || 'Не удалось войти.'); else { roomCode = r.code; $('online-room-code').textContent = r.code; status('Ты в комнате! Теперь можно открыть игру.'); } }); });
      $('online-close').addEventListener('click', () => { p.style.display = 'none'; });
    }
    const remote = document.createElement('div'); remote.id = 'remote-camera-status'; remote.textContent = 'Друг пока не подключён'; remote.style.cssText = 'position:absolute;z-index:200;top:8px;left:8px;max-width:70%;background:rgba(0,0,0,.78);color:#9f9;padding:7px 10px;font:12px monospace;display:none;pointer-events:none';
    document.getElementById('game-container').appendChild(remote);
    let lastCamera = 1, tabletOpen = false;
    const report = () => { if (socket && socket.connected && roomCode) socket.emit('player:state', { camera: lastCamera, tabletOpen }); };
    window.addEventListener('hotel-camera-change', event => {
      lastCamera = Number(event.detail && event.detail.camera) || 1;
      tabletOpen = !!(event.detail && event.detail.tabletOpen);
      remote.style.display = roomCode ? 'block' : 'none';
      report();
    });
  });
})();
