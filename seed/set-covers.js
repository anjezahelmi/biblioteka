// Vendos portretet e autorëve si kopertina të librave ekzistues
const { pool } = require('../db');

const COVERS = [
  ['/uploads/books/bageti-e-bujqesija.html', '/uploads/covers/naim-frasheri.jpg'],
  ['/uploads/books/cajupi-naim-frasheri.html', '/uploads/covers/cajupi.jpg'],
  ['/uploads/books/baba-tomori.html', '/uploads/covers/cajupi.jpg'],
  ['/uploads/books/vaji-i-bylbylit.html', '/uploads/covers/ndre-mjeda.jpg'],
  ['/uploads/books/andrra-e-jetes.html', '/uploads/covers/ndre-mjeda.jpg'],
  ['/uploads/books/edith-durham-jeta.html', '/uploads/covers/edith-durham.jpg'],
];

(async () => {
  for (const [file, cover] of COVERS) {
    const r = await pool.query('UPDATE books SET cover_path = $1 WHERE file_path = $2 RETURNING title', [cover, file]);
    console.log(r.rows[0] ? '✔ ' + r.rows[0].title : '✘ Nuk u gjet: ' + file);
  }
  await pool.end();
})();
