// Ndan përmbledhjet për fëmijë në libra më vete (një vepër = një libër)
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

function clean(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<table[\s\S]*?<\/table>/, '')
    .replace(/<span class="mw-editsection">[\s\S]*?<\/span><\/span>/g, '')
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '')
    .replace(/<a [^>]*>/g, '<span>')
    .replace(/<\/a>/g, '</span>')
    .replace(/<div class="magnify">[\s\S]*?<\/div>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function bodyOf(file) {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  return clean(j.parse.text['*']);
}

function page(title, author, note, body) {
  return `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<title>${title} — ${author}</title>
<style>
  body { background: #faf6ec; color: #2a2317; font-family: Georgia, "Times New Roman", serif;
         max-width: 700px; margin: 0 auto; padding: 60px 28px; line-height: 1.9; font-size: 1.12rem; }
  h1 { text-align: center; font-size: 2rem; }
  .sub { text-align: center; color: #7a6a45; margin-bottom: 50px; font-style: italic; }
  hr { border: none; border-top: 1px solid #d8c9a3; margin: 40px auto; width: 40%; }
  img { max-width: 100%; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="sub">${author} · ${note} · Teksti nga Wikisource (domen publik)</p>
<hr>
${body}
</body>
</html>`;
}

const REMOVE = ['/uploads/books/vjersha-per-femije.html', '/uploads/books/fabula-per-femije.html'];

const BOOKS = [
  { title: 'Zogu dhe Djali', author: 'Naim Frashëri', note: 'Vjershë për fëmijë',
    description: 'Vjersha prekëse e Naimit për zogun dhe djalin — mësim dhembshurie për të vegjlit. Domen publik.',
    category: 'Për fëmijë', file: 'zogu-dhe-djali.html', cover: '/uploads/covers/naim-frasheri.jpg', src: 'dl_zogu_djali.json' },
  { title: 'Fshati im', author: 'Andon Zako Çajupi', note: 'Vjershë për fëmijë',
    description: 'Vjersha e dashur e Çajupit për bukurinë e fshatit dhe vendlindjes, e mësuar brez pas brezi në shkollat shqipe. Domen publik.',
    category: 'Për fëmijë', file: 'fshati-im.html', cover: '/uploads/covers/cajupi.jpg', src: 'dl_fshati_im.json' },
  { title: 'Dallëndyshe eja', author: 'Filip Shiroka', note: 'Vjershë për fëmijë',
    description: 'Filip Shiroka (1859–1935) i këndon dallëndyshes që kthehet në pranverë — mall për atdheun nga mërgimi. Domen publik.',
    category: 'Për fëmijë', file: 'dallendyshe-eja.html', cover: '/uploads/covers/filip-shiroka.jpg', src: 'dl_dallendyshe_eja.json' },
  { title: 'Shko Dallëndyshe', author: 'Filip Shiroka', note: 'Vjershë',
    description: 'Vjersha e famshme e Shirokës — porosia për dallëndyshen që niset drejt Shqipërisë. Domen publik.',
    category: 'Për fëmijë', file: 'shko-dallendyshe.html', cover: '/uploads/covers/filip-shiroka.jpg', src: 'dl_shko_dallendyshe.json' },
  { title: 'Eni të gjith në msimtore', author: 'Josif Bageri', note: 'Vjershë për fëmijë',
    description: 'Thirrja e Josif Bagerit (1870–1915) për fëmijët që të vijnë në shkollë e të mësojnë gjuhën shqipe. Domen publik.',
    category: 'Për fëmijë', file: 'eni-te-gjith-ne-msimtore.html', cover: '/uploads/covers/josif-bageri.jpg', src: 'dl_eni_msimtore.json' },
  { title: 'Korbi dhe Dhelpra', author: 'Andon Zako Çajupi', note: 'Fabul sipas La Fontenit',
    description: 'Fabula klasike e korbit mendjelehtë dhe dhelprës dinake, përkthyer mjeshtërisht nga Çajupi. Domen publik.',
    category: 'Për fëmijë', file: 'korbi-dhe-dhelpra.html', cover: '/uploads/covers/cajupi.jpg', src: 'dl_korbi_dhelpra.json' },
  { title: 'Fyell i Beriut', author: 'Andon Zako Çajupi', note: 'Fabul',
    description: 'Fabula e Çajupit plot mësime për të vegjlit. Domen publik.',
    category: 'Për fëmijë', file: 'fyell-i-beriut.html', cover: '/uploads/covers/cajupi.jpg', src: 'dl_fyell_beriut.json' },
];

(async () => {
  for (const fp of REMOVE) {
    const r = await pool.query('DELETE FROM books WHERE file_path = $1 RETURNING title', [fp]);
    if (r.rows[0]) console.log('✘ U hoq përmbledhja:', r.rows[0].title);
  }
  for (const b of BOOKS) {
    const filePath = '/uploads/books/' + b.file;
    fs.writeFileSync(
      path.join(__dirname, '..', 'uploads', 'books', b.file),
      page(b.title, b.author, b.note, bodyOf(b.src))
    );
    const exists = await pool.query('SELECT 1 FROM books WHERE file_path = $1', [filePath]);
    if (exists.rowCount === 0) {
      await pool.query(
        `INSERT INTO books (title, author, description, category, format, file_path, cover_path)
         VALUES ($1, $2, $3, $4, 'html', $5, $6)`,
        [b.title, b.author, b.description, b.category, filePath, b.cover]
      );
      console.log('✔ U shtua:', b.title);
    } else {
      console.log('· Ekziston:', b.title);
    }
  }
  const c = await pool.query('SELECT COUNT(*)::int n FROM books');
  console.log('Gjithsej libra:', c.rows[0].n);
  await pool.end();
})();
