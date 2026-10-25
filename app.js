(() => {
  'use strict';
  const CFG = window.REGISTRY_CONFIG || {};
  const ENDPOINT = (CFG.endpoint || '').trim();
  const DEMO = !ENDPOINT;

  const state = {
    gifts: [],
    funds: [],
    filters: { q: '', category: '', status: 'all', sort: 'featured' },
    reserving: null,
  };

  const DEMO_FUNDS = [
    { id: 'f1', name: 'Honeymoon Fund', description: 'Help us explore Italy.', goal: 5000, raised: 1200, link: 'https://venmo.com/u/abeholleran', qrImage: '' },
    { id: 'f2', name: 'New Home Fund', description: 'Down payment savings.', goal: 10000, raised: 3400, link: 'https://paypal.me/HouseholdHolleran', qrImage: '' },
  ];

  // ---------- Storage (demo) ----------
  async function demoLoad() {
    let base = [];
    try {
      const res = await fetch('gifts.json');
      if (res.ok) base = await res.json();
    } catch (e) { base = []; }
    // file:// pages cannot fetch gifts.json, so fall back to the generated JS copy.
    if (!base.length && Array.isArray(window.REGISTRY_GIFTS)) base = window.REGISTRY_GIFTS;
    if (!base.length) base = [];
    try {
      const saved = JSON.parse(localStorage.getItem('demo_gifts') || 'null');
      const f = JSON.parse(localStorage.getItem('demo_funds') || 'null');

      // Keep the catalog from gifts.json authoritative (so image/name/price updates
      // appear immediately), while preserving reservations stored in this browser.
      const merged = new Map(base.map(x => [x.id, { ...x }]));
      for (const g of Array.isArray(saved) ? saved : []) {
        const fresh = merged.get(g.id);
        if (fresh) {
          for (const key of ['claimed', 'reservedBy', 'reservedAt', 'message']) {
            if (g[key] !== undefined) fresh[key] = g[key];
          }
        } else {
          merged.set(g.id, g);
        }
      }
      state.gifts = [...merged.values()];
      state.funds = f || DEMO_FUNDS.map(x => ({ ...x }));
    } catch (e) {
      state.gifts = base.map(x => ({ ...x }));
      state.funds = DEMO_FUNDS.map(x => ({ ...x }));
    }
  }
  function demoSave() {
    localStorage.setItem('demo_gifts', JSON.stringify(state.gifts));
    localStorage.setItem('demo_funds', JSON.stringify(state.funds));
  }

  // ---------- API ----------
  async function apiList() {
    if (DEMO) { await demoLoad(); return; }
    const res = await fetch(ENDPOINT + '?action=list', { method: 'GET' });
    if (!res.ok) throw new Error('Failed to load registry');
    const data = await res.json();
    state.gifts = (data.gifts || []).map(normalizeGift);
    state.funds = data.funds || [];
  }

  async function apiReserve(id, name, message) {
    if (DEMO) {
      const g = state.gifts.find(x => x.id === id);
      if (!g) return { ok: false, error: 'Not found' };
      const claimed = g.claimed || 0;
      const qty = g.quantity || 1;
      if (claimed >= qty) return { ok: false, error: 'Already reserved' };
      g.claimed = claimed + 1;
      g.reservedBy = name;
      g.reservedAt = new Date().toISOString();
      g.message = message;
      demoSave();
      return { ok: true };
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'reserve', id, name, message }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Reservation failed');
    // refresh
    await apiList();
    return data;
  }

  function normalizeGift(g) {
    return {
      id: g.id,
      name: g.name,
      description: g.description || '',
      price: Number(g.price) || 0,
      category: g.category || 'Other',
      image: g.image || '',
      storeUrl: g.storeUrl || g.store_url || '',
      quantity: Number(g.quantity) || 1,
      claimed: Number(g.claimed) || 0,
      reservedBy: g.reservedBy || g.reserved_by || '',
      reservedAt: g.reservedAt || '',
      message: g.message || '',
      priority: g.priority || 'medium',
      active: g.active !== false && g.active !== 'FALSE',
    };
  }

  // ---------- Render ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function categories() {
    const set = new Set(state.gifts.map(g => g.category).filter(Boolean));
    return [...set].sort();
  }

  function populateCategories() {
    const sel = $('#category');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All categories</option>';
    categories().forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    sel.value = cur;
  }

  function isReserved(g) {
    return (g.claimed || 0) >= (g.quantity || 1);
  }

  function filteredGifts() {
    const { q, category, status, sort } = state.filters;
    let list = state.gifts.filter(g => g.active !== false);
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter(g => (g.name + ' ' + g.description + ' ' + g.category).toLowerCase().includes(ql));
    }
    if (category) list = list.filter(g => g.category === category);
    if (status === 'available') list = list.filter(g => !isReserved(g));
    if (status === 'reserved') list = list.filter(g => isReserved(g));
    const priorityRank = { high: 0, medium: 1, low: 2 };
    if (sort === 'price-asc') list.sort((a,b) => a.price - b.price);
    else if (sort === 'price-desc') list.sort((a,b) => b.price - a.price);
    else if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
    else list.sort((a,b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || a.name.localeCompare(b.name));
    return list;
  }

  function renderStats() {
    const total = state.gifts.filter(g => g.active !== false).length;
    const reserved = state.gifts.filter(g => g.active !== false && isReserved(g)).length;
    const available = total - reserved;
    const value = state.gifts.filter(g => g.active !== false).reduce((s,g) => s + (g.price * (g.quantity - (g.claimed||0))), 0);
    $('#stats').innerHTML = `
      <span><strong>${available}</strong> available</span>
      <span><strong>${reserved}</strong> reserved</span>
      <span><strong>${total}</strong> total items</span>
      <span><strong>$${value.toFixed(0)}</strong> remaining value</span>
    `;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function renderGifts() {
    const grid = $('#gift-grid');
    const list = filteredGifts();
    grid.innerHTML = '';
    if (!list.length) { $('#empty').hidden = false; return; }
    $('#empty').hidden = true;
    list.forEach(g => {
      const reserved = isReserved(g);
      const card = document.createElement('article');
      card.className = 'gift-card';
      const imgHtml = g.image
        ? `<img src="${esc(g.image)}" alt="${esc(g.name)}" loading="lazy" />`
        : `<span style="font-family:'Cormorant Garamond',serif;font-size:2.4rem;color:#b08a5a;">${esc(g.name.charAt(0))}</span>`;
      const priceStr = g.price ? `$${g.price.toFixed(2)}` : 'Price varies';
      const qtyInfo = g.quantity > 1 ? `${g.claimed||0}/${g.quantity} claimed` : '';
      card.innerHTML = `
        <div class="gift-img">${imgHtml}</div>
        <div class="gift-body">
          <div class="gift-cat">${esc(g.category)}</div>
          <h3 class="gift-name">${esc(g.name)}</h3>
          <p class="gift-desc">${esc(g.description)}</p>
          <div class="gift-meta">
            <span class="gift-price">${priceStr}</span>
            <span class="badge ${reserved ? 'badge-reserved' : 'badge-available'}">${reserved ? 'Reserved' : 'Available'}</span>
          </div>
          ${qtyInfo ? `<div class="muted small">${qtyInfo}</div>` : ''}
          ${reserved && g.reservedBy ? `<div class="muted small">Reserved by ${esc(g.reservedBy)}</div>` : ''}
          <div class="gift-actions">
            ${g.storeUrl ? `<a class="btn btn-ghost" href="${esc(g.storeUrl)}" target="_blank" rel="noopener">View</a>` : ''}
            <button class="btn btn-primary reserve-btn" data-id="${esc(g.id)}" ${reserved ? 'disabled' : ''}>
              ${reserved ? 'Reserved' : 'Reserve'}
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderFunds() {
    const container = $('#funds');
    container.innerHTML = '';
    // No funds in the Sheet yet: hide the empty block instead of showing an
    // unfinished message on the public page.
    if (!state.funds.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    state.funds.forEach(f => {
      const goal = Number(f.goal) || 0;
      const raised = Number(f.raised) || 0;
      const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
      const card = document.createElement('div');
      card.className = 'fund-card';
      card.innerHTML = `
        <div class="fund-name">${esc(f.name)}</div>
        <p class="muted small">${esc(f.description || '')}</p>
        ${goal > 0 ? `
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
          <div class="fund-amounts"><span>$${raised.toLocaleString()} raised</span><span>Goal $${goal.toLocaleString()}</span></div>
        ` : ''}
        ${f.link ? `<a class="btn btn-primary" style="margin-top:.8rem;width:100%;" href="${esc(f.link)}" target="_blank" rel="noopener">Contribute</a>` : ''}
      `;
      container.appendChild(card);
    });
  }

  function renderAll() {
    populateCategories();
    renderStats();
    renderGifts();
    renderFunds();
  }

  // ---------- Modal / reserve ----------
  function openModal(gift) {
    state.reserving = gift;
    $('#modal-item').textContent = gift.name + (gift.price ? ` — $${gift.price.toFixed(2)}` : '');
    $('#reserve-form').reset();
    $('#modal-status').textContent = '';
    $('#modal-status').className = 'form-status';
    $('#modal').hidden = false;
    setTimeout(() => $('input[name="name"]').focus(), 50);
  }
  function closeModal() {
    state.reserving = null;
    $('#modal').hidden = true;
  }

  async function handleReserve(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const message = form.message.value.trim();
    const status = $('#modal-status');
    if (!name) { status.textContent = 'Please enter your name.'; status.className = 'form-status error'; return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    status.textContent = 'Reserving…';
    status.className = 'form-status';
    try {
      await apiReserve(state.reserving.id, name, message);
      status.textContent = 'Reserved! Thank you.';
      status.className = 'form-status success';
      setTimeout(closeModal, 900);
      renderAll();
    } catch (err) {
      status.textContent = err.message || 'Could not reserve. It may already be taken.';
      status.className = 'form-status error';
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- Events ----------
  function bindEvents() {
    $('#search').addEventListener('input', e => { state.filters.q = e.target.value; renderGifts(); });
    $('#category').addEventListener('change', e => { state.filters.category = e.target.value; renderGifts(); });
    $('#status').addEventListener('change', e => { state.filters.status = e.target.value; renderGifts(); });
    $('#sort').addEventListener('change', e => { state.filters.sort = e.target.value; renderGifts(); });

    document.addEventListener('click', e => {
      const btn = e.target.closest('.reserve-btn');
      if (btn && !btn.disabled) {
        const gift = state.gifts.find(g => g.id === btn.dataset.id);
        if (gift) openModal(gift);
      }
    });

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-cancel').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    $('#reserve-form').addEventListener('submit', handleReserve);

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  // ---------- Init ----------
  async function init() {
    bindEvents();
    $('#loading').style.display = 'block';
    try {
      await apiList();
    } catch (err) {
      console.error(err);
      if (!DEMO) {
        // fallback to demo data so page still works
        await demoLoad();
      }
    } finally {
      $('#loading').hidden = true;
      $('#loading').style.display = '';
    }
    renderAll();

    if (!DEMO && CFG.pollMs) {
      setInterval(async () => {
        try { await apiList(); renderAll(); } catch (e) { /* ignore */ }
      }, CFG.pollMs);
    }

    if (DEMO) {
      // show a small banner
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;bottom:10px;left:10px;background:#fff3cd;border:1px solid #ffe69c;padding:6px 10px;border-radius:8px;font-size:.8rem;z-index:200;';
      banner.textContent = 'Demo mode — reservations saved in this browser. Configure config.js for shared data.';
      document.body.appendChild(banner);
    }
  }

  init();
})();