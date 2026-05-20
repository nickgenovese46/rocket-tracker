// In development: calls Vercel dev server functions at /api/*
// In production: calls deployed Vercel functions at /api/*
// Either way, the proxy handles caching and rate limiting server-side

const SESSION_TTL = 60 * 60 * 1000;

function getCached(key) {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const { data, ts } = JSON.parse(item);
    if (Date.now() - ts > SESSION_TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function clearCache(key) {
  try { sessionStorage.removeItem(key); } catch {}
}

async function proxyFetch(path, cacheKey) {
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(path);
  if (res.status === 429) throw new Error('API rate limit reached — please wait a few minutes and refresh');
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  setCache(cacheKey, data);
  return data;
}

export async function getUpcomingLaunches() {
  const data = await proxyFetch('/api/upcoming', 'upcoming_launches');
  const now = new Date();
  return (data.results || [])
    .filter(l => new Date(l.net) > now)
    .slice(0, 4);
}

export async function getPreviousLaunches(limit = 20, offset = 0, extraParams = '') {
  const path = `/api/previous?limit=${limit}&offset=${offset}&extra=${encodeURIComponent(extraParams)}`;
  return proxyFetch(path, `previous_${limit}_${offset}_${extraParams}`);
}

export async function getAgencies() {
  const data = await proxyFetch('/api/agencies?offset=0', 'agencies');
  return data.results || [];
}

export async function getLaunchPads() {
  const data = await proxyFetch('/api/pads', 'launch_pads');
  return data.results || [];
}

export async function getActiveLaunches() {
  const data = await proxyFetch('/api/active', 'active_launches');
  return data.results || [];
}

export async function getAgencyCountryStats() {
  const [p1, p2, p3] = await Promise.all([
    proxyFetch('/api/agencies?offset=0',   'agency_stats_0'),
    proxyFetch('/api/agencies?offset=100', 'agency_stats_100'),
    proxyFetch('/api/agencies?offset=200', 'agency_stats_200'),
  ]);
  const all = [
    ...(p1.results || []),
    ...(p2.results || []),
    ...(p3.results || []),
  ];
  return all.filter(a => (a.total_launch_count || 0) > 0);
}

export async function getCurrentYearLaunches() {
  const data = await proxyFetch('/api/yearlaunches', 'year_launches');
  return data.results || [];
}