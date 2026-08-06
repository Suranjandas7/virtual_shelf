const FEED_BASE = 'https://www.gutenberg.org/ebooks/search.opds/';

export async function fetchItems(searchTerm) {
  let feedUrl = FEED_BASE;
  if (searchTerm) {
    feedUrl += '?query=' + encodeURIComponent(searchTerm);
  }

  console.log('[gutenberg] feed URL:', feedUrl);
  const max = 500;
  let [items, nextUrl] = await fetchAndParsePage(feedUrl);

  let page = 1;
  while (nextUrl && items.length < max) {
    page++;
    const [pageItems, pageNext] = await fetchAndParsePage(nextUrl);
    console.log(`[gutenberg] page ${page}: ${pageItems.length} items`);
    items.push(...pageItems);
    nextUrl = pageNext;
  }

  const result = items.slice(0, max);
  console.log(`[gutenberg] loaded ${result.length} items from ${page} pages`);
  return result;
}

async function fetchAndParsePage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gutenberg feed error: ${res.status} ${res.statusText} for ${url}`);

  const text = await res.text();
  return parseFeed(text, url);
}

function parseFeed(xml, feedUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Failed to parse Gutenberg OPDS feed XML');
  }

  let nextUrl = null;
  for (const child of doc.documentElement.children) {
    if (child.localName === 'link' && child.getAttribute('rel') === 'next') {
      nextUrl = resolveUrl(child.getAttribute('href'), feedUrl);
      break;
    }
  }

  const entries = doc.querySelectorAll('entry');
  const items = [];

  for (const entry of entries) {
    const idText = queryText(entry, 'id');
    const bookId = extractBookId(idText);
    if (!bookId) continue;

    const title = queryText(entry, 'title');
    const author = queryText(entry, 'content', 'type', 'text');
    const updated = queryText(entry, 'updated');

    const coverUrl = 'https://www.gutenberg.org/cache/epub/' + bookId + '/pg' + bookId + '.cover.medium.jpg';

    const date = updated ? updated.substring(0, 4) : '';

    items.push({
      id: 'gutenberg-' + bookId,
      title: title || 'Unknown',
      subtitle: author || date || '',
      description: '',
      coverUrl: coverUrl,
      logoUrl: null,
      linkUrl: 'https://www.gutenberg.org/ebooks/' + bookId,
      _date: updated || '',
    });
  }

  return [items, nextUrl];
}

function extractBookId(idText) {
  if (!idText) return null;
  const m = idText.match(/ebooks\/(\d+)\.opds/);
  return m ? m[1] : null;
}

function queryText(el, tag, attr, val) {
  const children = el.getElementsByTagName(tag);
  for (const child of children) {
    if (attr && val && child.getAttribute(attr) !== val) continue;
    return child.textContent?.trim() || '';
  }
  return '';
}

function resolveUrl(url, baseUrl) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}
