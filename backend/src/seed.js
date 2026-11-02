// Manual re-seed helper: node src/seed.js (uses same seedDemo as server boot).
const bcrypt = require('bcryptjs');
const { createStore, seedDemo } = require('./db');
(async () => { const s = createStore(); await seedDemo(s, bcrypt); console.log('Seed done (store=' + s.kind + ')'); if (s.pool) await s.pool.end(); })();
