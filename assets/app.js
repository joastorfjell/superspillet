/* Superspillet – planleggingsbasen
   Ren HTML/CSS/JS, ingen byggesteg. Data kommer fra:
   - GitHub API (issues, commits, liste over docs/)
   - Filer i repoet (docs/*.md, data/*.json)
*/

const CONFIG = {
  owner: 'joastorfjell',
  repo: 'superspillet',
  branch: 'main',
};

const REPO_URL = `https://github.com/${CONFIG.owner}/${CONFIG.repo}`;
const STATUS_LABELS = ['diskuteres', 'bestemt'];

// ---------- Hjelpere ----------

const $ = (sel, root = document) => root.querySelector(sel);

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function timeAgo(iso) {
  const sec = (Date.now() - new Date(iso)) / 1000;
  const steps = [[60, 'sekunder'], [60, 'minutter'], [24, 'timer'], [30, 'dager'], [12, 'måneder']];
  let val = sec;
  let unit = 'sekunder';
  for (const [size, name] of steps) {
    unit = name;
    if (val < size) break;
    val /= size;
  }
  if (val >= 12 && unit === 'måneder') return `${Math.floor(val / 12)} år siden`;
  return `${Math.max(1, Math.floor(val))} ${unit} siden`;
}

function fmt(n) {
  if (!isFinite(n)) return '∞';
  return Math.round(n).toLocaleString('nb-NO');
}

function textColorFor(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#111' : '#fff';
}

async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    prompt('Kopier manuelt:', text);
  }
}

// GitHub API uten innlogging: 60 kall i timen per IP. Vi cacher i 5 min.
async function gh(path, { fresh = false } = {}) {
  const key = `gh:${path}`;
  if (!fresh) {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { t, d } = JSON.parse(cached);
      if (Date.now() - t < 5 * 60 * 1000) return d;
    }
  }
  const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(res.status === 403
      ? 'GitHub-grensen er nådd (60 kall i timen). Prøv igjen om litt.'
      : `GitHub svarte ${res.status}`);
  }
  const data = await res.json();
  sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
  return data;
}

async function getIssues(fresh = false) {
  const all = await gh('/issues?state=all&per_page=100', { fresh });
  return all.filter((i) => !i.pull_request);
}

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Fant ikke ${path}`);
  return res.json();
}

const hasLabel = (issue, name) => issue.labels.some((l) => l.name === name);
const votes = (issue) => issue.reactions?.['+1'] ?? 0;

// ---------- Ruting ----------

const loaded = new Set();
const views = {
  hjem: initHome,
  tavle: initBoard,
  dokumenter: initDocs,
  okonomi: initEconomy,
  by: initCity,
};

function route() {
  const [, name = 'hjem', ...rest] = location.hash.split('/');
  const view = views[name] ? name : 'hjem';
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.route === view));

  if (!loaded.has(view)) {
    loaded.add(view);
    views[view]();
  }
  if (view === 'dokumenter') showDoc(decodeURIComponent(rest.join('/')));
  if (view === 'by') city.resize();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// ---------- Snø ----------

function initSnow() {
  const canvas = $('#snow');
  const ctx = canvas.getContext('2d');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let flakes = [];
  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const count = Math.min(120, Math.floor(innerWidth / 12));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      s: Math.random() * 0.6 + 0.2,
      w: Math.random() * Math.PI * 2,
    }));
  }
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#dfefff';
    for (const f of flakes) {
      f.y += f.s;
      f.w += 0.01;
      f.x += Math.sin(f.w) * 0.3;
      if (f.y > canvas.height) { f.y = -4; f.x = Math.random() * canvas.width; }
      ctx.globalAlpha = f.r / 2.2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  addEventListener('resize', resize);
  resize();
  tick();
}

// ---------- Hjem ----------

async function initHome() {
  try {
    const issues = await getIssues();
    const open = issues.filter((i) => i.state === 'open' && !hasLabel(i, 'bestemt'));
    const decided = issues.filter((i) => hasLabel(i, 'bestemt') || (i.state === 'closed' && i.state_reason !== 'not_planned'));
    $('#stat-open').textContent = open.length;
    $('#stat-decided').textContent = decided.length;

    const top = [...open].sort((a, b) => votes(b) - votes(a) || b.comments - a.comments).slice(0, 6);
    $('#top-list').innerHTML = top.length
      ? top.map((i) => `<li><span class="votes">👍 ${votes(i)}</span><a href="${i.html_url}" target="_blank" rel="noopener">${esc(i.title)}</a></li>`).join('')
      : '<li class="muted">Ingen ideer ennå – lag den første!</li>';
  } catch (err) {
    $('#top-list').innerHTML = `<li class="muted">${esc(err.message)}</li>`;
  }

  try {
    const commits = await gh('/commits?per_page=100');
    $('#stat-commits').textContent = commits.length >= 100 ? '100+' : commits.length;
    $('#commit-list').innerHTML = commits.slice(0, 7).map((c) => {
      const who = c.author?.login ?? c.commit.author.name;
      const avatar = c.author?.avatar_url ?? `https://github.com/identicons/${encodeURIComponent(who)}.png`;
      const msg = c.commit.message.split('\n')[0];
      return `<li>
        <img src="${avatar}&s=56" alt="">
        <div>
          <a class="msg" href="${c.html_url}" target="_blank" rel="noopener">${esc(msg)}</a>
          <div class="meta">${esc(who)} · ${timeAgo(c.commit.author.date)} · <code>${c.sha.slice(0, 7)}</code></div>
        </div>
      </li>`;
    }).join('');
  } catch (err) {
    $('#commit-list').innerHTML = `<li class="muted">${esc(err.message)}</li>`;
  }
}

