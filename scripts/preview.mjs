import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from './compiler.mjs';

// Browser-only sample catalogue. Never shipped, and no Tizen/native API is mocked.
const demo = `<script>
var previewApps = JSON.parse(localStorage.getItem('coast.apps') || 'null') || [
  {id:'9Ur5IzDKqV.TizenYouTube',name:'YouTube',icon:'assets/icons/app-1.png'},
  {id:'org.tizen.netflix-app',name:'Netflix',icon:''},
  {id:'org.tizen.primevideo',name:'Prime Video',icon:'assets/icons/app-0.png'},
  {id:'rJeHak5zRg.Spotify',name:'Spotify',icon:''},
  {id:'org.tizen.browser',name:'Browser',icon:'assets/icons/app-2.png'}
];
// Demo identity only: a real HBO Max launch target must come from native discovery.
if (!previewApps.some(function(app) { return /^(hbo\\s*max|max)$/i.test(app.name); }))
  previewApps.push({id:'DemoApp001.hbomax',name:'HBO Max',icon:''});
localStorage.setItem('coast.apps', JSON.stringify(previewApps));
var previewSettings = JSON.parse(localStorage.getItem('coast.settings') || 'null');
var previewHbo = previewApps.find(function(app) { return /^(hbo\\s*max|max)$/i.test(app.name); });
if (previewSettings && previewHbo) {
  var previewProfile = previewSettings.profiles[previewSettings.active || 0];
  if (previewProfile.order && previewProfile.order.indexOf(previewHbo.id) < 0) {
    previewProfile.order.push(previewHbo.id);
    localStorage.setItem('coast.settings', JSON.stringify(previewSettings));
  }
}
</script>`;
// Sample sources are UI data only. The real adapter still reports Preview on selection.
const demoSources = `<script>
if (!Coast.platform.tv) {
  Coast.platform.sources = [
    {id:'TV:1',name:'Live TV',type:'TV',number:1,connected:true,raw:{type:'TV',number:1}},
    {id:'HDMI:1',name:'HDMI 1',type:'HDMI',number:1,connected:true,raw:{type:'HDMI',number:1}},
    {id:'HDMI:2',name:'HDMI 2',type:'HDMI',number:2,connected:false,raw:{type:'HDMI',number:2}}
  ];
  Coast.render();
}
</script>`;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2'
};
const server = http.createServer(async (req, res) => {
  try {
    const name =
      decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') ||
      'index.html';
    const file = path.resolve(root, 'dist', name);
    if (!file.startsWith(path.join(root, 'dist') + path.sep)) throw Error('Invalid path');
    let content = await fs.readFile(file);
    if (name === 'index.html')
      content = content
        .toString()
        .replace('<script src="platform.js">', demo + '<script src="platform.js">')
        .replace('<script src="app.js"></script>', '<script src="app.js"></script>' + demoSources);
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(4173, '127.0.0.1', () =>
  console.log(
    'JustTV local preview: http://127.0.0.1:4173 — arrow keys, Enter, Esc; I: inputs, C: controls.'
  )
);
