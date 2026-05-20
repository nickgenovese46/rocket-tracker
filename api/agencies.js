let cache = { data: null, ts: 0 };
const TTL = 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { offset = 0 } = req.query;
  const key = `agencies_${offset}`;

  if (cache[key]?.data && Date.now() - cache[key].ts < TTL) {
    return res.status(200).json(cache[key].data);
  }
  try {
    const r = await fetch(
      `https://ll.thespacedevs.com/2.2.0/agencies/?limit=100&offset=${offset}&ordering=-total_launch_count&mode=detailed`
    );
    if (r.status === 429) return res.status(429).json({ error: 'Upstream rate limit' });
    const data = await r.json();
    if (!cache[key]) cache[key] = {};
    cache[key] = { data, ts: Date.now() };
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}