// ---------- Idétavle ----------

const COLUMNS = [
  { name: '💡 Nye', test: (i) => i.state === 'open' && !hasLabel(i, 'diskuteres') && !hasLabel(i, 'bestemt') },
  { name: '🗣️ Diskuteres', test: (i) => i.state === 'open' && hasLabel(i, 'diskuteres') && !hasLabel(i, 'bestemt') },
  { name: '✅ Bestemt / ferdig', test: (i) => hasLabel(i, 'bestemt') || (i.state === 'closed' && i.state_reason !== 'not_planned') },
  { name: '🗑️ Forkastet', test: (i) => i.state === 'closed' && i.state_reason === 'not_planned' && !hasLabel(i, 'bestemt') },
];

const board = { issues: [], filter: null };

async function initBoard(fresh = false) {
  $('#board').innerHTML = '<p class="muted">Henter issues fra GitHub …</p>';
  try {
    board.issues = await getIssues(fresh);
  } catch (err) {
    $('#board').innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    return;
  }

  const labels = new Map();
  board.issues.forEach((i) => i.labels.forEach((l) => {
    if (!STATUS_LABELS.includes(l.name)) labels.set(l.name, l.color);
  }));
  const chips = [['Alle', null, 'ff3b5c'], ...[...labels].map(([name, color]) => [name, name, color])];
  $('#label-filter').innerHTML = chips.map(([text, value, color]) =>
    `<button class="chip${board.filter === value ? ' active' : ''}" data-value="${esc(value ?? '')}" style="--chip:#${color}">${esc(text)}</button>`,
  ).join('');
  renderBoard();
}

function renderBoard() {
  const list = board.issues.filter((i) => !board.filter || hasLabel(i, board.filter));
  $('#board').innerHTML = COLUMNS.map((col) => {
    const cards = list.filter(col.test).sort((a, b) => votes(b) - votes(a) || new Date(b.updated_at) - new Date(a.updated_at));
    return `<div class="column">
      <h3>${col.name}<span class="count">${cards.length}</span></h3>
      ${cards.map(cardHTML).join('') || '<div class="empty">Tomt her.</div>'}
    </div>`;
  }).join('');
}

