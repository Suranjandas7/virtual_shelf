import { JELLYFIN, JELLYFIN_WEB } from './config.js';

export async function fetchItems() {
  const url = `${JELLYFIN.server}/Users/${JELLYFIN.userId}/Items`
    + '?IncludeItemTypes=Movie,Series&Recursive=true&SortBy=SortName&Fields=Overview';
  const res = await fetch(url, {
    headers: { 'X-MediaBrowser-Token': JELLYFIN.apiKey },
  });
  if (!res.ok) throw new Error(`Jellyfin API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return (data?.Items || []).map((item) => ({
    id: item.Id,
    title: item.Name,
    subtitle: String(item.ProductionYear || ''),
    description: item.Overview || '',
    coverUrl: getImageUrl(item.Id, item.ImageTags?.Primary),
    logoUrl: getLogoUrl(item.Id, item.ImageTags?.Logo),
    linkUrl: JELLYFIN_WEB + item.Id,
  }));
}

function getImageUrl(itemId, imageTag) {
  if (!itemId || !imageTag) return null;
  return `${JELLYFIN.server}/Items/${itemId}/Images/Primary`
    + `?api_key=${JELLYFIN.apiKey}&tag=${imageTag}&quality=90&maxHeight=800`;
}

function getLogoUrl(itemId, logoTag) {
  if (!itemId || !logoTag) return null;
  return `${JELLYFIN.server}/Items/${itemId}/Images/Logo`
    + `?api_key=${JELLYFIN.apiKey}&tag=${logoTag}&quality=95&maxHeight=1024`;
}
