import { OPDS } from './config.js';

function proxify(url) {
  if (!OPDS.useProxy || !url) return url;
  const base = OPDS.proxyBase || '';
  return base + '/proxy?url=' + encodeURIComponent(url);
}

function buildHeaders() {
  if (OPDS.useProxy) return {};
  const headers = {};
  if (OPDS.auth?.username && OPDS.auth?.password) {
    headers['Authorization'] = 'Basic ' + btoa(`${OPDS.auth.username}:${OPDS.auth.password}`);
  }
  if (OPDS.auth?.token) {
    headers['Authorization'] = 'Bearer ' + OPDS.auth.token;
  }
  return headers;
}

function feedUrlFromPath() {
  const path = location.pathname.replace(/\/$/, '');
  const m = path.match(/^\/opds\/(.+)/) || path.match(/^\/books\/(.+)/);
  if (!m) return OPDS.feedUrl;

  const tag = decodeURIComponent(m[1]);
  const u = new URL(OPDS.feedUrl);
  const libId = u.searchParams.get('library_id') || '';
  const base = u.origin + '/opds';
  const libParam = libId ? `?library_id=${libId}` : '';
  return `${base}/search/${encodeURIComponent(tag)}${libParam}`;
}

export async function fetchItems() {
  if (!OPDS?.feedUrl) {
    throw new Error('OPDS feed URL not configured. Set OPDS.feedUrl in config.js');
  }

  const effectiveUrl = feedUrlFromPath();
  console.log('[opds] feed URL:', effectiveUrl);
  const max = OPDS.maxItems || 100;
  const headers = buildHeaders();
  let [items, navUrl, nextUrl] = await fetchAndParsePage(effectiveUrl, headers);

  if (items.length === 0 && navUrl) {
    const [navItems, , navNext] = await fetchAndParsePage(navUrl, headers);
    items = navItems;
    nextUrl = navNext;
  }

  let page = 1;
  while (nextUrl && items.length < max) {
    page++;
    const [pageItems, , pageNext] = await fetchAndParsePage(nextUrl, headers);
    console.log(`[opds] page ${page}: ${pageItems.length} items`);
    items.push(...pageItems);
    nextUrl = pageNext;
  }

  const result = items.slice(0, max);
  console.log(`[opds] loaded ${result.length} items from ${page} pages`);
  return result;
}

async function fetchAndParsePage(url, headers) {
  const fetchUrl = proxify(url);
  const res = await fetch(fetchUrl, { headers });
  if (!res.ok) throw new Error(`OPDS feed error: ${res.status} ${res.statusText} for ${fetchUrl}`);

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('json') || contentType.includes('application/opds+json')) {
    return parseOPDS2(await res.json(), url);
  }

  const text = await res.text();
  return parseOPDS1(text, url);
}

function parseOPDS2(data, feedUrl) {
  const nextLink = (data.links || []).find((l) => l.rel === 'next');
  const nextPageUrl = resolveUrl(nextLink?.href || null, feedUrl);

  const items = [];
  const publications = data.publications || data.books || data.items || [];

  for (const pub of publications) {
    const meta = pub.metadata || {};

    const isNav = (pub.links || []).some(
      (l) => l.type && (l.type.includes('feed') || l.type.includes('opds'))
    ) && !(pub.links || []).some((l) => l.rel && (l.rel.includes('image') || l.rel.includes('cover')));

    if (isNav) continue;

    const author = Array.isArray(meta.author)
      ? meta.author.map((a) => typeof a === 'string' ? a : a.name).join(', ')
      : (typeof meta.author === 'string' ? meta.author : '');

    const coverLink = (pub.links || []).find(
      (l) => l.rel === 'http://opds-spec.org/image' || l.rel === 'cover'
    );
    const coverUrl = resolveUrl(
      (pub.images || [])[0]?.href || coverLink?.href || pub.cover?.href || null,
      feedUrl
    );

    const acqLink = (pub.links || []).find(
      (l) => l.rel === 'http://opds-spec.org/acquisition' || l.rel === 'alternate'
    );
    const linkUrl = resolveUrl(acqLink?.href || null, feedUrl);

    items.push({
      id: meta.identifier || pub.id || meta.title,
      title: meta.title || 'Unknown',
      subtitle: author || meta.publisher || '',
      description: meta.description || meta.summary || '',
      coverUrl: proxify(coverUrl),
      logoUrl: null,
      linkUrl,
      _date: meta.published || '',
    });
  }

  return [items, null, nextPageUrl];
}

function parseOPDS1(xml, feedUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Failed to parse OPDS feed XML');
  }

  let nextPageUrl = null;
  const feedEl = doc.documentElement;
  for (const child of feedEl.children) {
    if (child.localName === 'link' && child.getAttribute('rel') === 'next') {
      const raw = child.getAttribute('href');
      nextPageUrl = resolveUrl(raw, feedUrl);
      console.log('[opds] next page:', raw, '→', nextPageUrl);
      break;
    }
  }

  const entries = doc.querySelectorAll('entry');
  const items = [];
  let firstNavUrl = null;

  for (const entry of entries) {
    const links = entry.querySelectorAll('link');
    let coverUrl = null;
    let linkUrl = null;
    let navUrl = null;
    let author = '';
    let isPublication = false;

    for (const link of links) {
      const rel = link.getAttribute('rel') || '';
      const type = link.getAttribute('type') || '';
      const href = link.getAttribute('href');

      if (rel && (rel.includes('image') || rel.includes('cover'))) {
        coverUrl = coverUrl || href;
        isPublication = true;
      }
      if (!coverUrl && type && type.startsWith('image/')) {
        coverUrl = coverUrl || href;
        isPublication = true;
      }
      if (rel.includes('acquisition')) {
        linkUrl = linkUrl || href;
        isPublication = true;
      }

      if (type.includes('feed') || type.includes('opds-catalog')) {
        navUrl = navUrl || href;
      }
    }

    const authorEl = entry.querySelector('author');
    if (authorEl) {
      author = queryText(authorEl, 'name');
    }
    if (!author) {
      author = queryTextNS(entry, 'dc', 'creator');
    }
    if (author && author !== '--------') {
      isPublication = true;
    }

    if (!isPublication) {
      if (!firstNavUrl && navUrl) {
        firstNavUrl = resolveUrl(navUrl, feedUrl);
      }
      continue;
    }

    const id = queryText(entry, 'id');
    const title = queryText(entry, 'title');
    const summary = queryText(entry, 'summary') || queryText(entry, 'content');
    const published = queryText(entry, 'published');

    coverUrl = resolveUrl(coverUrl, feedUrl);
    linkUrl = resolveUrl(linkUrl, feedUrl);

    if (author === '--------') author = '';
    const pubDate = published ? published.substring(0, 4) : '';

    items.push({
      id: id || title || String(Math.random()),
      title: title || 'Unknown',
      subtitle: author || pubDate || '',
      description: summary || '',
      coverUrl: proxify(coverUrl),
      logoUrl: null,
      linkUrl,
      _date: published || '',
    });
  }

  return [items, firstNavUrl, nextPageUrl];
}

function queryText(el, tag) {
  const child = el.querySelector(tag);
  return child?.textContent?.trim() || '';
}

function queryTextNS(el, ns, tag) {
  const children = el.getElementsByTagNameNS
    ? el.getElementsByTagNameNS(`http://purl.org/dc/elements/1.1/`, tag)
    : [];
  if (children.length === 0) return '';
  return children[0].textContent?.trim() || '';
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