function cardHTML(issue) {
  const labels = issue.labels
    .filter((l) => !STATUS_LABELS.includes(l.name))
    .map((l) => `<span class="label" style="background:#${l.color};color:${textColorFor(l.color)}">${esc(l.name)}</span>`)
    .join('');
  return `<a class="card" href="${issue.html_url}" target="_blank" rel="noopener">
    <div class="title">${esc(issue.title)} <span class="num">#${issue.number}</span></div>
    ${labels ? `<div class="labels">${labels}</div>` : ''}
    <div class="foot">
      <span>👍 ${votes(issue)}</span>
      <span>💬 ${issue.comments}</span>
      <span>${timeAgo(issue.updated_at)}</span>
      <img src="${issue.user.avatar_url}&s=40" alt="${esc(issue.user.login)}" title="${esc(issue.user.login)}">
    </div>
  </a>`;
}

$('#label-filter').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  board.filter = chip.dataset.value || null;
  document.querySelectorAll('#label-filter .chip').forEach((c) => c.classList.toggle('active', c === chip));
  renderBoard();
});

$('#refresh-issues').addEventListener('click', () => initBoard(true));

// ---------- Dokumenter ----------

const FALLBACK_DOCS = ['01-visjon.md', '02-krav.md', '03-sjangeren.md', '04-teknologi.md', '05-veikart.md', 'LAER-GIT.md', 'team.md'];
let docFiles = null;

async function initDocs() {
  try {
    const list = await gh('/contents/docs');
    docFiles = list.filter((f) => f.type === 'file' && f.name.endsWith('.md')).map((f) => f.name);
  } catch {
    docFiles = FALLBACK_DOCS;
  }
  renderDocList();
  const [, , ...rest] = location.hash.split('/');
  showDoc(decodeURIComponent(rest.join('/')));
}

function docTitle(file) {
  return file.replace(/\.md$/, '').replace(/^\d+-/, '').replace(/[-_]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase()).replace('LAER GIT', 'Lær Git');
}

function renderDocList(active) {
  $('#docs-list').innerHTML = docFiles.map((f) =>
    `<li><a href="#/dokumenter/${encodeURIComponent(f)}" class="${f === active ? 'active' : ''}">${esc(docTitle(f))}</a></li>`,
  ).join('');
}

