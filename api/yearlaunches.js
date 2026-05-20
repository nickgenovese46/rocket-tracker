let cache = { data: null, ts: 0 };
const TTL = 10 * 60 * 1000; // 10 minutes instead of 30

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cache.data && Date.now() - cache.ts < TTL) {
    return res.status(200).json(cache.data);
  }
  try {
    const year = new Date().getFullYear();
    const r = await fetch(
      `https://ll.thespacedevs.com/2.2.0/launch/previous/?limit=100&mode=normal&net__gte=${year}-01-01&ordering=-net`
    );
    if (r.status === 429) return res.status(429).json({ error: 'Upstream rate limit' });
    const data = await r.json();
    cache = { data, ts: Date.now() };
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}