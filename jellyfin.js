import { JELLYFIN, JELLYFIN_WEB } from './config.js';

export async function fetchItems(searchTerm) {
  let url = `/jellyfin-api/Users/${JELLYFIN.userId}/Items`
    + '?IncludeItemTypes=Movie,Series&Recursive=true&SortBy=SortName&Fields=Overview';
  if (searchTerm) {
    url += '&searchTerm=' + encodeURIComponent(searchTerm);
  }
  const res = await fetch(url);
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
  return `/jellyfin-api/Items/${itemId}/Images/Primary`
    + `?tag=${imageTag}&quality=90&maxHeight=800`;
}

function getLogoUrl(itemId, logoTag) {
  if (!itemId || !logoTag) return null;
  return `/jellyfin-api/Items/${itemId}/Images/Logo`
    + `?tag=${logoTag}&quality=95&maxHeight=1024`;
}
