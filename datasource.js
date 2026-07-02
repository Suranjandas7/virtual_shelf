function getSource() {
  if (location.pathname.startsWith('/books')) return 'opds';
  if (location.pathname.startsWith('/games')) return 'steam';
  return 'jellyfin';
}

export async function fetchItems() {
  const source = getSource();
  if (source === 'opds') {
    const { fetchItems: opdsFetch } = await import('./opds.js');
    return opdsFetch();
  }
  if (source === 'steam') {
    const { fetchItems: steamFetch } = await import('./steam.js');
    return steamFetch();
  }
  const { fetchItems: jellyfinFetch } = await import('./jellyfin.js');
  return jellyfinFetch();
}
