(() => {
  'use strict';
  const CFG = window.REGISTRY_CONFIG || {};
  const ENDPOINT = (CFG.endpoint || '').trim();
  const DEMO = !ENDPOINT;

  const state = { gifts: [] };

  // Never ship the admin token in config.js on a public site. Ask for it once
  // per browser tab and keep it in sessionStorage.
  function adminToken() {
    let token = sessionStorage.getItem('registry_admin_token') || '';
    if (!token) {
      token = (prompt('Enter the admin token:') || '').trim();
      if (token) sessionStorage.setItem('registry_admin_token', token);
    }
    return token;
  }

  async function demoLoad() {
    let base = [];
    try {
      const res = await fetch('gifts.json');
      if (res.ok) base = await res.json();
    } catch (e) { base = []; }
    if (!base.length && Array.isArray(window.REGISTRY_GIFTS)) base = window.REGISTRY_GIFTS;
    if (!base.length) base = [];
    try {
      const g = JSON.parse(localStorage.getItem('demo_gifts') || 'null');
      const merged = new Map(base.map(x => [x.id, { ...x }]));
      for (const gg of Array.isArray(g) ? g : []) {
        const fresh = merged.get(gg.id);
        if (fresh) {
          for (const key of ['claimed', 'reservedBy', 'reservedAt', 'message']) {
            if (gg[key] !== undefined) fresh[key] = gg[key];
          }
        } else {
          merged.set(gg.id, gg);
        }
      }
      state.gifts = [...merged.values()];
    } catch (e) {
      state.gifts = base.map(x => ({ ...x }));
    }
  }

  async function load() {
    if (DEMO) { await demoLoad(); return; }
    const res = await fetch(ENDPOINT + '?action=list');
    const data = await res.json();
    state.gifts = data.gifts || [];
  }

  async function addGift(gift) {
    if (DEMO) {
      gift.id = 'g' + Date.now();
      gift.claimed = 0;
      gift.active = true;
      state.gifts.push(gift);
      localStorage.setItem('demo_gifts', JSON.stringify(state.gifts));
      return { ok: true };
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'add', token: adminToken(), gift }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Add failed');
    await load();
    return data;
  }

  async function removeGift(id) {
    if (DEMO) {
      state.gifts = state.gifts.filter(g => g.id !== id);
      localStorage.setItem('demo_gifts', JSON.stringify(state.gifts));
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'remove', token: adminToken(), id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Remove failed');
    await load();
  }

  async function unreserve(id) {
    if (DEMO) {
      const g = state.gifts.find(x => x.id === id);
      if (g) { g.claimed = 0; g.reservedBy = ''; g.reservedAt = ''; g.message = ''; }
      localStorage.setItem('demo_gifts', JSON.stringify(state.gifts));
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'unreserve', token: adminToken(), id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Unreserve failed');
    await load();
  }

  function render() {
    const tbody = document.getElementById('a-list');
    tbody.innerHTML = '';
    state.gifts.forEach(g => {
      const tr = document.createElement('tr');
      const reserved = (g.claimed || 0) >= (g.quantity || 1);
      tr.innerHTML = `
        <td>${escapeHtml(g.name)}</td>
        <td>${g.price ? '$' + Number(g.price).toFixed(2) : '—'}</td>
        <td>${reserved ? 'Reserved' : 'Available'}</td>
        <td>
          ${reserved ? `<button class="btn btn-ghost" data-act="unreserve" data-id="${g.id}">Release</button>` : ''}
          <button class="btn btn-ghost danger" data-act="remove" data-id="${g.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  document.getElementById('a-add').addEventListener('click', async () => {
    const status = document.getElementById('a-status');
    const gift = {
      name: document.getElementById('a-name').value.trim(),
      price: parseFloat(document.getElementById('a-price').value) || 0,
      category: document.getElementById('a-cat').value.trim() || 'Other',
      priority: document.getElementById('a-prio').value,
      storeUrl: document.getElementById('a-url').value.trim(),
      image: document.getElementById('a-img').value.trim(),
      quantity: parseInt(document.getElementById('a-qty').value,10) || 1,
      description: document.getElementById('a-desc').value.trim(),
      note: document.getElementById('a-note').value.trim(),
    };
    if (!gift.name) { status.textContent = 'Name required.'; status.className='form-status error'; return; }
    try {
      await addGift(gift);
      status.textContent = 'Added!';
      status.className = 'form-status success';
      // reset
      ['a-name','a-price','a-cat','a-url','a-img','a-desc','a-note'].forEach(id => document.getElementById(id).value='');
      document.getElementById('a-qty').value = '1';
      render();
    } catch (e) {
      status.textContent = e.message;
      status.className = 'form-status error';
    }
  });

  document.getElementById('a-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    try {
      if (act === 'remove') await removeGift(id);
      if (act === 'unreserve') await unreserve(id);
      render();
    } catch (err) { alert(err.message); }
  });

  (async () => {
    await load();
    render();
  })();
})();