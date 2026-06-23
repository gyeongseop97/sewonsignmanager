import { sb } from './_supabase.js';

function out(res, status, data) { res.status(status).json(data); }
function q(v) { return encodeURIComponent(String(v || '')); }

async function octomoExists({ mobileNum, text, withinMinutes }) {
  const apiKey = process.env.OCTOMO_API_KEY;
  const apiBase = process.env.OCTOMO_API_BASE || 'https://api.octoverse.kr';
  if (!apiKey) throw new Error('OCTOMO_API_KEY 환경변수가 없습니다.');

  const response = await fetch(`${apiBase}/octomo/v1/public/message/exists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Octomo ${apiKey}` },
    body: JSON.stringify({ mobileNum, text, withinMinutes })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Octomo API error: ${response.status} ${body}`);
  }
  const data = await response.json();
  return data.exists === true;
}

async function loadEmployeeState(employee) {
  const targets = await sb('education_targets', { query: `?select=*&employee_id=eq.${q(employee.id)}` }) || [];
  const educationIds = [...new Set(targets.map(t => t.education_id).filter(Boolean))];
  const sessionIds = [...new Set(targets.map(t => t.session_id).filter(Boolean))];

  const educations = educationIds.length ? await sb('educations', { query: `?select=*&id=in.(${educationIds.join(',')})` }) : [];
  const sessions = sessionIds.length ? await sb('education_sessions', { query: `?select=*&id=in.(${sessionIds.join(',')})` }) : [];
  const signatures = await sb('education_signatures', { query: `?select=*&employee_id=eq.${q(employee.id)}` }) || [];

  return {
    employees: [employee],
    educations: educations || [],
    sessions: sessions || [],
    targets,
    signatures: signatures.map(s => ({ ...s, signature_image_url: s.signature_image_url || (s.signature_file_key ? `/api/r2-file?key=${encodeURIComponent(s.signature_file_key)}` : '') }))
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return out(res, 405, { error: 'Method not allowed' });
  try {
    const verificationId = String(req.body?.verificationId || '').trim();
    if (!verificationId) return out(res, 400, { error: 'verificationId가 없습니다.', verified: false });

    const rows = await sb('identity_verifications', { query: `?select=*&id=eq.${q(verificationId)}&status=eq.pending` });
    const verification = rows && rows[0];
    if (!verification) return out(res, 404, { error: '인증 요청을 찾을 수 없습니다.', verified: false });

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      await sb('identity_verifications', { method: 'PATCH', query: `?id=eq.${q(verificationId)}`, body: { status: 'expired' } });
      return out(res, 400, { error: '인증 시간이 만료되었습니다. 다시 시도해 주세요.', verified: false });
    }

    const exists = await octomoExists({ mobileNum: verification.phone_number, text: verification.auth_code, withinMinutes: 5 });
    if (!exists) return out(res, 200, { verified: false, error: '아직 인증 문자가 확인되지 않았습니다. 문자를 보낸 뒤 다시 확인해 주세요.' });

    const verifiedAt = new Date().toISOString();
    await sb('identity_verifications', { method: 'PATCH', query: `?id=eq.${q(verificationId)}`, body: { status: 'verified', verified_at: verifiedAt } });

    const employeeRows = await sb('employees', { query: `?select=*&id=eq.${q(verification.employee_id)}` });
    const employee = employeeRows && employeeRows[0];
    if (!employee) return out(res, 404, { error: '직원 정보를 찾을 수 없습니다.', verified: false });

    const state = await loadEmployeeState(employee);
    return out(res, 200, { verified: true, verificationId, verifiedAt, employee, state });
  } catch (err) {
    return out(res, 500, { error: err.message || 'Octomo check failed', verified: false });
  }
}
