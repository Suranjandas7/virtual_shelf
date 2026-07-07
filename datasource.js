function getSource() {
  if (location.pathname.startsWith('/opds')) return 'opds';
  if (location.pathname.startsWith('/books')) return 'opds';
  if (location.pathname.startsWith('/steam')) return 'steam';
  if (location.pathname.startsWith('/games')) return 'steam';
  return 'jellyfin';
}

export async function fetchItems(searchTerm) {
  const source = getSource();
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
