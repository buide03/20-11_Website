import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './.build/index.js';

const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const port = Number(process.env.PORT || 4173);
const origin = new URL(process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${port}`).origin;
const allowedHosts = new Set([new URL(origin).host, `127.0.0.1:${port}`, `localhost:${port}`]);
const dataDirectory = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : fileURLToPath(new URL('./data/', import.meta.url));

mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(join(dataDirectory, 'guestbook.sqlite'));
database.exec('PRAGMA busy_timeout = 5000');
database.exec(readFileSync(new URL('./drizzle/0000_guestbook.sql', import.meta.url), 'utf8'));

const environment = {
  DB: {
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        async all() {
          return { results: statement.all() };
        },
        bind(...parameters) {
          return { first: async () => statement.get(...parameters) };
        }
      };
    }
  }
};

const server = createServer(async (incoming, outgoing) => {
  if (!allowedHosts.has(incoming.headers.host) || !incoming.url.startsWith('/') || incoming.url.startsWith('//')) {
    outgoing.writeHead(400).end('Địa chỉ truy cập không hợp lệ.');
    return;
  }

  try {
    const body = [];
    if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
      let length = 0;
      for await (const chunk of incoming) {
        length += chunk.length;
        if (length > 4096) {
          outgoing.writeHead(413).end('Lời nhắn quá dài.');
          return;
        }
        body.push(chunk);
      }
    }

    const request = new Request(origin + incoming.url, {
      method: incoming.method,
      headers: incoming.headers,
      body: body.length ? Buffer.concat(body) : undefined
    });
    const result = await worker.fetch(request, environment);
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    outgoing.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end('Có lỗi khi tải trang.');
  }
});

server.listen(port, host, () => console.log(`Mở trang 20/11 tại ${origin}`));

process.on('SIGTERM', () => {
  server.close(() => {
    database.close();
    process.exit(0);
  });
});
