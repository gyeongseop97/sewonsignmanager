import { r2Request } from './_r2.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  try {
    const key = String(req.query.key || '');
    if (!key || key.includes('..')) return res.status(400).send('Invalid key');
    const r2 = await r2Request({ method: 'GET', key, contentType: 'image/png' });
    if (!r2.ok) return res.status(404).send('File not found');
    const arrayBuffer = await r2.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Type', r2.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).send(err.message || 'File error');
  }
}
