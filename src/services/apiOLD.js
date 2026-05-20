const BASE_URL = 'https://ll.thespacedevs.com/2.2.0';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

function getCached(key) {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const { data, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // sessionStorage full or unavailable — fail silently
  }
}

async function apiFetch(url, cacheKey) {
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(url);
  if (res.status === 429) throw new Error('API rate limit reached — please wait a few minutes and refresh');
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();
  setCache(cacheKey, data);
  return data;
}

export async function getUpcomingLaunches() {
  const data = await apiFetch(
    `${BASE_URL}/launch/upcoming/?limit=10&mode=detailed`,
    'upcoming_launches'
  );
  const now = new Date();
  return data.results
    .filter(l => new Date(l.net) > now)
    .slice(0, 4);
}

export async function getPreviousLaunches(limit = 20, offset = 0, extraParams = '') {
  const cacheKey = `previous_launches_${offset}_${extraParams}`;
  const data = await apiFetch(
    `${BASE_URL}/launch/previous/?limit=${limit}&offset=${offset}&mode=normal&ordering=-net${extraParams}`,
    cacheKey
  );
  return data;
}

export function clearCache(key) {
  try { sessionStorage.removeItem(key); } catch(e) {}
}

export async function getAgencies() {
  const data = await apiFetch(
    `${BASE_URL}/agencies/?limit=10&featured=true`,
    'agencies'
  );
  return data.results;
}

export async function getLaunchPads() {
  const data = await apiFetch(
    `${BASE_URL}/pad/?limit=100`,
    'launch_pads'
  );
  return data.results;
}

export async function getActiveLaunches() {
  const data = await apiFetch(
    `${BASE_URL}/launch/upcoming/?limit=25&mode=detailed`,
    'active_launches'
  );
  return data.results;
}

export async function getAgencyDetails() {
  const data = await apiFetch(
    `${BASE_URL}/agencies/?limit=40&featured=true&ordering=-total_launch_count`,
    'agency_details'
  );
  return data.results;
}

export async function getUpcomingByAgency(agencyId) {
  const data = await apiFetch(
    `${BASE_URL}/launch/upcoming/?limit=10&mode=detailed&lsp__id=${agencyId}`,
    `upcoming_agency_${agencyId}`
  );
  return data.results;
}

// legacy: simplified agency stats removed — use the paginated getAgencyCountryStats implementation below
// The single-request version was removed to prevent a duplicate export; the paginated implementation
// that follows fetches all pages and returns the filtered results.

// Fetch all agencies with real historical launch counts
// This is the correct approach — one API call gives us full historical data
export async function getAgencyCountryStats() {
  const [page1, page2, page3] = await Promise.all([
    apiFetch(`${BASE_URL}/agencies/?limit=100&offset=0&ordering=-total_launch_count`, 'agency_stats_0'),
    apiFetch(`${BASE_URL}/agencies/?limit=100&offset=100&ordering=-total_launch_count`, 'agency_stats_100'),
    apiFetch(`${BASE_URL}/agencies/?limit=100&offset=200&ordering=-total_launch_count`, 'agency_stats_200'),
  ]);
  const all = [
    ...(page1.results || []),
    ...(page2.results || []),
    ...(page3.results || []),
  ];
  return all.filter(a => (a.total_launch_count || 0) > 0);
}

// Fetch launches from current year only for Mission Control tracker
export async function getCurrentYearLaunches() {
  const year = new Date().getFullYear();
  const data = await apiFetch(
    `${BASE_URL}/launch/previous/?limit=100&mode=normal&net__gte=${year}-01-01&ordering=-net`,
    `launches_year_${year}`
  );
  return data.results || [];
}
