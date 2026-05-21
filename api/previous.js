const cache = {};
const inFlight = {};

// Historical data (offset > 0) barely changes — cache for 6 hours
// Recent data (offset 0) updates more — cache for 1 hour  
function getTTL(offset) {
  return parseInt(offset) > 100
    ? 6 * 60 * 60 * 1000   // 6 hours for older pages
    : 60 * 60 * 1000;       // 1 hour for recent page
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { limit = 20, offset = 0, extra = '' } = req.query;
  const key = `prev_${limit}_${offset}_${extra}`;
  const ttl = getTTL(offset);

  // Return cached if still fresh
  if (cache[key] && Date.now() - cache[key].ts < ttl) {
    return res.status(200).json(cache[key].data);
  }

  // Deduplicate — if same request is already in flight, wait for it
  if (inFlight[key]) {
    try {
      const data = await inFlight[key];
      return res.status(200).json(data);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Make the request and share it with any concurrent callers
  const fetchPromise = fetch(
    `https://ll.thespacedevs.com/2.2.0/launch/previous/?limit=${limit}&offset=${offset}&mode=normal&ordering=-net${extra}`
  ).then(async r => {
    if (r.status === 429) throw new Error('rate_limited');
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json();
  });

  inFlight[key] = fetchPromise;

  try {
    const data = await fetchPromise;
    cache[key] = { data, ts: Date.now() };
    delete inFlight[key];
    return res.status(200).json(data);
  } catch(e) {
    delete inFlight[key];
    if (e.message === 'rate_limited') {
      return res.status(429).json({ error: 'API rate limit reached — please wait a moment and refresh' });
    }
    return res.status(500).json({ error: e.message });
  }
}