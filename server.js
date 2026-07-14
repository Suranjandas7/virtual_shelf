/* eslint-env node */
import { createServer } from 'http';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import crypto from 'crypto';
import { readFile, writeFile, stat } from 'fs/promises';
import { join, extname, normalize } from 'path';
import { fileURLToPath } from 'url';

const PORT = 3000;
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SHELVES_FILE = join(ROOT, 'shelves.json');

async function readShelves() {
  try {
    const data = await readFile(SHELVES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { shelves: [] };
  }
}

async function writeShelves(data) {
  await writeFile(SHELVES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let opdsAuth = null;

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex');
}

function computeDigest(challenge, username, password, method, uri) {
  const realm = challenge.realm;
  const nonce = challenge.nonce;
  const qop = challenge.qop || 'auth';
  const opaque = challenge.opaque || '';
  const algorithm = (challenge.algorithm || 'MD5').toUpperCase();
  const cnonce = randomHex(8);
  const nc = '00000001';

  let ha1;
  if (algorithm === 'MD5-SESS') {
    ha1 = md5(md5(`${username}:${realm}:${password}`) + `:${nonce}:${cnonce}`);
  } else {
    ha1 = md5(`${username}:${realm}:${password}`);
  }

  const ha2 = md5(`${method}:${uri}`);

  let response;
  if (qop === 'auth' || qop === 'auth-int') {
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }

  let header = 'Digest username="' + username + '"'
    + ', realm="' + realm + '"'
    + ', nonce="' + nonce + '"'
    + ', uri="' + uri + '"'
    + ', response="' + response + '"'
    + ', algorithm=' + algorithm;

  if (opaque) header += ', opaque="' + opaque + '"';
  if (qop)   header += ', qop=' + qop + ', nc=' + nc + ', cnonce="' + cnonce + '"';

  return header;
}

function parseDigestChallenge(header) {
  const challenge = {};
  const parts = header.replace(/^Digest\s+/i, '').split(',');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.substring(0, eq).trim();
    let val = part.substring(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    challenge[key] = val;
  }
  return challenge;
}

function fetchWithDigest(targetUrl, res) {
  const proto = targetUrl.startsWith('https') ? httpsRequest : httpRequest;
  const u = new URL(targetUrl);
  const method = 'GET';

  const req1 = proto.call(null, u, { method }, (proxyRes) => {
    if (proxyRes.statusCode === 401) {
      const authHeader = proxyRes.headers['www-authenticate'];
      if (!authHeader || !authHeader.toLowerCase().startsWith('digest')) {
        res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, {
          'Content-Type': proxyRes.headers['content-type'] || 'text/plain',
          'Access-Control-Allow-Origin': '*',
        });
        proxyRes.pipe(res);
        return;
      }

      const challenge = parseDigestChallenge(authHeader);
      proxyRes.on('data', () => {});
      proxyRes.on('end', () => {
        const auth = computeDigest(challenge, opdsAuth.username, opdsAuth.password, method, u.pathname + (u.search || ''));
        const req2 = proto.call(null, u, {
          method,
          headers: { Authorization: auth },
        }, (proxyRes2) => {
          res.writeHead(proxyRes2.statusCode, proxyRes2.statusMessage, {
            'Content-Type': proxyRes2.headers['content-type'] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          proxyRes2.pipe(res);
        });
        req2.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(502);
            res.end('Proxy error');
          }
        });
        req2.end();
      });
      return;
    }

    res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    });
    proxyRes.pipe(res);
  });

  req1.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end('Proxy error');
    }
  });
  req1.end();
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let filePath = join(ROOT, normalize(url.pathname));
  if (filePath.endsWith('/')) filePath = join(filePath, 'index.html');

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  stat(filePath).then((st) => {
    if (st.isFile()) {
      readFile(filePath).then((content) => {
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
      }).catch(() => {
        serveIndex(res);
      });
    } else {
      serveIndex(res);
    }
  }).catch(() => {
    serveIndex(res);
  });
}

