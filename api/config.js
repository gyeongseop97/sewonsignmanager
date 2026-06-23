function clean(value, name) {
  let v = String(value || '').trim();
  const p = name + '=';
  if (v.startsWith(p)) v = v.slice(p.length).trim();
  if (name === 'SUPABASE_URL') {
    const i = v.indexOf('https://');
    if (i > 0) v = v.slice(i);
    v = v.split(/\s+/)[0].replace(/\/+$/, '');
  } else {
    v = v.split(/\s+/)[0];
  }
  return v;
}

export default function handler(req, res) {
  res.status(200).json({
    supabaseUrl: clean(process.env.SUPABASE_URL, 'SUPABASE_URL'),
    supabaseKey: clean(process.env.SUPABASE_PUBLISHABLE_KEY, 'SUPABASE_PUBLISHABLE_KEY')
  });
}
