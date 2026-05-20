const cache = {};
const TTL = 60 * 60 * 1000; // 1 hour — archive doesn't change often

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { limit = 20, offset = 0, extra = '' } = req.query;
  const key = `prev_${limit}_${offset}_${extra}`;

  if (cache[key] && Date.now() - cache[key].ts < TTL) {
    return res.status(200).json(cache[key].data);
  }
  try {
    const r = await fetch(
      `https://ll.thespacedevs.com/2.2.0/launch/previous/?limit=${limit}&offset=${offset}&mode=normal&ordering=-net${extra}`
    );
    if (r.status === 429) return res.status(429).json({ error: 'Upstream rate limit' });
    const data = await r.json();
    cache[key] = { data, ts: Date.now() };
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}