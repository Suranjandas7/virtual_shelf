import { STEAM } from './config.js';

function proxyFetch(url) {
  const proxyUrl = `/steam-proxy?url=${encodeURIComponent(url)}`;
  return fetch(proxyUrl).then((r) => (r.ok ? r.json() : Promise.reject(r)));
}

async function fetchAppDetails(appid) {
  try {
    const data = await proxyFetch(`https://store.steampowered.com/api/appdetails?appids=${appid}`);
    return data?.[appid]?.success ? data[appid].data : null;
  } catch {
    return null;
  }
}

function batchMap(items, fn, concurrency) {
  let i = 0;
  const results = new Array(items.length);
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  return Promise.all(Array.from({ length: concurrency }, worker)).then(() => results);
}

export async function fetchItems(searchTerm) {
  const data = await proxyFetch(
    'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/'
    + `?key=${STEAM.apiKey}&steamid=${STEAM.steamId}`
    + '&include_appinfo=true&include_played_free_games=true',
  );

  let games = data.response?.games || [];

  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    games = games.filter((g) => g.name.toLowerCase().includes(q));
  }

  console.log(`[steam] ${games.length} owned apps, fetching details...`);

  const details = await batchMap(games, (g) => fetchAppDetails(g.appid), 8);

  const hit = details.filter(d => d).length;
  const miss = details.filter(d => !d).length;
  console.log(`[steam] ${hit} apps with store pages, ${miss} without (filtered out)`);

  const filtered = [];
  const skipped = [];
  for (let idx = 0; idx < games.length; idx++) {
    const game = games[idx];
    const detail = details[idx];
    if (!detail) {
      skipped.push(`${game.name} (${game.appid})`);
      continue;
    }
    const year = detail.release_date?.date?.match(/\d{4}/)?.[0] || '';
    filtered.push({
      id: String(game.appid),
      title: game.name,
      subtitle: year,
      description: detail.short_description || '',
      coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`,
      logoUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/logo.png`,
      linkUrl: `https://store.steampowered.com/app/${game.appid}`,
    });
  }

  if (skipped.length) {
    console.log(`[steam] skipped (no store page / rate-limited):`);
    skipped.slice(0, 10).forEach(s => console.log(`  - ${s}`));
    if (skipped.length > 10) console.log(`  ... and ${skipped.length - 10} more`);
  }

  return filtered;
}
