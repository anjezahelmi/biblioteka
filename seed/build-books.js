// Pastron HTML-në e veprave të shkarkuara nga Wikisource, i ruan si libra HTML
// dhe i regjistron në databazë (nëse nuk ekzistojnë tashmë).
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

function clean(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<table[\s\S]*?<\/table>/, '') // tabela e header-it te Wikisource
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

const BOOKS = [
  {
    title: 'Vaji i Bylbylit',
    author: 'Ndre Mjeda',
    note: '1887',
    description: 'Poema e njohur e Ndre Mjedës (1866–1937), vajtimi i bilbilit të mbyllur në kafaz — simbol i Shqipërisë nën robëri. Domen publik.',
    category: 'Poezi',
    file: 'vaji-i-bylbylit.html',
    body: () => bodyOf('dl_Vaji_i_Bylbylit.json'),
  },
  {
    title: 'Baba Tomori',
    author: 'Andon Zako Çajupi',
    note: 'Nga vëllimi "Baba-Tomorri", 1902',
    description: 'Poezia që i dha emrin vëllimit të parë poetik të Çajupit (1866–1930), himn për malin e shenjtë të Tomorit dhe atdheun. Domen publik.',
    category: 'Poezi',
    file: 'baba-tomori.html',
    body: () => bodyOf('dl_Baba_Tomori.json'),
  },
  {
    title: 'Andrra e Jetës',
    author: 'Ndre Mjeda',
    note: 'Trilogjia: Trina · Lokja · Zoga',
    description: 'Kryevepra lirike e Ndre Mjedës — trilogjia "Andrra e Jetës" (Trina, Lokja, Zoga), tablo prekëse e jetës malësore shqiptare. Domen publik.',
    category: 'Poezi',
    file: 'andrra-e-jetes.html',
    body: () =>
      '<h2>Trina</h2>' + bodyOf('dl_Andrra_e_JetC3ABs_Trina.json') +
      '<h2>Lokja</h2>' + bodyOf('dl_Andrra_e_JetC3ABs_Lokja.json') +
      '<h2>Zoga</h2>' + bodyOf('dl_Andrra_e_JetC3ABs_Zoga.json'),
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
        `INSERT INTO books (title, author, description, category, format, file_path)
         VALUES ($1, $2, $3, $4, 'html', $5)`,
        [b.title, b.author, b.description, b.category, filePath]
      );
      console.log('✔ U shtua:', b.title);
    } else {
      console.log('· Ekziston:', b.title);
    }
  }
  await pool.end();
})();
