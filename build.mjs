import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const page = readFileSync('public/index.html', 'utf8');
const stylesheet = readFileSync('public/style.css', 'utf8');
const script = readFileSync('public/app.js', 'utf8');
const imageSources = /<img src="([^"]+\.webp)"/g;
const stylesheetSources = /url\("([^"]+\.(?:webp|woff))"\)/g;
const binaries = new Map(
  [...page.matchAll(imageSources), ...stylesheet.matchAll(stylesheetSources)].map(([, filename]) => [
    filename, {
      type: filename.endsWith('.woff') ? 'font/woff' : 'image/webp',
      data: readFileSync('public/' + filename).toString('base64')
    }
  ])
);
const fontLicense = readFileSync('public/OFL-Spectral.txt', 'utf8');
const worker = readFileSync('worker.mjs', 'utf8');
const revision = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const assetFiles = new Map([...binaries].map(([filename, { data }]) => [filename, filename + '?v=' + revision(data)]));
const hostedStylesheet = stylesheet.replace(stylesheetSources, (_, filename) => 'url("' + assetFiles.get(filename) + '")');
const preloadBackground = `<script>
    const backgrounds = ${JSON.stringify({
      '#tho': assetFiles.get('nen-vuon-tho.webp'),
      '#luu-but': assetFiles.get('nen-luu-but.webp'),
      default: assetFiles.get('nen-lich-su.webp'),
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
  .replace(imageSources, (_, filename) => '<img src="' + assetFiles.get(filename) + '"')
  .replace('</head>', '  <meta name="guestbook-endpoint" content="/api/luu-but">\n</head>');
const assets = {
  '/index.html': ['text/html; charset=utf-8', hostedPage],
  '/style.css': ['text/css; charset=utf-8', hostedStylesheet, revision(hostedStylesheet)],
  '/app.js': ['text/javascript; charset=utf-8', script, revision(script)],
  '/OFL-Spectral.txt': ['text/plain; charset=utf-8', fontLicense],
  ...Object.fromEntries([...binaries].map(([filename, { type, data }]) => ['/' + filename, [type, data, revision(data)]])),
};

mkdirSync('.build', { recursive: true });
writeFileSync('.build/index.js', 'const assets = ' + JSON.stringify(assets) + ';\n' + worker);

if (process.argv[2]) {
  const dataUrl = filename => {
    const { type, data } = binaries.get(filename);
    return 'data:' + type + ';base64,' + data;
  };
  const inlineStylesheet = stylesheet.replace(stylesheetSources, (_, filename) => 'url("' + dataUrl(filename) + '")');
  const standalone = page
    .replace('<!-- Hosted builds preload the background of the initial scene here. -->', '')
    .replace('<link rel="stylesheet" href="style.css">', () => '<!--\n' + fontLicense + '\n-->\n<style>' + inlineStylesheet + '</style>')
    .replace('<script src="app.js" defer></script>', '')
    .replace(imageSources, (_, filename) => '<img src="' + dataUrl(filename) + '"')
    .replace('</body>', () => '<script>' + script + '</script>\n</body>');
  writeFileSync(process.argv[2], standalone.replace(/[\t ]+$/gm, ''));
}
