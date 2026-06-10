/* Dashboard logic: REST polling + WebSocket live refresh.
   No external libraries — the server runs on an offline LAN. */

let me = null;

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (res.status === 401) { location.href = '/login'; throw new Error('unauthenticated'); }
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
}

function el(id) { return document.getElementById(id); }

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ---- summary cards ---- */
async function refreshSummary() {
  const s = await api('/api/stats/summary');
  el('s-total').textContent = s.total_items;
  el('s-present').textContent = s.present;
  el('s-checked').textContent = s.checked_out;
  el('s-missing').textContent = s.missing;
  el('s-alerts').textContent = s.open_alerts;
}

/* ---- inventory table ---- */
async function refreshItems() {
  const params = new URLSearchParams();
  if (el('f-search').value) params.set('q', el('f-search').value);
  if (el('f-status').value) params.set('status', el('f-status').value);
  if (el('f-building').value) params.set('building', el('f-building').value);
  const items = await api('/api/items?' + params);
  const tbody = el('items-table').querySelector('tbody');
  tbody.innerHTML = '';
  for (const it of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.name}</td>
      <td class="epc">${it.epc}</td>
      <td>${it.category || '—'}</td>
      <td>${it.location_address || '—'}</td>
      <td><span class="badge badge-${it.status}">${it.status}</span></td>
      <td>${fmtTime(it.last_seen)}</td>`;
    tbody.appendChild(tr);
  }
}

/* ---- alerts ---- */
async function refreshAlerts() {
  const alerts = await api('/api/alerts');
  const ul = el('alerts-list');
  ul.innerHTML = alerts.length ? '' : '<li class="empty">No active alerts</li>';
  for (const a of alerts) {
    const li = document.createElement('li');
    li.innerHTML = `<button data-id="${a.alert_id}">Resolve</button>
      <strong>${a.alert_type}</strong> ${a.message}
      <div class="when">${fmtTime(a.triggered_at)}</div>`;
    li.querySelector('button').onclick = async () => {
      await api(`/api/alerts/${a.alert_id}/resolve`, { method: 'PATCH' });
      refreshAlerts(); refreshSummary();
    };
    ul.appendChild(li);
  }
}

/* ---- checkouts ---- */
async function refreshCheckouts() {
  const rows = await api('/api/checkouts');
  const ul = el('checkouts-list');
  ul.innerHTML = rows.length ? '' : '<li class="empty">No checkouts yet</li>';
  for (const c of rows.slice(0, 12)) {
    const li = document.createElement('li');
    const status = c.return_status === 'open' ? 'OUT' : c.return_status.toUpperCase();
    li.innerHTML = `<strong>${c.item_name || c.epc}</strong>
      — ${c.username || 'unknown'} <span class="badge badge-${c.return_status === 'open' ? 'checked-out' : 'present'}">${status}</span>
      <div class="when">from ${c.from_location || '?'} at ${fmtTime(c.taken_at)}</div>`;
    ul.appendChild(li);
  }
}

/* ---- read-rate chart (tiny hand-rolled canvas line chart) ---- */
async function refreshChart() {
  const { buckets } = await api('/api/stats/read-rate?minutes=60');
  const canvas = el('rate-chart');
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(buckets);
  const values = Object.values(buckets);
  const W = canvas.width, H = canvas.height, pad = 24;
  ctx.clearRect(0, 0, W, H);
  if (!values.length) {
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('No reads yet', W / 2 - 30, H / 2);
    return;
  }
  const max = Math.max(...values, 1);
  const x = i => pad + (i / Math.max(labels.length - 1, 1)) * (W - pad * 2);
  const y = v => H - pad - (v / max) * (H - pad * 2);
  ctx.strokeStyle = '#e5e7eb';
  ctx.beginPath(); ctx.moveTo(pad, y(0)); ctx.lineTo(W - pad, y(0)); ctx.stroke();
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
  ctx.stroke();
  ctx.fillStyle = '#6b7280'; ctx.font = '10px sans-serif';
  ctx.fillText(String(max), 2, y(max) + 4);
  ctx.fillText('0', 2, y(0) + 4);
  ctx.fillText(labels[0], pad, H - 8);
  ctx.fillText(labels[labels.length - 1], W - pad - 28, H - 8);
}

/* ---- register form (manager only) ---- */
async function setupRegister() {
  if (me.role !== 'manager') return;
  el('register-panel').hidden = false;
  const locations = await api('/api/locations');
  const select = el('r-location');
  for (const l of locations) {
    const opt = document.createElement('option');
    opt.value = l.location_id;
    opt.textContent = l.address + (l.zone_label ? ` (${l.zone_label})` : '');
    select.appendChild(opt);
  }
  el('r-scan').onclick = async () => {
    const { epc } = await api('/api/reader/scan');
    el('r-msg').textContent = epc ? `Tag detected: ${epc}` : 'No new tag seen — hold it at the antenna';
    if (epc) el('r-epc').value = epc;
  };
  el('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api('/api/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epc: f.get('epc'), name: f.get('name'),
          category: f.get('category') || null,
          location_id: f.get('location_id') ? Number(f.get('location_id')) : null,
          is_consumable: !!f.get('is_consumable'),
        }),
      });
      el('r-msg').textContent = 'Item registered ✔';
      e.target.reset();
      refreshItems(); refreshSummary();
    } catch (err) {
      el('r-msg').textContent = 'Error: ' + err.message;
    }
  });
}

/* ---- building filter options ---- */
async function setupFilters() {
  const locations = await api('/api/locations');
  const buildings = [...new Set(locations.map(l => l.building))];
  for (const b of buildings) {
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    el('f-building').appendChild(opt);
  }
  for (const id of ['f-search', 'f-status', 'f-building']) {
    el(id).addEventListener('input', () => refreshItems());
  }
}

/* ---- live websocket ---- */
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/live`);
  ws.onopen = () => { el('ws-status').textContent = 'live'; el('ws-status').className = 'badge badge-on'; };
  ws.onclose = () => {
    el('ws-status').textContent = 'offline'; el('ws-status').className = 'badge badge-off';
    setTimeout(connectWS, 3000);
  };
  ws.onmessage = (msg) => {
    const ev = JSON.parse(msg.data);
    if (ev.type === 'item_status') { refreshItems(); refreshSummary(); }
    if (ev.type === 'checkout') { refreshCheckouts(); refreshSummary(); }
    if (ev.type === 'alert') { refreshAlerts(); refreshSummary(); }
  };
}

/* ---- boot ---- */
(async function init() {
  try { me = await api('/api/auth/me'); } catch { return; }
  el('who').textContent = `${me.username} (${me.role})`;
  el('logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/login';
  };
  await Promise.all([refreshSummary(), refreshItems(), refreshAlerts(),
                     refreshCheckouts(), refreshChart(), setupFilters()]);
  await setupRegister();
  connectWS();
  setInterval(() => { refreshItems(); refreshSummary(); }, 5000);
  setInterval(refreshChart, 15000);
})();
