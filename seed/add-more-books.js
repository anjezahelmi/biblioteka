// Shton grupin e dytë të veprave në domen publik (Wikisource), me kopertina
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
    title: 'Fjalët e Qiririt',
    author: 'Naim Frashëri',
    note: 'Poezi',
    description: 'Poezia më e njohur e Naim Frashërit — qiriri që digjet për t\'u dhënë dritë të tjerëve, simbol i vetëmohimit të poetit për atdheun. Domen publik.',
    category: 'Poezi',
    file: 'fjalet-e-qiririt.html',
    cover: '/uploads/covers/naim-frasheri.jpg',
    body: () => bodyOf('dl_fjalet_qiririt.json'),
  },
  {
    title: 'Poema e Mjerimit',
    author: 'Migjeni',
    note: '1936',
    description: 'Kryevepra e Migjenit (1911–1938) — klithma tronditëse për varfërinë dhe padrejtësinë shoqërore, një nga majat e poezisë shqipe. Domen publik.',
    category: 'Poezi',
    file: 'poema-e-mjerimit.html',
    cover: '/uploads/covers/migjeni.jpg',
    body: () => bodyOf('dl_poema_mjerimit.json'),
  },
  {
    title: 'Shqypnia',
    author: 'Gjergj Fishta',
    note: 'Poezi',
    description: 'Himni madhështor i At Gjergj Fishtës (1871–1940) për bukurinë e Shqipërisë — nga poeti i "Lahutës së Malcís". Domen publik.',
    category: 'Poezi',
    file: 'shqypnia.html',
    cover: '/uploads/covers/gjergj-fishta.jpg',
    body: () => bodyOf('dl_shqypnia.json'),
  },
  {
    title: 'O Moj Shqypni',
    author: 'Pashko Vasa',
    note: '1880',
    description: 'Vjersha flakëruese e Rilindjes nga Pashko Vasa (1825–1892) me vargun e pavdekshëm "Feja e shqyptarit asht shqyptaria". Domen publik.',
    category: 'Poezi',
    file: 'o-moj-shqypni.html',
    cover: '/uploads/covers/pashko-vasa.jpg',
    body: () => bodyOf('dl_o_moj_shqypni.json'),
  },
  {
    title: 'Fabula të zgjedhura',
    author: 'Ezopi & La Fonteni',
    note: 'Përkthyer nga Naim Frashëri dhe A. Z. Çajupi',
    description: 'Tri fabula klasike botërore të sjella në shqip nga mjeshtrit e Rilindjes: "Ujku dhe Qengji" (përkth. Naim Frashëri), "Bretkosa që deshi të trashej sa një Ka" dhe "Ujku që gjykohet me Dhelprën" (përkth. Çajupi). Domen publik.',
    category: 'Përkthime',
    file: 'fabula-te-zgjedhura.html',
    cover: null,
    body: () =>
      '<h2>Ujku dhe Qengji <br><small>përktheu Naim Frashëri</small></h2>' + bodyOf('dl_ujku_qengji.json') +
      '<h2>Bretkosa që deshi të trashej sa një Ka <br><small>përktheu A. Z. Çajupi</small></h2>' + bodyOf('dl_bretkosa.json') +
      '<h2>Ujku që gjykohet me Dhelprën përpara Majmunit <br><small>përktheu A. Z. Çajupi</small></h2>' + bodyOf('dl_ujku_dhelpra.json'),
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
