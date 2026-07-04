// Pastron HTML-në e "Bagëti e Bujqësija" nga Wikisource dhe e ruan si libër HTML
const fs = require('fs');
const path = require('path');

const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'bageti_parsed.json'), 'utf8'));
let html = j.parse.text['*'];

html = html.replace(/<style[\s\S]*?<\/style>/g, '');
html = html.replace(/<table[\s\S]*?<\/table>/, ''); // tabela e header-it te Wikisource
html = html.replace(/<span class="mw-editsection">[\s\S]*?<\/span><\/span>/g, '');
html = html.replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '');
html = html.replace(/<a [^>]*>/g, '<span>').replace(/<\/a>/g, '</span>');
html = html.replace(/<div class="magnify">[\s\S]*?<\/div>/g, '');
html = html.replace(/<!--[\s\S]*?-->/g, '');

const page = `<!DOCTYPE html>
<html lang="sq">
<head>
<meta charset="UTF-8">
<title>Bagëti e Bujqësija — Naim Frashëri</title>
<style>
  body { background: #faf6ec; color: #2a2317; font-family: Georgia, "Times New Roman", serif;
         max-width: 700px; margin: 0 auto; padding: 60px 28px; line-height: 1.9; font-size: 1.12rem; }
  h1 { text-align: center; font-size: 2rem; }
  .sub { text-align: center; color: #7a6a45; margin-bottom: 50px; font-style: italic; }
  .poem, .poem p { text-align: left; }
  hr { border: none; border-top: 1px solid #d8c9a3; margin: 40px auto; width: 40%; }
  img { max-width: 100%; }
</style>
</head>
<body>
<h1>Bagëti e Bujqësija</h1>
<p class="sub">Naim Frashëri · 1886 · Teksti nga Wikisource (domen publik)</p>
<hr>
${html}
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'uploads', 'books', 'bageti-e-bujqesija.html'), page);
console.log('✔ bageti-e-bujqesija.html u krijua,', page.length, 'bajte');