async function showDoc(file) {
  if (!docFiles) return; // initDocs kaller oss igjen når lista er klar
  file = file || docFiles[0];
  renderDocList(file);
  const body = $('#doc-body');
  body.innerHTML = '<p class="muted">Laster …</p>';
  try {
    const res = await fetch(`docs/${file}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Fant ikke docs/${file}`);
    const md = await res.text();
    const edit = `<a class="edit-link" href="${REPO_URL}/edit/${CONFIG.branch}/docs/${encodeURIComponent(file)}" target="_blank" rel="noopener">✏️ Rediger på GitHub</a>`;
    body.innerHTML = edit + DOMPurify.sanitize(marked.parse(md));
    body.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (/^(https?:|#|mailto:)/.test(href)) {
        if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
        return;
      }
      if (href.endsWith('.md') && !href.includes('/')) {
        a.setAttribute('href', `#/dokumenter/${href}`);
      } else {
        a.href = `${REPO_URL}/blob/${CONFIG.branch}/docs/${href}`;
        a.target = '_blank';
      }
    });
  } catch (err) {
    body.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

// ---------- Tid & økonomi ----------

const ECO_KEY = 'superspillet:okonomi';
const eco = { valuta: 'kr', innstillinger: {}, handlinger: [], original: null };
let buildingsPromise = null;

const getBuildings = () => (buildingsPromise ??= getJSON('data/bygninger.json'));

async function initEconomy() {
  try {
    eco.original = await getJSON('data/handlinger.json');
  } catch (err) {
    $('#eco-table').innerHTML = `<tr><td class="muted">${esc(err.message)}</td></tr>`;
    return;
  }
  const saved = localStorage.getItem(ECO_KEY);
  loadEco(saved ? JSON.parse(saved) : eco.original);
  try {
    eco.bygninger = (await getBuildings()).bygninger;
  } catch {
    eco.bygninger = [];
  }
  renderEco();
}

function loadEco(data) {
  const copy = structuredClone(data);
  eco.valuta = copy.valuta ?? 'kr';
  eco.innstillinger = copy.innstillinger ?? {};
  eco.handlinger = copy.handlinger ?? [];
  const s = eco.innstillinger;
  $('#eco-checkins').value = s.innsjekk_per_dag ?? 5;
  $('#eco-xpbase').value = s.xp_til_niva_2 ?? 100;
  $('#eco-xpgrowth').value = s.xp_vekst_per_niva ?? 1.35;
  $('#eco-maxlevel').value = s.maks_niva ?? 15;
}

function ecoData() {
  return {
    valuta: eco.valuta,
    innstillinger: {
      innsjekk_per_dag: +$('#eco-checkins').value,
      xp_til_niva_2: +$('#eco-xpbase').value,
      xp_vekst_per_niva: +$('#eco-xpgrowth').value,
      maks_niva: +$('#eco-maxlevel').value,
    },
    handlinger: eco.handlinger,
  };
}

function saveEco() {
  localStorage.setItem(ECO_KEY, JSON.stringify(ecoData()));
}

// Hvor mange ganger rekker man en handling per døgn, gitt N jevne innsjekk?
function runsPerDay(waitMin, checkins) {
  const interval = 1440 / checkins;
  if (waitMin <= 0) return checkins;
  return checkins / Math.ceil(waitMin / interval);
}

const ECO_FIELDS = [
  ['navn', 'Handling', 'text'],
  ['niva', 'Nivå', 'number'],
  ['ventetid_min', 'Ventetid (min)', 'number'],
  ['kostnad', 'Kostnad', 'number'],
  ['belonning', 'Belønning', 'number'],
  ['sjanse', 'Sjanse %', 'number'],
  ['xp', 'XP', 'number'],
];

function renderEco() {
  const head = `<tr>${ECO_FIELDS.map(([, label]) => `<th>${label}</th>`).join('')}
    <th>Snitt netto/runde</th><th>Runder/dag</th><th>Netto/dag</th><th>XP/dag</th><th></th></tr>`;
  const rows = eco.handlinger.map((h, idx) => `<tr data-idx="${idx}">
    ${ECO_FIELDS.map(([key, , type]) => `<td><input type="${type}" data-key="${key}" value="${esc(h[key])}" class="${type === 'text' ? 'wide' : ''}" ${type === 'number' ? 'min="0"' : ''}></td>`).join('')}
    <td class="num out" data-out="netto"></td>
    <td class="num" data-out="runder"></td>
    <td class="num out" data-out="dag"></td>
    <td class="num" data-out="xpdag"></td>
    <td><button class="del" title="Fjern">✕</button></td>
  </tr>`).join('');
  $('#eco-table').innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;
  renderEcoOutputs();
}

function renderEcoOutputs() {
  const s = ecoData().innstillinger;
  const checkins = Math.max(1, s.innsjekk_per_dag || 1);

  const stats = eco.handlinger.map((h) => {
    const runs = runsPerDay(+h.ventetid_min || 0, checkins);
    // Forventet verdi: belønning og XP kun når det lykkes, kostnaden betales uansett
    const chance = Math.min(100, Math.max(0, h.sjanse ?? 100)) / 100;
    const net = (+h.belonning || 0) * chance - (+h.kostnad || 0);
    return { niva: +h.niva || 1, runs, net, perDay: runs * net, xpDay: runs * (+h.xp || 0) * chance };
  });

  document.querySelectorAll('#eco-table tbody tr').forEach((tr, i) => {
    const st = stats[i];
    tr.querySelector('[data-out="netto"]').textContent = `${fmt(st.net)} ${eco.valuta}`;
    tr.querySelector('[data-out="runder"]').textContent = st.runs.toFixed(1).replace('.', ',');
    tr.querySelector('[data-out="dag"]').textContent = `${fmt(st.perDay)} ${eco.valuta}`;
    tr.querySelector('[data-out="xpdag"]').textContent = fmt(st.xpDay);
  });

  // Simuler progresjon dag for dag
  const maxLevel = Math.max(2, s.maks_niva || 15);
  const need = (lvl) => Math.round((s.xp_til_niva_2 || 100) * Math.pow(s.xp_vekst_per_niva || 1.35, lvl - 1));
  const reached = { 1: 0 };
  let level = 1;
  let xp = 0;
  for (let day = 1; day <= 730 && level < maxLevel; day++) {
    const xpDay = stats.filter((st) => st.niva <= level).reduce((sum, st) => sum + st.xpDay, 0);
    if (xpDay <= 0) break;
    xp += xpDay;
    while (level < maxLevel && xp >= need(level)) {
      xp -= need(level);
      level += 1;
      reached[level] = day;
    }
  }

  const unlocksAt = (lvl) => [
    ...eco.handlinger.filter((h) => (+h.niva || 1) === lvl).map((h) => h.navn),
    ...(eco.bygninger ?? []).filter((b) => (b.niva || 1) === lvl).map((b) => `🏢 ${b.navn}`),
  ];

  const rows = [];
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const day = reached[lvl];
    const when = lvl === 1 ? 'Start' : day === undefined ? '🚫 Når aldri' : day === 1 ? 'Dag 1' : `Dag ${day}`;
    rows.push(`<tr>
      <td>${lvl}</td>
      <td class="num">${lvl === 1 ? '–' : fmt(need(lvl - 1))}</td>
      <td class="num">${when}</td>
      <td class="unlock">${esc(unlocksAt(lvl).join(', '))}</td>
    </tr>`);
  }
  $('#eco-progress').innerHTML = `<thead><tr><th>Nivå</th><th>XP krevd</th><th>Nås</th><th>Låser opp</th></tr></thead><tbody>${rows.join('')}</tbody>`;

  const incomes = [];
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    incomes.push(stats.filter((st) => st.niva <= lvl).reduce((sum, st) => sum + st.perDay, 0));
  }
  const max = Math.max(1, ...incomes);
  $('#eco-bars').innerHTML = incomes.map((v, i) => `<div class="bar-row">
    <span>Nv. ${i + 1}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, v / max * 100)}%"></div></div>
    <span class="val">${fmt(v)}</span>
  </div>`).join('');
}

