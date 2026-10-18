// Re-reads batting / bowling style and birth year for every cached player in a few batched
// Wikipedia requests (50 pages each). Run after fetch-players.js if those fields look wrong.
const fs = require('fs'), path = require('path');
const CACHE = path.join(__dirname, 'cache');
const UA = { headers: { 'User-Agent': 'GameHub-ipl-auction/1.0 (personal project)' } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const field = (wt, name) => {
  // [ \t] not \s: an empty field must not swallow the next line
  const m = wt.match(new RegExp(String.raw`^[ \t]*\|[ \t]*${name}[ \t]*=[ \t]*(.*)$`, 'im'));
  if (!m) return null;
  const v = m[1]
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/[{}|]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return v || null;
};

(async () => {
  const files = fs.readdirSync(CACHE).filter(f => f.endsWith('.json'));
  const byTitle = new Map();
  for (const f of files) {
    const info = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8'));
    if (info.title) byTitle.set(info.title, { f, info });
  }
  const titles = [...byTitle.keys()];
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&action=query&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(batch.join('|'));
    const r = await (await fetch(url, UA)).json();
    for (const pg of r.query.pages) {
      const entry = byTitle.get(pg.title);
      if (!entry || !pg.revisions) continue;
      const wt = pg.revisions[0].slots.main.content;
      const born = wt.match(/birth[_ ]date(?: and age)?\s*\|\s*(?:df=\w+\s*\|\s*|mf=\w+\s*\|\s*)?(\d{4})/i);
      entry.info.batting = field(wt, 'batting');
      entry.info.bowling = field(wt, 'bowling');
      if (born) entry.info.born = +born[1];
      fs.writeFileSync(path.join(CACHE, entry.f), JSON.stringify(entry.info));
    }
    process.stdout.write(`${Math.min(i + 50, titles.length)}/${titles.length} `);
    await sleep(1500);
  }
  console.log('\nstyles refreshed');
})();
