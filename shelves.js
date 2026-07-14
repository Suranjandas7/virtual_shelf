export async function listShelves(itemId) {
  const url = itemId ? `/api/shelves?itemId=${encodeURIComponent(itemId)}` : '/api/shelves';
  const res = await fetch(url);
  return res.json();
}

export async function getShelfItems(name) {
  const res = await fetch(`/api/shelves?name=${encodeURIComponent(name)}`);
  return res.json();
}

export async function addToShelf(shelfName, label, item) {
  const res = await fetch('/api/shelves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: shelfName, label, item }),
  });
  return res.json();
}

export async function removeFromShelf(shelfName, itemId) {
  const res = await fetch('/api/shelves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: shelfName, removeItemId: itemId }),
  });
  return res.json();
}

export async function createShelf(name, label) {
  const res = await fetch('/api/shelves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, label }),
  });
  return res.json();
}

export function showShelfPicker(item) {
  const existing = document.getElementById('shelf-picker');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'shelf-picker';
  overlay.innerHTML = `
    <div class="shelf-picker-backdrop"></div>
    <div class="shelf-picker-panel">
      <div class="shelf-picker-header">
        <span class="shelf-picker-title">Shelf Manager</span>
        <button class="shelf-picker-close">&times;</button>
      </div>
      <div class="shelf-picker-sub">"${item.title}"</div>
      <ul class="shelf-list"></ul>
      <div class="shelf-picker-new">
        <input type="text" placeholder="New shelf name..." maxlength="40" autocomplete="off" spellcheck="false">
        <button>Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const ul = overlay.querySelector('.shelf-list');
  const input = overlay.querySelector('.shelf-picker-new input');
  const createBtn = overlay.querySelector('.shelf-picker-new button');
  const closeBtn = overlay.querySelector('.shelf-picker-close');
  const backdrop = overlay.querySelector('.shelf-picker-backdrop');

  function close() { overlay.remove(); }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  overlay.addEventListener('touchstart', (e) => e.stopPropagation());
  overlay.addEventListener('touchmove', (e) => e.stopPropagation());
  overlay.addEventListener('touchend', (e) => e.stopPropagation());

  async function refreshList() {
    const shelves = await listShelves(item.id);
    ul.innerHTML = '';
    if (shelves.length === 0) {
      ul.innerHTML = '<li class="shelf-item-empty">No shelves yet. Create one below.</li>';
      return;
    }
    for (const s of shelves) {
      const li = document.createElement('li');
      li.className = 'shelf-item';
      if (s.hasItem) li.classList.add('shelf-item-added');

      const nameEl = document.createElement('span');
      nameEl.className = 'shelf-item-name';
      nameEl.textContent = s.label;

      const metaEl = document.createElement('span');
      metaEl.className = 'shelf-item-meta';
      metaEl.textContent = s.hasItem ? '✓ Added' : `${s.count} item${s.count !== 1 ? 's' : ''}`;

      li.appendChild(nameEl);
      li.appendChild(metaEl);

      li.addEventListener('click', async () => {
        li.style.pointerEvents = 'none';
        if (s.hasItem) {
          await removeFromShelf(s.name, item.id);
        } else {
          await addToShelf(s.name, s.label, item);
        }
        refreshList();
      });
      ul.appendChild(li);
    }
  }

  createBtn.addEventListener('click', async () => {
    const label = input.value.trim();
    if (!label) return;
    const name = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!name) return;
    input.value = '';
    await createShelf(name, label);
    await addToShelf(name, label, item);
    refreshList();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn.click();
    e.stopPropagation();
  });

  input.focus();
  refreshList();
}