$('#eco-table').addEventListener('input', (e) => {
  const input = e.target.closest('input');
  if (!input) return;
  const h = eco.handlinger[input.closest('tr').dataset.idx];
  h[input.dataset.key] = input.type === 'number' ? +input.value : input.value;
  saveEco();
  renderEcoOutputs();
});

$('#eco-table').addEventListener('click', (e) => {
  if (!e.target.closest('.del')) return;
  eco.handlinger.splice(e.target.closest('tr').dataset.idx, 1);
  saveEco();
  renderEco();
});

$('.eco-controls').addEventListener('input', () => {
  saveEco();
  renderEcoOutputs();
});

$('#eco-add').addEventListener('click', () => {
  eco.handlinger.push({ navn: 'Ny handling', niva: 1, ventetid_min: 60, kostnad: 0, belonning: 100, sjanse: 100, xp: 10 });
  saveEco();
  renderEco();
});

$('#eco-reset').addEventListener('click', () => {
  if (!eco.original) return;
  localStorage.removeItem(ECO_KEY);
  loadEco(eco.original);
  renderEco();
  toast('Tilbakestilt til data/handlinger.json');
});

$('#eco-copy').addEventListener('click', () =>
  copyText(JSON.stringify(ecoData(), null, 2) + '\n', 'Kopiert! Lim inn i data/handlinger.json og commit 🚀'));

