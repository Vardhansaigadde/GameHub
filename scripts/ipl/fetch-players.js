// Builds public/data/ipl-players.json from scripts/ipl/players.txt using Wikipedia:
// free-licensed photo (Wikimedia Commons), batting / bowling style and age.
// Usage: node scripts/ipl/fetch-players.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'public', 'data', 'ipl-players.json');
const CACHE = path.join(__dirname, 'cache');
fs.mkdirSync(CACHE, { recursive: true });
const UA = { headers: { 'User-Agent': 'GameHub-ipl-auction/1.0 (personal project)' } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(q) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://en.wikipedia.org/w/api.php?format=json&formatversion=2&maxlag=5&' + q, UA);
    const text = await res.text();
    try { const j = JSON.parse(text); if (!(j.error && j.error.code === 'maxlag')) return j; } catch {}
    if (attempt > 8) throw new Error('gave up: ' + text.slice(0, 80));
    await sleep(3000 * (attempt + 1));
  }
}

// Infobox values sit one per line, e.g. "| bowling = Left-arm [[Fast bowling|fast]]"
const field = (wt, name) => {
  // [ \t] not \s: an empty field must not swallow the next line
  const m = wt.match(new RegExp(String.raw`^[ \t]*\|[ \t]*${name}[ \t]*=[ \t]*(.*)$`, 'im'));
  if (!m) return null;
  return tidy(m[1].replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^}]*\}\}/g, '').replace(/[{}|]/g, '').replace(/<[^>]+>/g, '').replace(/'''?/g, ''));
};
// also repairs values cached by an older version that cut links short ("Left-arm [[Fast bowling")
const tidy = v => {
  if (!v) return null;
  const out = v.replace(/\[\[(?:[^\]|]*\|)?([^\]|]*)\]?\]?/g, (_, t) => t.toLowerCase().replace(/ bowling$/, '')).replace(/\s+/g, ' ').trim();
  return out || null;
};

(async () => {
  const lines = fs.readFileSync(path.join(__dirname, 'players.txt'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const players = [];
  for (const [i, line] of lines.entries()) {
    const [name, role, country, base, marquee] = line.split('|').map(s => s.trim());
    const cacheFile = path.join(CACHE, name.replace(/[^\w]+/g, '_') + '.json');
    let info;
    if (fs.existsSync(cacheFile)) info = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    else {
      const search = await api(`action=query&list=search&srlimit=5&srsearch=${encodeURIComponent(name + ' cricketer')}`);
      const hits = (search.query && search.query.search) || [];
      const full = name.toLowerCase();
      const hit = hits.find(h => h.title.toLowerCase().startsWith(full))
        || hits.find(h => /cricket/i.test(h.snippet) && h.title.toLowerCase().includes(name.split(' ').pop().toLowerCase()) && h.title.includes(' '))
        || hits[0];
      info = { title: null };
      if (hit) {
        await sleep(700);
        const q = await api(`action=query&prop=pageimages|revisions&piprop=thumbnail|name&pithumbsize=400&pilicense=free&rvprop=content&rvsection=0&redirects=1&titles=${encodeURIComponent(hit.title)}`);
        const pg = q.query.pages[0];
        const wt = (pg.revisions && pg.revisions[0].content) || '';
        const born = wt.match(/birth[_ ]date(?: and age)?\s*\|\s*(?:df=\w+\s*\|\s*|mf=\w+\s*\|\s*)?(\d{4})/i);
        info = {
          title: pg.title,
          img: pg.thumbnail ? pg.thumbnail.source : null,
          imgFile: pg.pageimage || null,
          batting: field(wt, 'batting'),
          bowling: field(wt, 'bowling'),
          born: born ? +born[1] : null,
        };
      }
      fs.writeFileSync(cacheFile, JSON.stringify(info));
      await sleep(900);
    }
    // no lead photo: look through the article's other images for a free photo of the player
    if (info.title && !info.img && !info.triedImages) {
      const surname = name.split(' ').pop().toLowerCase().replace(/[^a-z]/g, '');
      const r = await api(`action=query&generator=images&gimlimit=50&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&titles=${encodeURIComponent(info.title)}`);
      const files = ((r.query && r.query.pages) || []).filter(f => /\.(jpe?g|png)$/i.test(f.title) && f.title.toLowerCase().replace(/[^a-z]/g, '').includes(surname) && f.imageinfo);
      const free = files.find(f => !/fair use|non-free/i.test(JSON.stringify(f.imageinfo[0].extmetadata || {})));
      if (free) { info.img = free.imageinfo[0].thumburl; info.imgFile = free.title.replace(/^File:/, ''); }
      info.triedImages = true;
      fs.writeFileSync(cacheFile, JSON.stringify(info));
      await sleep(900);
    }
    players.push({
      id: i,
      name,
      role,
      country,
      overseas: country !== 'India',
      base: Number(base),
      marquee: marquee === 'M',
      img: info.img || null,
      credit: info.imgFile ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(info.imgFile)}` : null,
      wiki: info.title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(info.title.replace(/ /g, '_'))}` : null,
      batting: tidy(info.batting),
      bowling: tidy(info.bowling),
      born: info.born,
    });
    process.stdout.write(info.img ? '+' : '.');
  }
  fs.writeFileSync(OUT, JSON.stringify(players));
  console.log(`\n${players.length} players, ${players.filter(p => p.img).length} with photos -> ${path.relative(ROOT, OUT)}`);
  const noPage = players.filter(p => !p.wiki).map(p => p.name);
  if (noPage.length) console.log('no Wikipedia page found for:', noPage.join(', '));
})();
