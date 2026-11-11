import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

const clone = value => structuredClone(value);
export class StoreError extends Error {
  constructor(message, status = 503) { super(message); this.httpStatus = status; }
}

// The local adapter is durable on one developer machine. Hosted studies always
// use Postgres: a function's filesystem and process memory are not a database.
export function fileStore(filename) {
  let queue = Promise.resolve();
  function transaction(work) {
    const next = queue.then(async () => {
      let db;
      try { db = JSON.parse(await readFile(filename, 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw new StoreError('The local study store could not be read.'); db = { sessions: {}, limits: {} }; }
      const result = work(db);
      await mkdir(path.dirname(filename), { recursive: true });
      const temp = filename + '.tmp';
      await writeFile(temp, JSON.stringify(db), { mode: 0o600 });
      await rename(temp, filename);
      return clone(result);
    });
    queue = next.catch(() => {});
    return next;
  }
  return {
    kind: 'file',
    health: () => transaction(() => true),
    create: row => transaction(db => { if (db.sessions[row.id]) throw new StoreError('Session already exists.', 409); db.sessions[row.id] = row; return row; }),
    get: (study, id) => transaction(db => db.sessions[id] && (study === null || db.sessions[id].study_id === study) ? db.sessions[id] : null),
    lock: (study, id, owner, seconds) => transaction(db => {
      const row = db.sessions[id];
      if (!row || row.study_id !== study || row.status !== 'active' || Date.parse(row.expires_at) <= Date.now() || Date.parse(row.lease_until ?? 0) > Date.now()) return null;
      row.lease_owner = owner; row.lease_until = new Date(Date.now() + seconds * 1000).toISOString(); return row;
    }),
    save: (row, owner, keepLease = false) => transaction(db => {
      const old = db.sessions[row.id];
      if (!old || old.study_id !== row.study_id || old.status !== 'active' || old.lease_owner !== owner || old.revision !== row.revision) return null;
      const saved = { ...row, revision: row.revision + 1, lease_owner: keepLease ? owner : null, lease_until: keepLease ? row.lease_until : null };
      db.sessions[row.id] = saved; return saved;
    }),
    release: (study, id, owner) => transaction(db => { const row = db.sessions[id]; if (row?.study_id === study && row.lease_owner === owner) { row.lease_owner = null; row.lease_until = null; } return true; }),
    isLimitSet: key => transaction(db => Boolean(db.limits[key]?.value > 0 && Date.parse(db.limits[key].expires) > Date.now())),
    useLimit: (key, maximum, expires) => transaction(db => {
      const old = db.limits[key]; const value = old && Date.parse(old.expires) > Date.now() ? old.value : 0;
      if (value >= maximum) return false;
      db.limits[key] = { value: value + 1, expires }; return true;
    }),
    list: study => transaction(db => Object.values(db.sessions).filter(r => r.study_id === study && Date.parse(r.expires_at) > Date.now()).sort((a, b) => a.created_at.localeCompare(b.created_at))),
    withdraw: (study, id, proof, field) => transaction(db => {
      const row = db.sessions[id];
      if (!row || row.study_id !== study || row[field] !== proof || row.status === 'withdrawn') return false;
      Object.assign(row, { status: 'withdrawn', withdrawn_at: new Date().toISOString(), data: {}, protocol: {}, auth_hash: '', withdrawal_hash: '', lease_owner: null, lease_until: null, revision: row.revision + 1 }); return true;
    }),
    purge: () => transaction(db => { let count = 0; for (const [id, row] of Object.entries(db.sessions)) if (Date.parse(row.expires_at) <= Date.now()) { delete db.sessions[id]; count++; } for (const [key, item] of Object.entries(db.limits)) if (Date.parse(item.expires) <= Date.now()) delete db.limits[key]; return count; }),
  };
}

export function supabaseStore({ url, key, fetchImpl = fetch }) {
  let base;
  try { base = new URL(url); if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error(); }
  catch { throw new StoreError('Configure a valid HTTPS Supabase project URL.'); }
  // New-format keys (sb_secret_...) are not JWTs and belong in the apikey header only; legacy JWT service_role keys also go in Authorization.
  async function request(resource, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    let response;
    try { response = await fetchImpl(new URL('/rest/v1/' + resource, base), { method, headers: { apikey: key, ...(key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + key }), 'Content-Type': 'application/json', Prefer: prefer }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) }); }
    catch { throw new StoreError('Study storage is temporarily unavailable. Please retry; your session has not been replaced.'); }
    if (!response.ok) throw new StoreError('Study storage is unavailable or the study schema has not been installed.');
    if (response.status === 204) return null;
    return response.json();
  }
  const query = fields => new URLSearchParams(fields).toString();
  const where = (study, id) => ({ study_id: 'eq.' + study, id: 'eq.' + id });
  return {
    kind: 'supabase',
    health: async () => {
      await request('study_sessions?select=id&limit=0');
      // Validate RPC installation/permissions without spending a study limit.
      const result = await request('rpc/study_use_limit', { method: 'POST', body: { p_key: '_health', p_maximum: 0, p_expires: new Date().toISOString() } });
      if (result !== false) throw new StoreError('The study database functions need updating.');
      return true;
    },
    create: async row => (await request('study_sessions', { method: 'POST', body: row }))[0],
    get: async (study, id) => (await request('study_sessions?' + query({ ...(study === null ? { id: 'eq.' + id } : where(study, id)), select: '*' })))[0] ?? null,
    lock: async (study, id, owner, seconds) => (await request('rpc/study_lock', { method: 'POST', body: { p_study: study, p_id: id, p_owner: owner, p_seconds: seconds } }))[0] ?? null,
    save: async (row, owner, keepLease = false) => (await request('study_sessions?' + query({ ...where(row.study_id, row.id), status: 'eq.active', lease_owner: 'eq.' + owner, revision: 'eq.' + row.revision }), { method: 'PATCH', body: { ...row, revision: row.revision + 1, lease_owner: keepLease ? owner : null, lease_until: keepLease ? row.lease_until : null } }))[0] ?? null,
    release: async (study, id, owner) => { await request('study_sessions?' + query({ ...where(study, id), lease_owner: 'eq.' + owner }), { method: 'PATCH', body: { lease_owner: null, lease_until: null }, prefer: 'return=minimal' }); },
    isLimitSet: async key => (await request('study_limits?' + query({ key: 'eq.' + key, used: 'gt.0', expires_at: 'gt.' + new Date().toISOString(), select: 'key', limit: '1' }))).length > 0,
    useLimit: (key, maximum, expires) => request('rpc/study_use_limit', { method: 'POST', body: { p_key: key, p_maximum: maximum, p_expires: expires } }),
    list: async study => {
      const rows = [];
      for (let offset = 0; ; offset += 200) {
        const page = await request('study_sessions?' + query({ study_id: 'eq.' + study, expires_at: 'gt.' + new Date().toISOString(), order: 'created_at.asc,id.asc', limit: '200', offset: String(offset), select: '*' }));
        rows.push(...page); if (page.length < 200) return rows;
        if (rows.length >= 10000) throw new StoreError('Export exceeds 10,000 sessions. Export this study directly from the database.', 413);
      }
    },
    withdraw: (study, id, proof, field) => request('rpc/study_withdraw', { method: 'POST', body: { p_study: study, p_id: id, p_proof: proof, p_field: field } }),
    purge: () => request('rpc/study_purge', { method: 'POST', body: {} }),
  };
}
