import { r2Request } from './_r2.js';
import { sb } from './_supabase.js';

function out(res, status, data) { res.status(status).json(data); }
function q(v) { return encodeURIComponent(String(v || '')); }
function safe(v) { return String(v || '').replace(/[^a-zA-Z0-9_-]/g, ''); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return out(res, 405, { error: 'Method not allowed' });
  try {
    const { educationId, sessionId, employeeId, dataUrl } = req.body || {};
    if (!educationId || !sessionId || !employeeId || !dataUrl) return out(res, 400, { error: 'Missing fields' });

    const target = await sb('education_targets', { query: `?select=*&session_id=eq.${q(sessionId)}&employee_id=eq.${q(employeeId)}` });
    if (!target?.length) return out(res, 403, { error: 'Not a target employee for this session' });

    const existing = await sb('education_signatures', { query: `?select=id&education_id=eq.${q(educationId)}&employee_id=eq.${q(employeeId)}` });
    if (existing?.length) return out(res, 409, { error: 'Already signed' });

    const match = String(dataUrl).match(/^data:image\/png;base64,(.+)$/);
    if (!match) return out(res, 400, { error: 'Only PNG data URL is allowed' });
    const buffer = Buffer.from(match[1], 'base64');
    if (!buffer.length || buffer.length > 1024 * 1024) return out(res, 400, { error: 'Invalid image size' });

    const key = `signatures/${safe(educationId)}/${safe(sessionId)}/${safe(employeeId)}_${Date.now()}.png`;
    const put = await r2Request({ method: 'PUT', key, body: buffer, contentType: 'image/png' });
    if (!put.ok) return out(res, 500, { error: `R2 upload failed: ${await put.text()}` });

    const url = `/api/r2-file?key=${encodeURIComponent(key)}`;
    const rows = await sb('education_signatures', {
      method: 'POST',
      body: {
        education_id: educationId,
        session_id: sessionId,
        employee_id: employeeId,
        consent_checked: true,
        signature_file_key: key,
        signature_image_url: url,
        ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        device_info: req.headers['user-agent'] || ''
      },
      prefer: 'return=representation'
    });
    return out(res, 200, { signature: rows?.[0] });
  } catch (err) {
    return out(res, 500, { error: err.message || 'Submit failed' });
  }
}
