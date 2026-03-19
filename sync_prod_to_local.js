import mysql from 'mysql2/promise';

const PROD = {
  host: 'caboose.proxy.rlwy.net',
  port: 47600,
  user: 'root',
  password: 'EbazKEjKVfdmhYwWjRJujPIARvRIDcxG',
  database: 'railway',
};

const LOCAL = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'chatbot_psico',
};

async function main() {
  const prod = await mysql.createConnection(PROD);
  const local = await mysql.createConnection(LOCAL);

  await local.query('SET FOREIGN_KEY_CHECKS = 0');
  await local.query('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"');

  // ── 1) ghq12: only dashboard-relevant columns (skip informePdf blob) ──
  console.log('Syncing ghq12...');
  await local.query('DELETE FROM ghq12');
  const [ghqRows] = await prod.query(
    'SELECT idGhq12, telefono, Puntaje, preguntaActual, informePdfNombre, informePdfMime, informePdfFecha FROM ghq12'
  );
  let ghqOk = 0;
  for (const r of ghqRows) {
    try {
      await local.query(
        'INSERT INTO ghq12 (idGhq12, telefono, Puntaje, preguntaActual, informePdfNombre, informePdfMime, informePdfFecha) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [r.idGhq12, r.telefono, r.Puntaje, r.preguntaActual, r.informePdfNombre, r.informePdfMime, r.informePdfFecha]
      );
      ghqOk++;
    } catch (e) {
      if (ghqOk === 0) console.error('  ghq12 err:', e.code, String(e.sqlMessage || '').slice(0, 100));
    }
  }
  console.log(`  ghq12: ${ghqOk}/${ghqRows.length}`);

  // ── 2) dass21: only dashboard-relevant columns (skip informePdf blob) ──
  console.log('Syncing dass21...');
  await local.query('DELETE FROM dass21');
  const [dassRows] = await prod.query(
    'SELECT idDass21, telefono, puntajeDep, puntajeAns, puntajeEstr, preguntaActual, informePdfNombre, informePdfMime, informePdfFecha FROM dass21'
  );
  let dassOk = 0;
  for (const r of dassRows) {
    try {
      await local.query(
        'INSERT INTO dass21 (idDass21, telefono, puntajeDep, puntajeAns, puntajeEstr, preguntaActual, informePdfNombre, informePdfMime, informePdfFecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [r.idDass21, r.telefono, r.puntajeDep, r.puntajeAns, r.puntajeEstr, r.preguntaActual, r.informePdfNombre, r.informePdfMime, r.informePdfFecha]
      );
      dassOk++;
    } catch (e) {
      if (dassOk === 0) console.error('  dass21 err:', e.code, String(e.sqlMessage || '').slice(0, 100));
    }
  }
  console.log(`  dass21: ${dassOk}/${dassRows.length}`);

  // ── 3) informacionUsuario: skip historial JSON blob ──
  console.log('Syncing informacionUsuario...');
  await local.query('DELETE FROM informacionUsuario');
  const [userCols] = await local.query('DESCRIBE informacionUsuario');
  const localUserCols = userCols.map((c) => c.Field);
  const skipCols = new Set(['historial']); // JSON that causes issues
  const safeCols = localUserCols.filter((c) => !skipCols.has(c));
  const [userRows] = await prod.query(`SELECT ${safeCols.map((c) => '`' + c + '`').join(', ')} FROM informacionUsuario`);
  let userOk = 0;
  for (const r of userRows) {
    const vals = safeCols.map((c) => r[c]);
    try {
      await local.query(
        `INSERT INTO informacionUsuario (${safeCols.map((c) => '`' + c + '`').join(', ')}) VALUES (${safeCols.map(() => '?').join(', ')})`,
        vals
      );
      userOk++;
    } catch (e) {
      if (userOk === 0) console.error('  user err:', e.code, String(e.sqlMessage || '').slice(0, 120));
    }
  }
  console.log(`  informacionUsuario: ${userOk}/${userRows.length}`);

  // ── 4) informacion_sociodemografica: handle rolFamiliar JSON ──
  console.log('Syncing informacion_sociodemografica...');
  await local.query('DELETE FROM informacion_sociodemografica');
  const [localSocioCols] = await local.query('DESCRIBE informacion_sociodemografica');
  const localSocioNames = localSocioCols.map((c) => c.Field);
  const [prodSocioCols] = await prod.query('DESCRIBE informacion_sociodemografica');
  const prodSocioNames = prodSocioCols.map((c) => c.Field);
  const commonSocioCols = localSocioNames.filter((c) => prodSocioNames.includes(c));
  const [socioRows] = await prod.query(`SELECT ${commonSocioCols.map((c) => '`' + c + '`').join(', ')} FROM informacion_sociodemografica`);
  let socioOk = 0;
  for (const r of socioRows) {
    const vals = commonSocioCols.map((c) => {
      const v = r[c];
      if (c === 'rolFamiliar' && v !== null && typeof v !== 'string') return JSON.stringify(v);
      return v;
    });
    try {
      await local.query(
        `INSERT INTO informacion_sociodemografica (${commonSocioCols.map((c) => '`' + c + '`').join(', ')}) VALUES (${commonSocioCols.map(() => '?').join(', ')})`,
        vals
      );
      socioOk++;
    } catch (e) {
      if (socioOk === 0) console.error('  socio err:', e.code, String(e.sqlMessage || '').slice(0, 120));
    }
  }
  console.log(`  informacion_sociodemografica: ${socioOk}/${socioRows.length}`);

  // ── 5) Simple tables (already synced before, re-sync for safety) ──
  for (const table of ['practicante', 'rolChat', 'aspirante', 'Horario']) {
    console.log(`Syncing ${table}...`);
    try {
      const [rows] = await prod.query(`SELECT * FROM \`${table}\``);
      if (rows.length === 0) { console.log(`  ${table}: 0 rows`); continue; }
      await local.query(`DELETE FROM \`${table}\``);
      const cols = Object.keys(rows[0]);
      let ok = 0;
      for (const r of rows) {
        const vals = cols.map((c) => {
          const v = r[c];
          if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v);
          return v;
        });
        try {
          await local.query(
            `INSERT INTO \`${table}\` (${cols.map((c) => '`' + c + '`').join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            vals
          );
          ok++;
        } catch (e) {
          if (ok === 0) console.error(`  ${table} err:`, e.code, String(e.sqlMessage || '').slice(0, 100));
        }
      }
      console.log(`  ${table}: ${ok}/${rows.length}`);
    } catch (e) {
      console.error(`  ${table} ERROR:`, e.code || e.message);
    }
  }

  await local.query('SET FOREIGN_KEY_CHECKS = 1');

  // ── Verify ──
  console.log('\n=== Verification ===');
  for (const t of ['ghq12', 'dass21', 'informacionUsuario', 'practicante', 'rolChat', 'informacion_sociodemografica', 'aspirante']) {
    const [r] = await local.query(`SELECT COUNT(*) c FROM \`${t}\``);
    console.log(`  ${t}: ${r[0].c}`);
  }

  await prod.end();
  await local.end();
  console.log('\nSYNC COMPLETE');
}

main().catch((e) => { console.error(e); process.exit(1); });
