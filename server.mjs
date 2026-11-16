import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import worker from './.build/index.js';

const host = '127.0.0.1';
const port = 4173;
const origin = `http://${host}:${port}`;

mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
const database = new DatabaseSync(fileURLToPath(new URL('./data/guestbook.sqlite', import.meta.url)));
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
  if (incoming.headers.host !== `${host}:${port}` || !incoming.url.startsWith('/') || incoming.url.startsWith('//')) {
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
