function getSource() {
  if (location.pathname.startsWith('/collections')) return 'shelf';
  if (location.pathname.startsWith('/opds')) return 'opds';
  if (location.pathname.startsWith('/books')) return 'opds';
  if (location.pathname.startsWith('/steam')) return 'steam';
  if (location.pathname.startsWith('/games')) return 'steam';
  return 'jellyfin';
}

export async function fetchItems(searchTerm) {
  const source = getSource();
  if (source === 'shelf') {
    const parts = location.pathname.split('/').filter(Boolean);
    const shelfName = parts.length >= 2 ? parts[1] : null;
    if (!shelfName) return [];
    const { getShelfItems } = await import('./shelves.js');
    return getShelfItems(shelfName);
  }
  if (source === 'opds') {
    const { fetchItems: opdsFetch } = await import('./opds.js');
    return opdsFetch(searchTerm);
  }
  if (source === 'steam') {
    const { fetchItems: steamFetch } = await import('./steam.js');
    return steamFetch(searchTerm);
  }
  const { fetchItems: jellyfinFetch } = await import('./jellyfin.js');
  return jellyfinFetch(searchTerm);
}
