import { allowRequest, cachedLaunchLibrary, sendApiError, setApiHeaders } from './_lib/launchLibrary.js';

const cache = {};
const TTL = 5 * 60 * 1000; // 5 minutes instead of 30

export default async function handler(req, res) {
  setApiHeaders(res, 300);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const rate = allowRequest(req, { max: 75 });
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  try {
    const year = new Date().getFullYear();
    const { data, cacheStatus } = await cachedLaunchLibrary(
      cache,
      `year_${year}`,
      TTL,
      '/launch/previous/',
      { limit: 100, mode: 'normal', net__gte: `${year}-01-01`, ordering: '-net' },
      { staleTtl: 60 * 60 * 1000 }
    );
    res.setHeader('X-Cache-Status', cacheStatus);
    return res.status(200).json(data);
  } catch(e) {
    return sendApiError(res, e);
  }
}
