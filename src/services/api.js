// In development: calls Vercel dev server functions at /api/*
// In production: calls deployed Vercel functions at /api/*
// Either way, the proxy handles caching and rate limiting server-side

const SESSION_TTL = 60 * 60 * 1000;
const REQUEST_TIMEOUT = 12000;

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

async function fetchWithTimeout(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    return await fetch(path, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function proxyFetch(path, cacheKey, options = {}) {
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let lastError;
  const attempts = options.attempts || 2;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(path);
      if (res.status === 429) throw new Error('Launch data is temporarily rate limited. Please try again in a minute.');
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCache(cacheKey, data);
      return data;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        lastError = new Error('Launch data timed out. Please try again.');
      }
      if (attempt === attempts - 1) break;
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }

  throw lastError;
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
  const all = [];
  for (const offset of [0, 100, 200]) {
    try {
      const page = await proxyFetch(`/api/agencies?offset=${offset}`, `agency_stats_${offset}`);
      all.push(...(page.results || []));
      if (!page.next) break;
    } catch (error) {
      if (offset === 0) throw error;
      break;
    }
  }
  return all.filter(a => (a.total_launch_count || 0) > 0);
}

export async function getCurrentYearLaunches() {
  const data = await proxyFetch('/api/yearlaunches', 'year_launches');
  return data.results || [];
}

// Add this after getCurrentYearLaunches()
export async function getYearLaunchData() {
  return proxyFetch('/api/yearlaunches', 'year_launches');
}
