const roles = new Set(['Học sinh', 'Thầy cô', 'Cựu học sinh']);

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

function decodeImage(content) {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function guestbook(request, database) {
  if (request.method === 'GET') {
    const notes = await database.prepare('SELECT id, author, role, message FROM notes ORDER BY id DESC LIMIT 100').all();
    return json(notes.results);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return json({ error: 'Invalid origin' }, 403);
  }
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    return json({ error: 'Expected JSON' }, 415);
  }
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: 'Message too long' }, 413);
  let note;
  try {
    note = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const author = typeof note?.author === 'string' ? note.author.trim() : '';
  const message = typeof note?.message === 'string' ? note.message.trim() : '';
  const role = note?.role;
  if (!author || author.length > 60 || !message || message.length > 600 || !roles.has(role)) {
    return json({ error: 'Invalid guestbook entry' }, 400);
  }
  const saved = await database.prepare('INSERT INTO notes (author, role, message) VALUES (?, ?, ?) RETURNING id, author, role, message')
    .bind(author, role, message).first();
  return json(saved, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/luu-but') {
      try {
        return await guestbook(request, env.DB);
      } catch {
        return json({ error: 'Guestbook unavailable' }, 503);
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const asset = assets[path === '/' ? '/index.html' : path];
    if (!asset) return new Response('Trang không tồn tại.', { status: 404 });
    const [type, content, revision] = asset;
    const cacheControl = revision && url.searchParams.get('v') === revision
      ? 'private, max-age=31536000, immutable'
      : 'private, no-cache';
    const body = request.method === 'HEAD' ? null : type.startsWith('image/') ? decodeImage(content) : content;
    return new Response(body, {
      headers: {
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': cacheControl
      }
    });
  }
};
