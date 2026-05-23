const BASE_URL = 'https://ll.thespacedevs.com/2.2.0';
const DEFAULT_TIMEOUT = 10000;
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const buckets = new Map();

export function allowRequest(req, options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 90;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded || req.socket?.remoteAddress || 'anonymous').split(',')[0].trim();
  const now = Date.now();
  const bucket = buckets.get(ip) || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(ip, bucket);

  return {
    allowed: bucket.count <= max,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function setApiHeaders(res, cacheSeconds = 0) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (cacheSeconds > 0) {
    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`);
  }
}

export async function fetchLaunchLibrary(endpoint, params = {}, options = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const attempts = options.attempts || 2;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) return response.json();

      const retryAfter = response.headers.get('retry-after');
      const error = new Error(`Launch Library error ${response.status}`);
      error.status = response.status;
      error.retryAfter = retryAfter;

      if (!RETRY_STATUSES.has(response.status) || attempt === attempts - 1) {
        throw error;
      }
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === attempts - 1 || error.name === 'AbortError') break;
    }

    await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
  }

  throw lastError;
}

export async function cachedLaunchLibrary(cache, key, ttl, endpoint, params, options = {}) {
  const now = Date.now();
  const cached = cache[key];
  if (cached?.data && now - cached.ts < ttl) {
    return { data: cached.data, cacheStatus: 'hit' };
  }

  if (cached?.promise) {
    const data = await cached.promise;
    return { data, cacheStatus: 'joined' };
  }

  const promise = fetchLaunchLibrary(endpoint, params, options);
  cache[key] = { ...cached, promise };

  try {
    const data = await promise;
    cache[key] = { data, ts: Date.now() };
    return { data, cacheStatus: 'miss' };
  } catch (error) {
    delete cache[key]?.promise;
    const staleTtl = options.staleTtl || ttl * 4;
    if (cached?.data && now - cached.ts < staleTtl) {
      return { data: cached.data, cacheStatus: 'stale', staleReason: error.message };
    }
    throw error;
  }
}

export function sendApiError(res, error) {
  if (error?.status === 429 || error?.message === 'rate_limited') {
    if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter);
    return res.status(429).json({ error: 'Launch data is temporarily rate limited. Please try again in a minute.' });
  }
  if (error?.name === 'AbortError') {
    return res.status(504).json({ error: 'Launch data timed out. Please try again.' });
  }
  return res.status(502).json({ error: error?.message || 'Launch data unavailable' });
}
