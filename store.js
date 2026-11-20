// Tiny document store: everything is kept in memory and written through
// to Postgres (if DATABASE_URL is set) or to a local JSON file.
// Fine for one server instance and tens of thousands of couples.
const fs = require('fs');
const path = require('path');

const COLLS = ['users', 'sessions', 'couples', 'answers', 'nudges', 'moods', 'notes', 'bucket', 'games', 'quizzes', 'aiusage'];
const data = {};
COLLS.forEach(c => (data[c] = new Map()));

let backend = null;

async function init() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
    });
    await pool.query('create table if not exists docs (coll text not null, id text not null, doc jsonb not null, primary key (coll, id))');
    const r = await pool.query('select coll, id, doc from docs');
    for (const row of r.rows) if (data[row.coll]) data[row.coll].set(row.id, row.doc);
    backend = {
      save: (c, doc) => pool.query(
        'insert into docs (coll, id, doc) values ($1, $2, $3) on conflict (coll, id) do update set doc = excluded.doc',
        [c, doc.id, doc]).catch(e => console.error('db save failed', e.message)),
      del: (c, id) => pool.query('delete from docs where coll = $1 and id = $2', [c, id])
        .catch(e => console.error('db delete failed', e.message))
    };
    console.log(`Store: Postgres (${r.rowCount} docs loaded)`);
  } else {
    const file = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const c of COLLS) for (const doc of raw[c] || []) data[c].set(doc.id, doc);
    }
    let timer = null;
    const flush = () => {
      const out = {};
      for (const c of COLLS) out[c] = [...data[c].values()];
      fs.writeFileSync(file, JSON.stringify(out));
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 200); };
    backend = { save: schedule, del: schedule };
    console.log(`Store: local file ${file}`);
  }
}

const get = (c, id) => data[c].get(id) || null;
const put = (c, doc) => { data[c].set(doc.id, doc); backend.save(c, doc); return doc; };
const del = (c, id) => { data[c].delete(id); backend.del(c, id); };
const filter = (c, fn) => [...data[c].values()].filter(fn);
const find = (c, fn) => { for (const v of data[c].values()) if (fn(v)) return v; return null; };

module.exports = { init, get, put, del, filter, find };
