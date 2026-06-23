import { sb, cleanPhone } from './_supabase.js';

function out(res, status, data) { res.status(status).json(data); }
function q(v) { return encodeURIComponent(String(v || '')); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return out(res, 405, { error: 'Method not allowed' });
  try {
    const name = String(req.body?.name || '').trim();
    const employeeNo = String(req.body?.employeeNo || '').trim();
    const phone = cleanPhone(req.body?.phone || '');
    if (!name || !employeeNo || !phone) return out(res, 400, { error: 'Missing fields' });

    const active = '\uc7ac\uc9c1';
    const employees = await sb('employees', { query: `?select=*&name=eq.${q(name)}&employee_no=eq.${q(employeeNo)}&phone_number=eq.${q(phone)}&employment_status=eq.${q(active)}` });
    const employee = employees && employees[0];
    if (!employee) return out(res, 404, { error: 'Employee not found' });

    const targets = await sb('education_targets', { query: `?select=*&employee_id=eq.${q(employee.id)}` }) || [];
    const educationIds = [...new Set(targets.map(t => t.education_id).filter(Boolean))];
    const sessionIds = [...new Set(targets.map(t => t.session_id).filter(Boolean))];

    const educations = educationIds.length ? await sb('educations', { query: `?select=*&id=in.(${educationIds.join(',')})` }) : [];
    const sessions = sessionIds.length ? await sb('education_sessions', { query: `?select=*&id=in.(${sessionIds.join(',')})` }) : [];
    const signatures = await sb('education_signatures', { query: `?select=*&employee_id=eq.${q(employee.id)}` }) || [];

    return out(res, 200, { employee, state: { employees: [employee], educations: educations || [], sessions: sessions || [], targets, signatures: signatures.map(s => ({ ...s, signature_image_url: s.signature_image_url || (s.signature_file_key ? `/api/r2-file?key=${encodeURIComponent(s.signature_file_key)}` : '') })) } });
  } catch (err) {
    return out(res, 500, { error: err.message || 'Employee login failed' });
  }
}