// ---------- Byplanlegger ----------

const CITY_KEY = 'superspillet:by';

const city = {
  canvas: null,
  ctx: null,
  size: 14,
  types: new Map(),
  placed: [],
  tool: null,
  hover: null,
  painting: false,
  tw: 40,
  th: 20,
  ox: 0,
  oy: 0,
  resize() {},
};

async function initCity() {
  city.canvas = $('#city');
  city.ctx = city.canvas.getContext('2d');
  let data;
  try {
    data = await getBuildings();
  } catch (err) {
    $('#palette').innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    return;
  }
  city.size = data.rutenett ?? 14;
  data.bygninger.forEach((b) => city.types.set(b.id, b));

  const fromLink = new URLSearchParams(location.search).get('by');
  if (fromLink) {
    try {
      city.placed = JSON.parse(atob(fromLink)).map(([id, x, y]) => ({ id, x, y }));
      history.replaceState(null, '', location.pathname + location.hash);
      toast('Layout lastet fra delt lenke');
    } catch {
      toast('Klarte ikke å lese lenken');
    }
  } else {
    city.placed = JSON.parse(localStorage.getItem(CITY_KEY) ?? '[]');
  }
  city.placed = city.placed.filter((p) => city.types.has(p.id));

  const tools = [{ id: '__riv', navn: 'Riv', farge: '#ff3b5c', ikon: '🧹' }, ...data.bygninger];
  $('#palette').innerHTML = tools.map((b) => `<button class="tool" data-id="${b.id}" title="${esc(b.beskrivelse ?? '')}">
    <span class="swatch" style="background:${b.farge}">${b.ikon ?? ''}</span>
    <span>${esc(b.navn)}${b.bredde ? `<small>${b.bredde}×${b.dybde} · nivå ${b.niva ?? 1}</small>` : '<small>klikk på et bygg</small>'}</span>
  </button>`).join('');
  selectTool(data.bygninger[0].id);

  city.resize = resizeCity;
  addEventListener('resize', resizeCity);
  resizeCity();

  city.canvas.addEventListener('pointermove', (e) => {
    city.hover = tileAt(e);
    if (city.painting) applyTool(city.hover);
    drawCity();
  });
  city.canvas.addEventListener('pointerdown', (e) => {
    city.canvas.setPointerCapture(e.pointerId);
    city.painting = true;
    city.hover = tileAt(e);
    applyTool(city.hover);
    drawCity();
  });
  const stop = () => { city.painting = false; };
  city.canvas.addEventListener('pointerup', stop);
  city.canvas.addEventListener('pointercancel', stop);
  city.canvas.addEventListener('pointerleave', () => { city.hover = null; drawCity(); });
}

function selectTool(id) {
  city.tool = id;
  document.querySelectorAll('.tool').forEach((t) => t.classList.toggle('active', t.dataset.id === id));
  const b = city.types.get(id);
  $('#city-tip').textContent = b ? `${b.navn}: ${b.beskrivelse ?? ''}` : 'Riv: klikk eller dra over bygg for å fjerne dem';
}

$('#palette').addEventListener('click', (e) => {
  const t = e.target.closest('.tool');
  if (t) selectTool(t.dataset.id);
});

function resizeCity() {
  if (!city.canvas || !city.canvas.offsetWidth) return;
  const dpr = devicePixelRatio || 1;
  const w = city.canvas.offsetWidth;
  const h = city.canvas.offsetHeight;
  city.canvas.width = w * dpr;
  city.canvas.height = h * dpr;
  city.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = city.size;
  city.tw = Math.min(w / (n + 1), (h * 0.85) / (n * 0.5 + 3));
  city.th = city.tw / 2;
  city.ox = w / 2;
  city.oy = (h - n * city.th) / 2 + city.th * 1.5;
  drawCity();
}

const iso = (x, y) => [city.ox + (x - y) * city.tw / 2, city.oy + (x + y) * city.th / 2];

