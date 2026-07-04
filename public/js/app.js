/* ============ Biblioteka Edith Durham — aplikacioni ============ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let TOKEN = localStorage.getItem('token');
let USER = JSON.parse(localStorage.getItem('user') || 'null');
let BOOKS = [];
let CATEGORIES = [];
let ACTIVE_CAT = '';
let epubRendition = null;

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch('/api' + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(false); throw new Error(data.error || 'Sesioni skadoi.'); }
  if (!res.ok) throw new Error(data.error || 'Gabim në server.');
  return data;
}

/* ---------- Router ---------- */
const views = ['auth', 'library', 'reader', 'admin'];
function show(view) {
  views.forEach((v) => $('#view-' + v).classList.toggle('hidden', v !== view));
  const inApp = view !== 'auth';
  $('#topbar').classList.toggle('hidden', !inApp);
  $('#footer').classList.toggle('hidden', !inApp || view === 'reader');
  $$('.topbar-nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === view));
  if (epubRendition && view !== 'reader') { epubRendition.destroy(); epubRendition = null; }
}

// Biblioteka është e hapur për vizitorët — vetëm paneli kërkon admin
async function route() {
  const hash = location.hash || '#/library';
  const [, page, arg] = hash.split('/');
  if (page === 'login') { show('auth'); return; }
  if (page === 'reader' && arg) { await openReader(arg); }
  else if (page === 'admin') {
    if (USER && USER.role === 'admin') { show('admin'); loadAdmin(); }
    else { location.hash = '#/login'; }
  }
  else { show('library'); loadLibrary(); }
}
window.addEventListener('hashchange', route);

/* ---------- Auth ---------- */
$$('.auth-tab').forEach((t) =>
  t.addEventListener('click', () => {
    $$('.auth-tab').forEach((x) => x.classList.toggle('active', x === t));
    $('#form-login').classList.toggle('hidden', t.dataset.tab !== 'login');
    $('#form-register').classList.toggle('hidden', t.dataset.tab !== 'register');
    $('#auth-error').classList.add('hidden');
  })
);

async function handleAuth(e, path) {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try {
    const { token, user } = await api(path, { method: 'POST', body });
    TOKEN = token; USER = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    initShell();
    location.hash = '#/library';
    route();
  } catch (err) {
    const el = $('#auth-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
}
$('#form-login').addEventListener('submit', (e) => handleAuth(e, '/auth/login'));
$('#form-register').addEventListener('submit', (e) => handleAuth(e, '/auth/register'));

function logout(redirect = true) {
  TOKEN = null; USER = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  initShell();
  if (redirect) { location.hash = '#/library'; route(); }
}
$('#btn-logout').addEventListener('click', () => logout());

function initShell() {
  const loggedIn = !!USER;
  $('#user-chip').innerHTML = loggedIn ? `Mirë se erdhe, <strong>${esc(USER.name)}</strong>` : '';
  $('#btn-logout').classList.toggle('hidden', !loggedIn);
  $('#btn-login').classList.toggle('hidden', loggedIn);
  $('#nav-admin').classList.toggle('hidden', !loggedIn || USER.role !== 'admin');
}

/* ---------- Helpers ---------- */
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const COVER_GRADS = [
  ['#1d3b8f', '#0c1531'], ['#7a2a2a', '#2b0d0d'], ['#1d6b4f', '#0a2b1e'],
  ['#6b4a1d', '#2b1c08'], ['#4a2a7a', '#180d2b'], ['#2a6b7a', '#0d242b'],
];
function coverHtml(b, small = false) {
  if (b.cover_path) return `<img src="${esc(b.cover_path)}" alt="" loading="lazy">`;
  const [c1, c2] = COVER_GRADS[b.id % COVER_GRADS.length];
  return `<div class="cover-gen" style="background:linear-gradient(160deg,${c1},${c2})">
      <span class="cg-orn">❦</span>
      <span class="cg-title">${esc(b.title)}</span>
      <span class="cg-author">${esc(b.author)}</span>
    </div>`;
}
function fmtDate(d) { return d ? new Date(d).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }

/* ---------- Library ---------- */
async function loadLibrary() {
  const q = $('#search').value.trim();
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (ACTIVE_CAT) params.set('category', ACTIVE_CAT);
  const data = await api('/books?' + params);
  BOOKS = data.books; CATEGORIES = data.categories;
  renderChips();
  renderGrid();
  loadContinue();
}

function renderChips() {
  $('#chips').innerHTML =
    `<button class="chip ${!ACTIVE_CAT ? 'active' : ''}" data-cat="">Të gjitha</button>` +
    CATEGORIES.map((c) => `<button class="chip ${ACTIVE_CAT === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  $$('#chips .chip').forEach((ch) =>
    ch.addEventListener('click', () => { ACTIVE_CAT = ch.dataset.cat; loadLibrary(); })
  );
}

function renderGrid() {
  $('#book-count').textContent = BOOKS.length + ' libra';
  $('#grid-empty').classList.toggle('hidden', BOOKS.length > 0);
  $('#grid').innerHTML = BOOKS.map((b) => `
    <div class="book-card" data-id="${b.id}">
      <div class="book-cover">${coverHtml(b)}<span class="format-tag">${esc(b.format)}</span></div>
      <div class="book-info">
        <h4>${esc(b.title)}</h4>
        <p>${esc(b.author)}</p>
      </div>
    </div>`).join('');
  $$('#grid .book-card').forEach((card) =>
    card.addEventListener('click', () => openModal(card.dataset.id))
  );
}

let searchTimer;
$('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadLibrary, 300);
});

async function loadContinue() {
  if (!TOKEN) { $('#continue-wrap').classList.add('hidden'); return; }
  const { items } = await api('/progress');
  const inProgress = items.filter((i) => i.progress > 0 && i.progress < 100);
  $('#continue-wrap').classList.toggle('hidden', inProgress.length === 0);
  $('#continue-row').innerHTML = inProgress.map((i) => `
    <div class="glass continue-card" data-id="${i.book_id}">
      <div class="cc-cover">${coverHtml({ id: i.book_id, title: i.title, author: i.author, cover_path: i.cover_path })}</div>
      <div class="cc-body">
        <h5>${esc(i.title)}</h5>
        <p>${esc(i.author)}</p>
        <div class="progress-mini"><div style="width:${i.progress}%"></div></div>
      </div>
      <span class="cc-pct">${Math.round(i.progress)}%</span>
    </div>`).join('');
  $$('#continue-row .continue-card').forEach((c) =>
    c.addEventListener('click', () => { location.hash = '#/reader/' + c.dataset.id; })
  );
}

/* ---------- Modal ---------- */
async function openModal(id) {
  const { book, progress } = await api('/books/' + id);
  const isAdmin = USER && USER.role === 'admin';
  $('#modal-card').innerHTML = `
    <button class="modal-close" id="modal-close">×</button>
    <div class="modal-book">
      <div class="mb-cover"><div class="book-cover">${coverHtml(book)}</div></div>
      <div class="mb-body">
        <h3>${esc(book.title)}</h3>
        <p class="mb-author">${esc(book.author)}</p>
        <p class="mb-cat">${esc(book.category)} · ${esc(book.format).toUpperCase()} · ${book.views} lexime</p>
        <p class="mb-desc">${esc(book.description) || 'Pa përshkrim.'}</p>
        ${progress ? `<p class="mb-cat" style="margin-bottom:10px">Progresi yt: ${Math.round(progress.progress)}%</p>` : ''}
        <div class="mb-actions">
          <button class="btn btn-primary" id="modal-read">${progress && progress.progress > 0 ? 'Vazhdo leximin' : 'Lexo tani'}</button>
          <a class="btn btn-ghost" href="${esc(book.file_path)}" download>Shkarko</a>
          ${isAdmin ? `<button class="btn btn-danger" id="modal-del">Fshi</button>` : ''}
        </div>
      </div>
    </div>`;
  $('#modal').classList.remove('hidden');
  $('#modal-close').onclick = closeModal;
  $('#modal-read').onclick = () => { closeModal(); location.hash = '#/reader/' + book.id; };
  if (isAdmin) $('#modal-del').onclick = async () => {
    if (!confirm(`Të fshihet libri "${book.title}"?`)) return;
    await api('/books/' + book.id, { method: 'DELETE' });
    closeModal(); loadLibrary();
  };
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('.modal-backdrop').addEventListener('click', closeModal);

/* ---------- Reader ---------- */
let progressTimer = null;
let currentBookId = null;

async function openReader(id) {
  const { book, progress } = await api('/books/' + id);
  currentBookId = book.id;
  show('reader');
  $('#reader-title').textContent = book.title;
  $('#reader-author').textContent = book.author;
  $('#reader-download').href = book.file_path;
  $('#epub-prev').classList.add('hidden');
  $('#epub-next').classList.add('hidden');
  setProgressUI(progress ? progress.progress : 0);
  const stage = $('#reader-stage');
  stage.innerHTML = '';

  if (book.format === 'pdf' || book.format === 'html') {
    const iframe = document.createElement('iframe');
    iframe.src = book.file_path;
    stage.appendChild(iframe);
    saveProgress(Math.max(progress ? progress.progress : 0, 5), null);
  } else if (book.format === 'txt') {
    const res = await fetch(book.file_path);
    const text = await res.text();
    stage.innerHTML = `<div class="txt-wrap" id="txt-wrap"><div class="txt-page">${esc(text)}</div></div>`;
    const wrap = $('#txt-wrap');
    if (progress && progress.location) wrap.scrollTop = Number(progress.location) || 0;
    wrap.addEventListener('scroll', () => {
      const pct = (wrap.scrollTop / (wrap.scrollHeight - wrap.clientHeight)) * 100 || 0;
      setProgressUI(pct);
      throttledSave(pct, String(wrap.scrollTop));
    });
  } else if (book.format === 'epub') {
    stage.innerHTML = `<div id="epub-area"></div>`;
    const bookEpub = ePub(book.file_path);
    epubRendition = bookEpub.renderTo('epub-area', { width: '100%', height: '100%', flow: 'paginated' });
    await bookEpub.ready;
    await bookEpub.locations.generate(1000);
    epubRendition.display(progress && progress.location ? progress.location : undefined);
    $('#epub-prev').classList.remove('hidden');
    $('#epub-next').classList.remove('hidden');
    $('#epub-prev').onclick = () => epubRendition.prev();
    $('#epub-next').onclick = () => epubRendition.next();
    epubRendition.on('relocated', (loc) => {
      const pct = bookEpub.locations.percentageFromCfi(loc.start.cfi) * 100;
      setProgressUI(pct);
      throttledSave(pct, loc.start.cfi);
    });
  } else {
    stage.innerHTML = `<div class="txt-wrap"><div class="txt-page">Ky format hapet vetëm me shkarkim.</div></div>`;
  }
}

function setProgressUI(pct) { $('#reader-progressfill').style.width = Math.min(100, pct) + '%'; }
function throttledSave(pct, loc) {
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => saveProgress(pct, loc), 800);
}
async function saveProgress(pct, loc) {
  if (!currentBookId || !TOKEN) return;
  try { await api('/progress/' + currentBookId, { method: 'POST', body: { progress: pct, location: loc } }); } catch {}
}
$('#reader-back').addEventListener('click', () => { location.hash = '#/library'; });

/* ---------- Admin ---------- */
$$('.admin-tab').forEach((t) =>
  t.addEventListener('click', () => {
    $$('.admin-tab').forEach((x) => x.classList.toggle('active', x === t));
    $$('.atab').forEach((p) => p.classList.add('hidden'));
    $('#atab-' + t.dataset.atab).classList.remove('hidden');
  })
);

async function loadAdmin() {
  const [stats, usersData, loginsData, booksData] = await Promise.all([
    api('/admin/stats'),
    api('/admin/users'),
    api('/admin/logins'),
    api('/books'),
  ]);

  // Stat tiles
  $('#stat-tiles').innerHTML = [
    ['Përdorues', stats.users, 'llogari gjithsej'],
    ['Libra', stats.books, 'në koleksion'],
    ['Hyrje (7 ditë)', stats.loginsWeek, 'javën e fundit'],
    ['Lexime', stats.totalReads, 'hapje librash gjithsej'],
  ].map(([l, v, s]) => `<div class="glass stat-tile"><div class="st-label">${l}</div><div class="st-value">${v}</div><div class="st-sub">${s}</div></div>`).join('');

  // Bar chart — një seri e vetme (nuk ka nevojë për legjendë)
  const max = Math.max(1, ...stats.daily.map((d) => d.n));
  $('#chart-logins').innerHTML =
    `<div class="chart-base"></div>` +
    stats.daily.map((d) => `
      <div class="bar-col" title="${d.day}: ${d.n} hyrje">
        <div class="bar" style="height:${(d.n / max) * 140}px"><span class="bar-val">${d.n} hyrje</span></div>
        <span class="bar-day">${d.day}</span>
      </div>`).join('');

  // Users table
  $('#table-users tbody').innerHTML = usersData.users.map((u) => `
    <tr>
      <td><strong>${esc(u.name)}</strong></td>
      <td>${esc(u.email)}</td>
      <td><span class="role-badge role-${u.role}">${u.role === 'admin' ? 'Admin' : 'Përdorues'}</span></td>
      <td>${u.login_count}</td>
      <td>${fmtDate(u.last_login)}</td>
      <td>${u.id !== USER.id ? `<button class="btn btn-danger btn-sm" data-del-user="${u.id}">Fshi</button>` : ''}</td>
    </tr>`).join('');
  $$('#table-users [data-del-user]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Të fshihet ky përdorues?')) return;
      await api('/admin/users/' + b.dataset.delUser, { method: 'DELETE' });
      loadAdmin();
    })
  );

  // Logins table
  $('#table-logins tbody').innerHTML = loginsData.logins.map((l) => `
    <tr>
      <td><strong>${esc(l.name)}</strong></td>
      <td>${esc(l.email)}</td>
      <td>${esc(l.ip)}</td>
      <td title="${esc(l.user_agent)}">${esc((l.user_agent || '').split(' ')[0])}</td>
      <td>${fmtDate(l.logged_at)}</td>
    </tr>`).join('');

  // Books table
  $('#table-books tbody').innerHTML = booksData.books.map((b) => `
    <tr>
      <td><strong>${esc(b.title)}</strong></td>
      <td>${esc(b.author)}</td>
      <td>${esc(b.category)}</td>
      <td>${esc(b.format).toUpperCase()}</td>
      <td>${b.views}</td>
      <td><button class="btn btn-danger btn-sm" data-del-book="${b.id}">Fshi</button></td>
    </tr>`).join('');
  $$('#table-books [data-del-book]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Të fshihet ky libër?')) return;
      await api('/books/' + btn.dataset.delBook, { method: 'DELETE' });
      loadAdmin();
    })
  );

  // Category datalist for upload form
  $('#cat-list').innerHTML = booksData.categories.map((c) => `<option value="${esc(c)}">`).join('');
}

$('#form-upload').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#upload-msg');
  msg.className = 'form-msg'; msg.textContent = 'Duke ngarkuar…'; msg.classList.remove('hidden');
  try {
    const fd = new FormData(e.target);
    const res = await fetch('/api/books', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN }, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gabim gjatë ngarkimit.');
    msg.classList.add('ok'); msg.textContent = `✔ Libri "${data.book.title}" u ngarkua me sukses!`;
    e.target.reset();
    loadAdmin();
  } catch (err) {
    msg.classList.add('err'); msg.textContent = err.message;
  }
});

$('#form-newuser').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#newuser-msg');
  msg.className = 'form-msg'; msg.classList.remove('hidden');
  try {
    const body = Object.fromEntries(new FormData(e.target));
    const { user } = await api('/admin/users', { method: 'POST', body });
    msg.classList.add('ok'); msg.textContent = `✔ Përdoruesi "${user.name}" u krijua.`;
    e.target.reset();
    loadAdmin();
  } catch (err) {
    msg.classList.add('err'); msg.textContent = err.message;
  }
});

/* ---------- Paralaksi i heroit ---------- */
(function initParallax() {
  const wrap = $('#hero-parallax');
  if (!wrap) return;

  // Pluhur ari që noton lart
  const P = $('#hp-particles');
  for (let i = 0; i < 26; i++) {
    const d = document.createElement('span');
    d.className = 'hp-dust';
    const size = 2 + Math.random() * 6;
    d.style.width = d.style.height = size + 'px';
    d.style.left = Math.random() * 100 + '%';
    d.style.animationDuration = 9 + Math.random() * 14 + 's';
    d.style.animationDelay = -Math.random() * 20 + 's';
    d.style.setProperty('--sway', (Math.random() * 120 - 60) + 'px');
    d.style.setProperty('--o', (0.35 + Math.random() * 0.5).toFixed(2));
    P.appendChild(d);
  }

  // Shtresat lëvizin me shpejtësi të ndryshme në scroll + tilt i lehtë me miun
  const layers = $$('#hero-parallax [data-depth]');
  let mx = 0, my = 0, ticking = false;
  function apply() {
    ticking = false;
    const sc = window.scrollY;
    layers.forEach((l) => {
      const depth = Number(l.dataset.depth);
      const ty = sc * depth * 0.6 + my * depth * 30;
      const tx = mx * depth * 36;
      l.style.transform =
        `translate3d(${tx}px, ${ty}px, 0)` + (l.classList.contains('hp-photo') ? ' scale(1.08)' : '');
    });
  }
  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }
  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
    tick();
  });
})();

/* ---------- Start ---------- */
initShell();
route();
