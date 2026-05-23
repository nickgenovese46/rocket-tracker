import { allowRequest, cachedLaunchLibrary, sendApiError, setApiHeaders } from './_lib/launchLibrary.js';

const cache = {};
const TTL = 60 * 60 * 1000;

export default async function handler(req, res) {
  setApiHeaders(res, 3600);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const rate = allowRequest(req, { max: 90 });
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfter);
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  const { offset = 0 } = req.query;
  const key = `agencies_${offset}`;

  try {
    const { data, cacheStatus } = await cachedLaunchLibrary(
      cache,
      key,
      TTL,
      '/agencies/',
      { limit: 100, offset, ordering: '-total_launch_count', mode: 'detailed' },
      { staleTtl: 24 * 60 * 60 * 1000 }
    );
    res.setHeader('X-Cache-Status', cacheStatus);
    return res.status(200).json(data);
  } catch(e) {
    return sendApiError(res, e);
  }
}