function tileAt(e) {
  const r = city.canvas.getBoundingClientRect();
  const dx = (e.clientX - r.left - city.ox) / (city.tw / 2);
  const dy = (e.clientY - r.top - city.oy) / (city.th / 2);
  const x = Math.floor((dx + dy) / 2);
  const y = Math.floor((dy - dx) / 2);
  return x >= 0 && y >= 0 && x < city.size && y < city.size ? { x, y } : null;
}

function footprint(p) {
  const t = city.types.get(p.id);
  return { x: p.x, y: p.y, w: t.bredde, d: t.dybde };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
}

function canPlace(id, x, y) {
  const t = city.types.get(id);
  if (x + t.bredde > city.size || y + t.dybde > city.size) return false;
  const fp = { x, y, w: t.bredde, d: t.dybde };
  return !city.placed.some((p) => overlaps(fp, footprint(p)));
}

function applyTool(tile) {
  if (!tile) return;
  if (city.tool === '__riv') {
    const before = city.placed.length;
    city.placed = city.placed.filter((p) => !overlaps({ ...tile, w: 1, d: 1 }, footprint(p)));
    if (city.placed.length !== before) saveCity();
  } else if (canPlace(city.tool, tile.x, tile.y)) {
    city.placed.push({ id: city.tool, x: tile.x, y: tile.y });
    saveCity();
  }
}

function saveCity() {
  localStorage.setItem(CITY_KEY, JSON.stringify(city.placed));
}

