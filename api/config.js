function cleanEnv(value) {
  return String(value || '').trim();
}

export default function handler(req, res) {
  res.status(200).json({
    supabaseUrl: cleanEnv(process.env.SUPABASE_URL),
    supabaseKey: cleanEnv(process.env.SUPABASE_PUBLISHABLE_KEY)
  });
}
