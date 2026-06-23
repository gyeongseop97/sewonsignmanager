function out(res, status, data) { res.status(status).json(data); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return out(res, 405, { error: 'Method not allowed' });
  try {
    const apiKey = process.env.OCTOMO_API_KEY;
    const apiBase = process.env.OCTOMO_API_BASE || 'https://api.octoverse.kr';
    const text = String(req.body?.text || '').trim();
    if (!apiKey) throw new Error('OCTOMO_API_KEY 환경변수가 없습니다.');
    if (!text) return out(res, 400, { error: 'text is required' });

    const response = await fetch(`${apiBase}/octomo/v1/public/message/qr-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Octomo ${apiKey}` },
      body: JSON.stringify({ text, errorCorrectionLevel: 'M', margin: 2, width: 220 })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Octomo QR API error: ${response.status} ${body}`);
    }

    const data = await response.json();
    return out(res, 200, { qrCode: data.qrCode });
  } catch (err) {
    return out(res, 500, { error: err.message || 'Octomo QR failed' });
  }
}