function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function poly(points, fill, stroke) {
  const ctx = city.ctx;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

// Deterministisk "tilfeldig" så vinduene ikke blinker ved hver tegning
function hash(a, b, c) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function drawBox(p, type, alpha = 1, tint = null) {
  const ctx = city.ctx;
  const { x, y } = p;
  const w = type.bredde;
  const d = type.dybde;
  const hPx = (type.hoyde ?? 1) * city.th;
  const color = tint ?? type.farge;
  const up = ([sx, sy], h = hPx) => [sx, sy - h];

  const g00 = iso(x, y), g10 = iso(x + w, y), g11 = iso(x + w, y + d), g01 = iso(x, y + d);
  ctx.globalAlpha = alpha;

  if (type.form === 'tre') {
    const [cx, cy] = iso(x + w / 2, y + d / 2);
    const s = city.tw * 0.32;
    poly([[cx - 2, cy], [cx + 2, cy], [cx + 2, cy - s * 0.5], [cx - 2, cy - s * 0.5]], '#4a3523');
    poly([[cx - s, cy - s * 0.4], [cx + s, cy - s * 0.4], [cx, cy - s * 1.9]], shade(color, -0.05));
    poly([[cx - s * 0.75, cy - s * 1.1], [cx + s * 0.75, cy - s * 1.1], [cx, cy - s * 2.6]], color);
    poly([[cx - s * 0.3, cy - s * 2.1], [cx + s * 0.3, cy - s * 2.1], [cx, cy - s * 2.6]], '#eaf4ff');
    ctx.globalAlpha = 1;
    return;
  }

  if (hPx <= 0) {
    poly([g00, g10, g11, g01], color, 'rgba(0,0,0,.25)');
    ctx.globalAlpha = 1;
    return;
  }

  // Venstre (fram mot venstre) og høyre (fram mot høyre) side, så tak
  poly([g01, g11, up(g11), up(g01)], shade(color, -0.08));
  poly([g10, g11, up(g11), up(g10)], shade(color, -0.22));
  poly([up(g00), up(g10), up(g11), up(g01)], shade(color, 0.12), 'rgba(255,255,255,.12)');

  // Opplyste vinduer
  if ((type.hoyde ?? 0) >= 1 && alpha === 1 && !type.uten_vinduer) {
    const floors = type.hoyde;
    const faces = [
      { a: g01, len: w, ex: (g11[0] - g01[0]) / w, ey: (g11[1] - g01[1]) / w, side: 0 },
      { a: g11, len: d, ex: (g10[0] - g11[0]) / d, ey: (g10[1] - g11[1]) / d, side: 1 },
    ];
    for (const f of faces) {
      for (let fl = 0; fl < floors; fl++) {
        for (let u = 0; u < f.len * 2; u++) {
          const lit = hash(x * 7 + u, y * 13 + fl, f.side + type.id.length) > 0.45;
          const u0 = (u + 0.3) / 2, u1 = (u + 0.7) / 2;
          const v0 = (fl + 0.35) * city.th, v1 = (fl + 0.75) * city.th;
          const pt = (uu, vv) => [f.a[0] + f.ex * uu, f.a[1] + f.ey * uu - vv];
          poly([pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)], lit ? 'rgba(255,214,120,.85)' : 'rgba(10,15,25,.45)');
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawCity() {
  const ctx = city.ctx;
  if (!ctx) return;
  const n = city.size;
  ctx.clearRect(0, 0, city.canvas.width, city.canvas.height);

  // Bakke
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const snow = hash(x, y, 3) > 0.8;
      poly([iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)],
        snow ? '#22304a' : '#1b2638', 'rgba(124,200,255,.07)');
    }
  }
  // Kant på brettet
  poly([iso(0, n), iso(n, n), [iso(n, n)[0], iso(n, n)[1] + 10], [iso(0, n)[0], iso(0, n)[1] + 10]], '#0d1420');
  poly([iso(n, 0), iso(n, n), [iso(n, n)[0], iso(n, n)[1] + 10], [iso(n, 0)[0], iso(n, 0)[1] + 10]], '#080d16');

  // Bygg: tegn bakerst først
  const items = city.placed.map((p) => ({ p, t: city.types.get(p.id) }));
  const flat = items.filter((i) => (i.t.hoyde ?? 1) <= 0 && i.t.form !== 'tre');
  const tall = items.filter((i) => !flat.includes(i));
  flat.forEach(({ p, t }) => drawBox(p, t));
  tall.sort((a, b) => (a.p.x + a.t.bredde / 2 + a.p.y + a.t.dybde / 2) - (b.p.x + b.t.bredde / 2 + b.p.y + b.t.dybde / 2))
    .forEach(({ p, t }) => drawBox(p, t));

  // Forhåndsvisning
  const h = city.hover;
  if (h && city.tool === '__riv') {
    poly([iso(h.x, h.y), iso(h.x + 1, h.y), iso(h.x + 1, h.y + 1), iso(h.x, h.y + 1)], 'rgba(255,59,92,.35)', '#ff3b5c');
  } else if (h) {
    const t = city.types.get(city.tool);
    const ok = canPlace(city.tool, h.x, h.y);
    drawBox(h, t, 0.55, ok ? null : '#ff3b5c');
  }

  const counts = {};
  city.placed.forEach((p) => { counts[p.id] = (counts[p.id] ?? 0) + 1; });
  ctx.fillStyle = '#8a98b0';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`${city.placed.length} ting plassert`, 14, 22);
}

$('#city-clear').addEventListener('click', () => {
  if (!city.placed.length || !confirm('Tømme hele byen?')) return;
  city.placed = [];
  saveCity();
  drawCity();
});

$('#city-share').addEventListener('click', () => {
  const code = btoa(JSON.stringify(city.placed.map((p) => [p.id, p.x, p.y])));
  const url = `${location.origin}${location.pathname}?by=${encodeURIComponent(code)}#/by`;
  copyText(url, 'Lenke kopiert – send den til makkeren din!');
});

$('#city-copy').addEventListener('click', () =>
  copyText(JSON.stringify(city.placed, null, 2) + '\n', 'Layout kopiert som JSON'));

// ---------- Oppstart ----------

$('#repo-link').href = REPO_URL;
$('#new-idea-link').href = `${REPO_URL}/issues/new?template=ide.yml`;
$('#new-issue-link').href = `${REPO_URL}/issues/new/choose`;
initSnow();
route();
