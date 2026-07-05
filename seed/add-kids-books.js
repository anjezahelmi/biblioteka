// Shton librat për fëmijë dhe "Historia e Skënderbeut" (domen publik, Wikisource)
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
  h2 { text-align: center; color: #6b4a1d; margin-top: 50px; }
  h2 small { font-size: 0.65em; font-weight: normal; color: #7a6a45; }
  .sub { text-align: center; color: #7a6a45; margin-bottom: 50px; font-style: italic; }
  hr { border: none; border-top: 1px solid #d8c9a3; margin: 40px auto; width: 40%; }
  img { max-width: 100%; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="sub">${author} · ${note} · Tekstet nga Wikisource (domen publik)</p>
<hr>
${body}
</body>
</html>`;
}

const BOOKS = [
  {
    title: 'Vjersha për fëmijë',
    author: 'Autorë të Rilindjes',
    note: 'Naim Frashëri · Çajupi · Filip Shiroka · Josif Bageri',
    description: 'Përmbledhje vjershash klasike për fëmijë nga poetët e Rilindjes: "Zogu dhe Djali" e Naimit, "Fshati im" i Çajupit, dallëndyshet e Filip Shirokës dhe thirrja për shkollë e Josif Bagerit. Domen publik.',
    category: 'Për fëmijë',
    file: 'vjersha-per-femije.html',
    cover: null,
    body: () =>
      '<h2>Zogu dhe Djali <br><small>Naim Frashëri</small></h2>' + bodyOf('dl_zogu_djali.json') +
      '<h2>Fshati im <br><small>Andon Zako Çajupi</small></h2>' + bodyOf('dl_fshati_im.json') +
      '<h2>Dallëndyshe eja <br><small>Filip Shiroka</small></h2>' + bodyOf('dl_dallendyshe_eja.json') +
      '<h2>Shko Dallëndyshe <br><small>Filip Shiroka</small></h2>' + bodyOf('dl_shko_dallendyshe.json') +
      '<h2>Eni të gjith në msimtore <br><small>Josif Bageri</small></h2>' + bodyOf('dl_eni_msimtore.json'),
  },
  {
    title: 'Fabula për fëmijë',
    author: 'Andon Zako Çajupi',
    note: 'Sipas La Fontenit',
    description: 'Dy fabula plot mësime për të vegjlit, sjellë në shqip nga Çajupi: "Korbi dhe Dhelpra" dhe "Fyell i Beriut". Domen publik.',
    category: 'Për fëmijë',
    file: 'fabula-per-femije.html',
    cover: '/uploads/covers/cajupi.jpg',
    body: () =>
      '<h2>Korbi dhe Dhelpra</h2>' + bodyOf('dl_korbi_dhelpra.json') +
      '<h2>Fyell i Beriut</h2>' + bodyOf('dl_fyell_beriut.json'),
  },
  {
    title: 'Historia e Skënderbeut',
    author: 'Naim Frashëri',
    note: 'Epope, 1898',
    description: 'Epopeja madhore e Naim Frashërit për heroin kombëtar Gjergj Kastrioti — Skënderbeu, vepra që frymëzoi brezat e Rilindjes. Teksti i plotë. Domen publik.',
    category: 'Histori',
    file: 'historia-e-skenderbeut.html',
    cover: '/uploads/covers/naim-frasheri.jpg',
    body: () => bodyOf('dl_skenderbeu.json'),
  },
];

(async () => {
  for (const b of BOOKS) {
    const filePath = '/uploads/books/' + b.file;
    fs.writeFileSync(
      path.join(__dirname, '..', 'uploads', 'books', b.file),
      page(b.title, b.author, b.note, b.body())
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
  await pool.end();
})();
