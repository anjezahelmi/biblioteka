require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sekret';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Upload (multer) ----------
const ALLOWED = { '.pdf': 'pdf', '.epub': 'epub', '.txt': 'txt', '.html': 'html', '.htm': 'html' };
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'cover' ? 'uploads/covers' : 'uploads/books';
    cb(null, path.join(__dirname, dir));
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.normalize('NFKD').replace(/[^\w.\-]+/g, '_');
    cb(null, Date.now() + '_' + safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'cover') {
      return cb(null, /image\/(png|jpe?g|webp|svg)/.test(file.mimetype));
    }
    cb(null, path.extname(file.originalname).toLowerCase() in ALLOWED);
  },
});

// ---------- Auth helpers ----------
function sign(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Ju duhet të kyçeni.' });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Vetëm administratori.' });
  next();
}
// Leximi është publik: nëse ka token të vlefshëm e mbajmë, përndryshe vazhdon si vizitor
function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

// ---------- Auth routes ----------
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Plotëso emrin, email-in dhe fjalëkalim me të paktën 6 karaktere.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, role`,
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    res.json({ token: sign(r.rows[0]), user: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ky email është i regjistruar tashmë.' });
    throw e;
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const r = await pool.query('SELECT * FROM users WHERE email = $1', [(email || '').trim().toLowerCase()]);
  const user = r.rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash)))
    return res.status(401).json({ error: 'Email ose fjalëkalim i gabuar.' });
  await pool.query('INSERT INTO logins (user_id, ip, user_agent) VALUES ($1, $2, $3)', [
    user.id,
    req.ip,
    req.headers['user-agent'] || '',
  ]);
  res.json({ token: sign(user), user: { id: user.id, name: user.name, role: user.role } });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

// ---------- Books ----------
app.get('/api/books', optionalAuth, async (req, res) => {
  const { q, category } = req.query;
  const params = [];
  let where = 'WHERE 1=1';
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    where += ` AND category = $${params.length}`;
  }
  const r = await pool.query(`SELECT * FROM books ${where} ORDER BY created_at DESC`, params);
  const cats = await pool.query('SELECT DISTINCT category FROM books ORDER BY category');
  res.json({ books: r.rows, categories: cats.rows.map((c) => c.category) });
});

app.get('/api/books/:id', optionalAuth, async (req, res) => {
  await pool.query('UPDATE books SET views = views + 1 WHERE id = $1', [req.params.id]);
  const r = await pool.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Libri nuk u gjet.' });
  let progress = null;
  if (req.user) {
    const p = await pool.query(
      'SELECT progress, location FROM reading_progress WHERE user_id = $1 AND book_id = $2',
      [req.user.id, req.params.id]
    );
    progress = p.rows[0] || null;
  }
  res.json({ book: r.rows[0], progress });
});

app.post('/api/books', auth, adminOnly, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
  const file = req.files && req.files.file && req.files.file[0];
  if (!file) return res.status(400).json({ error: 'Zgjidh një skedar libri (PDF, EPUB, TXT ose HTML).' });
  const cover = req.files.cover && req.files.cover[0];
  const format = ALLOWED[path.extname(file.originalname).toLowerCase()];
  const { title, author, description, category } = req.body;
  const r = await pool.query(
    `INSERT INTO books (title, author, description, category, format, file_path, cover_path, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      title || file.originalname,
      author || 'I panjohur',
      description || '',
      category || 'Të përgjithshme',
      format,
      '/uploads/books/' + file.filename,
      cover ? '/uploads/covers/' + cover.filename : null,
      req.user.id,
    ]
  );
  res.json({ book: r.rows[0] });
});

