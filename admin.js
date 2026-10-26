(() => {
  'use strict';
  const CFG = window.REGISTRY_CONFIG || {};
  const ENDPOINT = (CFG.endpoint || '').trim();

  const state = { gifts: [], editingId: null };

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

  function clearToken() {
    sessionStorage.removeItem('registry_admin_token');
  }

  async function api(body) {
    if (!ENDPOINT) throw new Error('Registry endpoint is not configured in config.js.');
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: adminToken() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const message = data.error || 'Request failed';
      if (String(message).toLowerCase().includes('unauthorized')) {
        clearToken();
        throw new Error('Unauthorized. Reload the page and enter the correct admin token.');
      }
      throw new Error(message);
    }
    return data;
  }

  async function load() {
    // adminList is token-gated and includes reservation names and messages.
    const data = await api({ action: 'adminList' });
    state.gifts = data.gifts || [];
  }

  async function saveGift(gift) {
    if (state.editingId) {
      await api({ action: 'update', gift: { ...gift, id: state.editingId } });
    } else {
      await api({ action: 'add', gift });
    }
    await load();
  }

  async function removeGift(id) {
    await api({ action: 'remove', id });
    await load();
  }

  async function unreserve(id) {
    await api({ action: 'unreserve', id });
    await load();
  }

  function render() {
    const tbody = document.getElementById('a-list');
    tbody.innerHTML = '';
    state.gifts.forEach(g => {
      const tr = document.createElement('tr');
      const reserved = (g.claimed || 0) >= (g.quantity || 1);
      const reservedBy = g.reservedBy ? escapeHtml(g.reservedBy) : '&mdash;';
      tr.innerHTML = `
        <td>${escapeHtml(g.name)}</td>
        <td>${g.price ? '$' + Number(g.price).toFixed(2) : '&mdash;'}</td>
        <td>${reserved ? 'Reserved' : 'Available'}</td>
        <td>${reservedBy}</td>
        <td>
          <button class="btn btn-ghost" data-act="edit" data-id="${g.id}">Edit</button>
          ${reserved ? `<button class="btn btn-ghost" data-act="unreserve" data-id="${g.id}">Release</button>` : ''}
          <button class="btn btn-ghost danger" data-act="remove" data-id="${g.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function field(id) { return document.getElementById(id); }

  function resetForm() {
    state.editingId = null;
    ['a-name','a-price','a-cat','a-url','a-img','a-desc','a-note'].forEach(id => { field(id).value = ''; });
    field('a-qty').value = '1';
    field('a-prio').value = 'medium';
    field('a-form-title').textContent = 'Add a gift';
    field('a-add').textContent = 'Add gift';
    field('a-cancel-edit').hidden = true;
    field('a-status').textContent = '';
    field('a-status').className = 'form-status';
  }

  function startEdit(g) {
    state.editingId = g.id;
    field('a-name').value = g.name || '';
    field('a-price').value = g.price === '' || g.price === undefined ? '' : g.price;
    field('a-cat').value = g.category || '';
    field('a-prio').value = g.priority || 'medium';
    field('a-url').value = g.storeUrl || '';
    field('a-img').value = g.image || '';
    field('a-qty').value = g.quantity || 1;
    field('a-desc').value = g.description || '';
    field('a-note').value = g.note || '';
    field('a-form-title').textContent = 'Edit gift';
    field('a-add').textContent = 'Save changes';
    field('a-cancel-edit').hidden = false;
    field('a-status').textContent = 'Editing "' + g.name + '".';
    field('a-status').className = 'form-status';
    document.querySelector('.admin').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  field('a-add').addEventListener('click', async () => {
    const status = field('a-status');
    const gift = {
      name: field('a-name').value.trim(),
      price: parseFloat(field('a-price').value) || 0,
      category: field('a-cat').value.trim() || 'Other',
      priority: field('a-prio').value,
      storeUrl: field('a-url').value.trim(),
      image: field('a-img').value.trim(),
      quantity: parseInt(field('a-qty').value, 10) || 1,
      description: field('a-desc').value.trim(),
      note: field('a-note').value.trim(),
    };
    if (!gift.name) { status.textContent = 'Name required.'; status.className = 'form-status error'; return; }

    const editing = !!state.editingId;
    const btn = field('a-add');
    btn.disabled = true;
    status.textContent = editing ? 'Saving…' : 'Adding…';
    status.className = 'form-status';
    try {
      await saveGift(gift);
      resetForm();
      status.textContent = editing ? 'Changes saved.' : 'Gift added.';
      status.className = 'form-status success';
      render();
    } catch (e) {
      status.textContent = e.message;
      status.className = 'form-status error';
    } finally {
      btn.disabled = false;
    }
  });

  field('a-cancel-edit').addEventListener('click', resetForm);

  document.getElementById('a-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const gift = state.gifts.find(g => g.id === id);
    if (act === 'edit') {
      if (gift) startEdit(gift);
      return;
    }
    if (act === 'remove' && !confirm('Delete "' + (gift ? gift.name : id) + '"? This cannot be undone.')) return;
    try {
      if (act === 'remove') await removeGift(id);
      if (act === 'unreserve') await unreserve(id);
      render();
    } catch (err) {
      alert(err.message);
    }
  });

  (async () => {
    const status = document.getElementById('a-load-status');
    try {
      await load();
      render();
    } catch (e) {
      status.textContent = e.message;
      status.className = 'form-status error';
    }
  })();
})();
