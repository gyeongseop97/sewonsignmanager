import { r2Request } from './_r2.js';

function json(res, status, data) {
  res.status(status).json(data);
}
function safeId(v) {
  return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '');
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const { educationId, sessionId, employeeId, dataUrl } = req.body || {};
    if (!educationId || !sessionId || !employeeId || !dataUrl) return json(res, 400, { error: 'Missing fields' });
    const match = String(dataUrl).match(/^data:image\/png;base64,(.+)$/);
    if (!match) return json(res, 400, { error: 'Only PNG data URL is allowed' });
    const buffer = Buffer.from(match[1], 'base64');
    if (!buffer.length || buffer.length > 1024 * 1024) return json(res, 400, { error: 'Invalid signature image size' });
    const key = `signatures/${safeId(educationId)}/${safeId(sessionId)}/${safeId(employeeId)}_${Date.now()}.png`;
    const put = await r2Request({ method: 'PUT', key, body: buffer, contentType: 'image/png' });
    if (!put.ok) return json(res, 500, { error: `R2 upload failed: ${await put.text()}` });
    return json(res, 200, { key, url: `/api/r2-file?key=${encodeURIComponent(key)}` });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Upload failed' });
  }
}
