import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const page = readFileSync('public/index.html', 'utf8');
const stylesheet = readFileSync('public/style.css', 'utf8');
const script = readFileSync('public/app.js', 'utf8');
const imageSources = /<img src="([^"]+\.webp)"/g;
const backgroundSources = /url\("([^"]+\.webp)"\)/g;
const images = new Map(
  [...page.matchAll(imageSources), ...stylesheet.matchAll(backgroundSources)].map(([, filename]) => [
    filename, readFileSync('public/' + filename).toString('base64')
  ])
);
const worker = readFileSync('worker.mjs', 'utf8');
const revision = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const imageFiles = new Map([...images].map(([filename, content]) => [filename, filename + '?v=' + revision(content)]));
const hostedStylesheet = stylesheet.replace(backgroundSources, (_, filename) => 'url("' + imageFiles.get(filename) + '")');
const preloadBackground = `<script>
    const backgrounds = ${JSON.stringify({
      '#tho': imageFiles.get('nen-vuon-tho.webp'),
      '#luu-but': imageFiles.get('nen-luu-but.webp'),
      default: imageFiles.get('nen-lich-su.webp'),
    })};
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'image';
    preload.fetchPriority = 'high';
    preload.href = backgrounds[location.hash] ?? backgrounds.default;
    document.head.append(preload);
  </script>`;
const hostedPage = page
  .replace('<!-- Hosted builds preload the background of the initial scene here. -->', preloadBackground)
  .replace('href="style.css"', 'href="style.css?v=' + revision(hostedStylesheet) + '"')
  .replace('src="app.js"', 'src="app.js?v=' + revision(script) + '"')
  .replace(imageSources, (_, filename) => '<img src="' + imageFiles.get(filename) + '"')
  .replace('</head>', '  <meta name="guestbook-endpoint" content="/api/luu-but">\n</head>');
const assets = {
  '/index.html': ['text/html; charset=utf-8', hostedPage],
  '/style.css': ['text/css; charset=utf-8', hostedStylesheet, revision(hostedStylesheet)],
  '/app.js': ['text/javascript; charset=utf-8', script, revision(script)],
  ...Object.fromEntries([...images].map(([filename, image]) => ['/' + filename, ['image/webp', image, revision(image)]])),
};

mkdirSync('.build', { recursive: true });
writeFileSync('.build/index.js', 'const assets = ' + JSON.stringify(assets) + ';\n' + worker);

if (process.argv[2]) {
  const inlineStylesheet = stylesheet.replace(backgroundSources, (_, filename) => 'url("data:image/webp;base64,' + images.get(filename) + '")');
  const standalone = page
    .replace('<!-- Hosted builds preload the background of the initial scene here. -->', '')
    .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + inlineStylesheet + '</style>')
    .replace('<script src="app.js" defer></script>', '')
    .replace(imageSources, (_, filename) => '<img src="data:image/webp;base64,' + images.get(filename) + '"')
    .replace('</body>', () => '<script>' + script + '</script>\n</body>');
  writeFileSync(process.argv[2], standalone);
}