app.put('/api/books/:id', auth, adminOnly, upload.single('cover'), async (req, res) => {
  const { title, author, description, category } = req.body;
  const cover = req.file ? '/uploads/covers/' + req.file.filename : null;
  const r = await pool.query(
    `UPDATE books SET title = COALESCE($1, title), author = COALESCE($2, author),
       description = COALESCE($3, description), category = COALESCE($4, category),
       cover_path = COALESCE($5, cover_path)
     WHERE id = $6 RETURNING *`,
    [title, author, description, category, cover, req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Libri nuk u gjet.' });
  res.json({ book: r.rows[0] });
});

app.delete('/api/books/:id', auth, adminOnly, async (req, res) => {
  const r = await pool.query('DELETE FROM books WHERE id = $1 RETURNING file_path, cover_path', [req.params.id]);
  const b = r.rows[0];
  if (b) {
    for (const p of [b.file_path, b.cover_path]) {
      if (p) fs.unlink(path.join(__dirname, p), () => {});
    }
  }
  res.json({ ok: true });
});

// ---------- Reading progress ----------
app.post('/api/progress/:bookId', auth, async (req, res) => {
  const { progress, location } = req.body || {};
  await pool.query(
    `INSERT INTO reading_progress (user_id, book_id, progress, location, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, book_id) DO UPDATE SET progress = $3, location = $4, updated_at = now()`,
    [req.user.id, req.params.bookId, Math.min(100, Math.max(0, Number(progress) || 0)), location || null]
  );
  res.json({ ok: true });
});

app.get('/api/progress', auth, async (req, res) => {
  const r = await pool.query(
    `SELECT rp.*, b.title, b.author, b.format, b.cover_path FROM reading_progress rp
     JOIN books b ON b.id = rp.book_id WHERE rp.user_id = $1 ORDER BY rp.updated_at DESC LIMIT 12`,
    [req.user.id]
  );
  res.json({ items: r.rows });
});

// ---------- Admin ----------
app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  const r = await pool.query(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           COUNT(l.id)::int AS login_count, MAX(l.logged_at) AS last_login
    FROM users u LEFT JOIN logins l ON l.user_id = u.id
    GROUP BY u.id ORDER BY u.created_at DESC`);
  res.json({ users: r.rows });
});

app.post('/api/admin/users', auth, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Plotëso emrin, email-in dhe fjalëkalim me të paktën 6 karaktere.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
      [name.trim(), email.trim().toLowerCase(), hash, role === 'admin' ? 'admin' : 'user']
    );
    res.json({ user: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ky email është i regjistruar tashmë.' });
    throw e;
  }
});

app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Nuk mund të fshish veten.' });
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/admin/logins', auth, adminOnly, async (req, res) => {
  const r = await pool.query(`
    SELECT l.id, l.ip, l.user_agent, l.logged_at, u.name, u.email
    FROM logins l JOIN users u ON u.id = l.user_id
    ORDER BY l.logged_at DESC LIMIT 100`);
  res.json({ logins: r.rows });
});

app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
  const [users, books, logins, reads, daily] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS n FROM users'),
    pool.query('SELECT COUNT(*)::int AS n FROM books'),
    pool.query(`SELECT COUNT(*)::int AS n FROM logins WHERE logged_at > now() - interval '7 days'`),
    pool.query('SELECT COALESCE(SUM(views), 0)::int AS n FROM books'),
    pool.query(`
      SELECT to_char(d, 'DD.MM') AS day, COUNT(l.id)::int AS n
      FROM generate_series(current_date - 6, current_date, interval '1 day') d
      LEFT JOIN logins l ON l.logged_at::date = d::date
      GROUP BY d ORDER BY d`),
  ]);
  res.json({
    users: users.rows[0].n,
    books: books.rows[0].n,
    loginsWeek: logins.rows[0].n,
    totalReads: reads.rows[0].n,
    daily: daily.rows,
  });
});

// SPA fallback
app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Gabim në server.' });
});

// ---------- Start ----------
const SAMPLE_BOOKS = require('./seed/sample-books.json');
init(SAMPLE_BOOKS)
  .then(() => {
    app.listen(PORT, () => console.log(`📚 Biblioteka "Edith Durham" → http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('Nuk u lidh me PostgreSQL:', e.message);
    console.error('Kontrollo kredencialet te skedari .env');
    process.exit(1);
  });
