function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return String(value).trim();
}

export function supabaseEnv() {
  return {
    url: env('SUPABASE_URL').replace(/\/+$/, ''),
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY')
  };
}

export async function sb(table, { method='GET', query='', body=null, prefer='' } = {}) {
  const { url, serviceKey } = supabaseEnv();
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${table} ${method} failed: ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function cleanPhone(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}