function serveIndex(res) {
  readFile(join(ROOT, 'index.html')).then((content) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  }).catch(() => {
    res.writeHead(404);
    res.end('Not found');
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = req.method;
  const ts = new Date().toISOString().substring(11, 19);

  if (url.pathname === '/proxy' && url.searchParams.get('url')) {
    const target = url.searchParams.get('url');
    console.log(`[${ts}] ${method} /proxy → ${target.substring(0, 80)}...`);
    fetchWithDigest(target, res);
    return;
  }

  if (url.pathname === '/steam-proxy' && url.searchParams.get('url')) {
    const target = url.searchParams.get('url');
    console.log(`[${ts}] ${method} /steam-proxy → ${target.substring(0, 80)}...`);
    const proto = target.startsWith('https') ? httpsRequest : httpRequest;
    const u = new URL(target);
    const proxyReq = proto.call(null, u, { method, headers: { 'User-Agent': 'virtual-shelf/1.0' } }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Proxy error');
      }
    });
    proxyReq.end();
    return;
  }

  if (url.pathname === '/api/shelves') {
    if (method === 'GET') {
      const data = await readShelves();
      if (url.searchParams.has('name')) {
        const name = url.searchParams.get('name');
        const shelf = data.shelves.find(s => s.name === name);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(shelf ? shelf.items : []));
        return;
      }
      const list = data.shelves.map(s => {
        const info = { name: s.name, label: s.label, count: s.items.length };
        if (url.searchParams.has('itemId')) {
          info.hasItem = s.items.some(it => it.id === url.searchParams.get('itemId'));
        }
        return info;
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
      return;
    }
    if (method === 'POST') {
      const body = await readBody(req);
      let payload;
      try { payload = JSON.parse(body); } catch { res.writeHead(400); res.end('Invalid JSON'); return; }
      const data = await readShelves();
      if (payload.remove && payload.name) {
        data.shelves = data.shelves.filter(s => s.name !== payload.name);
        await writeShelves(data);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (payload.removeItemId && payload.name) {
        const shelf = data.shelves.find(s => s.name === payload.name);
        if (shelf) {
          shelf.items = shelf.items.filter(it => it.id !== payload.removeItemId);
          await writeShelves(data);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (!payload.name) { res.writeHead(400); res.end('Missing name'); return; }
      let shelf = data.shelves.find(s => s.name === payload.name);
      if (!shelf) {
        if (!payload.label) { res.writeHead(400); res.end('Missing label for new shelf'); return; }
        shelf = { name: payload.name, label: payload.label, items: [] };
        data.shelves.push(shelf);
      }
      if (payload.item) {
        const exists = shelf.items.some(it => it.id === payload.item.id);
        if (!exists) shelf.items.push(payload.item);
      }
      await writeShelves(data);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, shelf: { name: shelf.name, label: shelf.label, count: shelf.items.length } }));
      return;
    }
    if (method === 'DELETE') {
      const name = url.searchParams.get('name');
      if (!name) { res.writeHead(400); res.end('Missing name'); return; }
      const data = await readShelves();
      data.shelves = data.shelves.filter(s => s.name !== name);
      await writeShelves(data);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
  }

  console.log(`[${ts}] ${method} ${url.pathname}`);
  serveStatic(req, res);
}).listen(PORT, async () => {
  try {
    const mod = await import(new URL('./config.js', import.meta.url).href);
    const c = mod.OPDS;
    if (c?.auth?.username && c?.auth?.password) {
      opdsAuth = { username: c.auth.username, password: c.auth.password };
    } else if (c?.auth?.token) {
      opdsAuth = { username: '', password: '', token: c.auth.token };
    }
  } catch { /* config not available */ }
  console.log(`Shelf running at http://localhost:${PORT}`);
  if (opdsAuth) console.log('OPDS proxy auth configured (Digest)');
});
