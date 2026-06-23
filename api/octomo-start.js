import { sb, cleanPhone } from './_supabase.js';

function out(res, status, data) { res.status(status).json(data); }
function q(v) { return encodeURIComponent(String(v || '')); }
function code6() { return String(Math.floor(100000 + Math.random() * 900000)); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return out(res, 405, { error: 'Method not allowed' });
  try {
    const name = String(req.body?.name || '').trim();
    const employeeNo = String(req.body?.employeeNo || '').trim();
    const phone = cleanPhone(req.body?.phone || '');
    if (!name || !employeeNo || !phone) return out(res, 400, { error: '이름, 사번, 휴대폰 번호를 모두 입력해 주세요.' });

    const employees = await sb('employees', { query: `?select=*&name=eq.${q(name)}&employee_no=eq.${q(employeeNo)}&phone_number=eq.${q(phone)}&employment_status=eq.${q('재직')}` });
    const employee = employees && employees[0];
    if (!employee) return out(res, 404, { error: '직원 정보가 일치하지 않거나 퇴사 상태입니다.' });

    const authCode = code6();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await sb('identity_verifications', { method: 'PATCH', query: `?employee_id=eq.${q(employee.id)}&status=eq.pending`, body: { status: 'cancelled' } });

    const rows = await sb('identity_verifications', {
      method: 'POST',
      body: {
        employee_id: employee.id,
        phone_number: phone,
        auth_code: authCode,
        status: 'pending',
        method: 'octomo_mo_sms',
        expires_at: expiresAt
      },
      prefer: 'return=representation'
    });

    return out(res, 200, { verificationId: rows?.[0]?.id, code: authCode, receiverNumber: '1666-3538', expiresAt });
  } catch (err) {
    return out(res, 500, { error: err.message || 'Octomo start failed' });
  }
}
