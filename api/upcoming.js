let cache = { data: null, ts: 0 };
const TTL = 3 * 60 * 1000; // 5 minutes — upcoming launches change often

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cache.data && Date.now() - cache.ts < TTL) {
    return res.status(200).json(cache.data);
  }
  try {
    const r = await fetch(
      'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=detailed'
    );
    if (r.status === 429) return res.status(429).json({ error: 'Upstream rate limit' });
    const data = await r.json();
    cache = { data, ts: Date.now() };
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}