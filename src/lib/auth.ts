/* ═══ Auth 3.0 · Magic Link (Supabase GoTrue, ohne SDK — 0 Dependencies) ═══ */
export const SB_URL = 'https://wjqicituxwtlkddgspzc.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcWljaXR1eHd0bGtkZGdzcHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDc1MzcsImV4cCI6MjA5NjE4MzUzN30.gH9OIHU7zepGhzsz5ZusBQ3r_bxxitrt8iW61iA1V8E';

export interface Session { access_token: string; refresh_token: string; expires_at: number; email: string; }
const LS = 'wl3_session';

export function getSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(LS) || 'null') as Session | null;
    if (!s) return null;
    if (s.expires_at * 1000 < Date.now() + 60000) { refresh(s); return null; }
    return s;
  } catch { return null; }
}

function save(json: any) {
  const s: Session = { access_token: json.access_token, refresh_token: json.refresh_token,
    expires_at: json.expires_at ?? Math.floor(Date.now()/1000) + (json.expires_in||3600),
    email: json.user?.email || '' };
  localStorage.setItem(LS, JSON.stringify(s));
  return s;
}

async function refresh(s: Session): Promise<Session|null> {
  try {
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!r.ok) { localStorage.removeItem(LS); return null; }
    return save(await r.json());
  } catch { return null; }
}

/* Magic-Link anfordern — Link führt zurück auf die App */
export async function sendMagicLink(email: string): Promise<boolean> {
  const r = await fetch(`${SB_URL}/auth/v1/otp`, {
    method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true,
      options: { email_redirect_to: location.origin + location.pathname } }) });
  return r.ok;
}

/* Beim Boot: Magic-Link-Rücksprung (#access_token=…) einsammeln */
export function captureSessionFromUrl(): Session | null {
  if (!location.hash.includes('access_token=')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  const at = p.get('access_token'), rt = p.get('refresh_token');
  if (!at || !rt) return null;
  const s = save({ access_token: at, refresh_token: rt,
    expires_at: Number(p.get('expires_at')) || undefined,
    user: { email: (() => { try { return JSON.parse(atob(at.split('.')[1])).email; } catch { return ''; } })() } });
  history.replaceState(null, '', location.pathname + location.search);
  return s;
}

export function logout() { localStorage.removeItem(LS); }

/* Foto in den public-Bucket laden (nur eingeloggt, RLS-geschützt) */
export async function uploadPhoto(file: File, s: Session): Promise<string|null> {
  if (file.size > 5 * 1024 * 1024) return null;
  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg','jpg');
  const path = `${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/post-photos/${path}`, {
    method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': file.type },
    body: file });
  return r.ok ? path : null;
}
export const photoUrl = (path: string) => `${SB_URL}/storage/v1/object/public/post-photos/${path}`;
