import { r2Request } from './_r2.js';
import { sb, supabaseEnv } from './_supabase.js';

function out(res, status, data) { res.status(status).json(data); }
function q(v) { return encodeURIComponent(String(v || '')); }

async function getAuthUser(token) {
  const env = supabaseEnv();
  const res = await fetch(`${env.url}/auth/v1/user`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Invalid admin session');
  return await res.json();
}

async function ensureAdmin(req) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
  if (!token) throw new Error('Missing admin session');
  const user = await getAuthUser(token);
  const admins = await sb('admin_users', { query: `?select=id&auth_user_id=eq.${q(user.id)}&is_active=eq.true&role=eq.admin` });
  if (!admins || !admins.length) throw new Error('Admin permission required');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return out(res, 405, { error: 'Method not allowed' });
  try {
    await ensureAdmin(req);
    const educationId = String(req.body?.educationId || '').trim();
    const confirmText = String(req.body?.confirmText || '').trim();
    if (!educationId) return out(res, 400, { error: 'Missing educationId' });
    if (confirmText !== '\uad50\uc721\uc0ad\uc81c') return out(res, 400, { error: 'Confirmation mismatch' });

    const signatures = await sb('education_signatures', { query: `?select=signature_file_key&education_id=eq.${q(educationId)}` }) || [];
    let deletedFiles = 0;
    for (const sig of signatures) {
      const key = sig.signature_file_key;
      if (!key) continue;
      const r = await r2Request({ method: 'DELETE', key });
      if (!r.ok && r.status !== 404) {
        const text = await r.text();
        throw new Error(`R2 delete failed: ${text}`);
      }
      deletedFiles += 1;
    }

    await sb('educations', { method: 'DELETE', query: `?id=eq.${q(educationId)}` });
    return out(res, 200, { ok: true, deletedFiles });
  } catch (err) {
    return out(res, 500, { error: err.message || 'Delete failed' });
  }
}
