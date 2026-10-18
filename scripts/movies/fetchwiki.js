// Downloads each "List of Telugu films of ..." page's wikitext + which linked pages exist.
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'wiki');
fs.mkdirSync(OUT, { recursive: true });
const UA = { headers: { 'User-Agent': 'GameHub-charades-list/1.0 (personal project)' } };
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
(async () => {
  const pages = [];
  for (let y = 1931; y <= new Date().getFullYear(); y++) pages.push(`List of Telugu films of ${y}`);
  pages.push('List of Telugu films of the 1930s');
  for (const title of pages) {
    const file = path.join(OUT, title.replace(/[^\w]+/g, '_') + '.json');
    if (fs.existsSync(file)) continue;
    const p = await api('action=parse&prop=wikitext&redirects=1&page=' + encodeURIComponent(title));
    if (p.error) { continue; }
    const exists = {};
    fs.writeFileSync(file, JSON.stringify({ title: p.parse.title, wikitext: p.parse.wikitext, exists }));
    process.stdout.write('.');
    await sleep(1000);
  }
  console.log('\nfiles:', fs.readdirSync(OUT).length);
})();
