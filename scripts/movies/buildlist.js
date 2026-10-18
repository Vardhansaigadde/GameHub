// Turns the downloaded Wikipedia wikitext into [{ t: title, y: year, e: 1 if "easy" }]
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'wiki');
const out = process.argv[2];
const films = new Map(); // lowercase title -> film
let skippedDub = 0;

for (const f of fs.readdirSync(dir)) {
  const { title, wikitext } = JSON.parse(fs.readFileSync(path.join(dir, f)));
  const m = title.match(/(\d{4})(s?)$/);
  const pageYear = +m[1];
  const decade = !!m[2];
  const text = wikitext.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  // walk sections so dubbed-film tables can be skipped
  const parts = text.split(/^(==+[^=\n]+==+)\s*$/m);
  let heading = '';
  for (const part of parts) {
    if (/^==/.test(part)) { heading = part; continue; }
    if (/dub/i.test(heading)) { skippedDub++; continue; }
    const tables = part.match(/\{\|[\s\S]*?\n\|\}/g) || [];
    for (const table of tables) {
      for (const row of table.split(/\n\|-[^\n]*/).slice(1)) {
        const it = row.match(/(?<!')''(?!')(.+?)(?<!')''(?!')/);
        if (!it) continue;
        let raw = it[1].trim();
        let linked = false;
        const link = raw.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
        if (link) { linked = true; raw = (link[2] || link[1].replace(/\s*\([^)]*\)\s*$/, '')); }
        const t = raw.replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/['\[\]]/g, '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 60 || /^(ref|refs|tba|untitled)/i.test(t)) continue;
        let y = pageYear;
        if (decade) { const yy = row.match(/\b(19[34]\d)\b/); if (yy) y = +yy[1]; }
        const key = t.toLowerCase() + '|' + y; // same name in different years = different films (remakes)
        const prev = films.get(key);
        const film = { t, y, e: linked && y >= 1995 ? 1 : 0 };
        if (!prev || film.y > prev.y || (film.e && !prev.e)) films.set(key, prev ? { ...film, e: film.e || prev.e } : film);
      }
    }
  }
}
const list = [...films.values()].filter(f => f.y <= new Date().getFullYear()).sort((a, b) => a.y - b.y || a.t.localeCompare(b.t));
fs.writeFileSync(out, JSON.stringify(list));
const byDecade = {};
for (const f of list) byDecade[Math.floor(f.y / 10) * 10] = (byDecade[Math.floor(f.y / 10) * 10] || 0) + 1;
console.log('films', list.length, 'easy', list.filter(f => f.e).length, 'dub sections skipped', skippedDub);
console.log(byDecade);
console.log(list.filter((_, i) => i % Math.max(1, Math.floor(list.length / 25)) === 0).map(f => `${f.t} (${f.y})${f.e ? '*' : ''}`).join(' | '));
