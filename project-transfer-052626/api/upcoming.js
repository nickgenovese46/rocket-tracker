import { allowRequest, cachedLaunchLibrary, sendApiError, setApiHeaders } from './_lib/launchLibrary.js';

const cache = {};
const TTL = 3 * 60 * 1000; // 3 minutes — upcoming launches change often

export default async function handler(req, res) {
  setApiHeaders(res, 180);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const rate = allowRequest(req, { max: 75 });
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  try {
    const { data, cacheStatus } = await cachedLaunchLibrary(
      cache,
      'upcoming_10_detailed',
      TTL,
      '/launch/upcoming/',
      { limit: 10, mode: 'detailed' },
      { staleTtl: 15 * 60 * 1000 }
    );
    res.setHeader('X-Cache-Status', cacheStatus);
    return res.status(200).json(data);
  } catch(e) {
    return sendApiError(res, e);
  }
}
