import { allowRequest, cachedLaunchLibrary, sendApiError, setApiHeaders } from './_lib/launchLibrary.js';

const cache = {};
const TTL = 24 * 60 * 60 * 1000; // 24 hours — pads rarely change

export default async function handler(req, res) {
  setApiHeaders(res, 86400);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const rate = allowRequest(req, { max: 90 });
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  try {
    const { data, cacheStatus } = await cachedLaunchLibrary(
      cache,
      'pads_100',
      TTL,
      '/pad/',
      { limit: 100 },
      { staleTtl: 7 * 24 * 60 * 60 * 1000 }
    );
    res.setHeader('X-Cache-Status', cacheStatus);
    return res.status(200).json(data);
  } catch(e) {
    return sendApiError(res, e);
  }
}
