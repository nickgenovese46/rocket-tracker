import { allowRequest, cachedLaunchLibrary, sendApiError, setApiHeaders } from './_lib/launchLibrary.js';

const cache = {};

// Historical data (offset > 0) barely changes — cache for 6 hours
// Recent data (offset 0) updates more — cache for 1 hour  
function getTTL(offset) {
  return parseInt(offset) > 100
    ? 24 * 60 * 60 * 1000   // 24 hours for older pages
    : 60 * 60 * 1000;       // 1 hour for recent page
}

export default async function handler(req, res) {
  setApiHeaders(res, 3600);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const rate = allowRequest(req, { max: 90 });
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  const { limit = 20, offset = 0, extra = '' } = req.query;
  const key = `prev_${limit}_${offset}_${extra}`;
  const ttl = getTTL(offset);

  try {
    const extraParams = new URLSearchParams(String(extra).replace(/^\?/, '').replace(/^&/, ''));
    const params = {
      limit,
      offset,
      mode: 'normal',
      ordering: '-net',
    };
    extraParams.forEach((value, paramKey) => {
      params[paramKey] = value;
    });
    const { data, cacheStatus } = await cachedLaunchLibrary(
      cache,
      key,
      ttl,
      '/launch/previous/',
      params,
      { staleTtl: ttl * 4 }
    );
    res.setHeader('X-Cache-Status', cacheStatus);
    return res.status(200).json(data);
  } catch(e) {
    return sendApiError(res, e);
  }
}
