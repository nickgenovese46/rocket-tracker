const cache = {};
const TTL = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'code required' });

  if (cache[code]?.data && Date.now() - cache[code].ts < TTL) {
    return res.status(200).json(cache[code].data);
  }

  try {
    const yearCounts = {};
    let offset = 0;
    const limit = 100;
    const maxPages = 8; // up to 800 launches

    for (let page = 0; page < maxPages; page++) {
      const r = await fetch(
        `https://ll.thespacedevs.com/2.2.0/launch/previous/?limit=${limit}&offset=${offset}&launch_service_provider__country_code=${code}&ordering=net`
      );
      if (r.status === 429 || !r.ok) break;
      const data = await r.json();
      const results = data.results || [];
      results.forEach(launch => {
        const year = new Date(launch.net).getFullYear();
        if (!isNaN(year) && year >= 1950) {
          yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
      });
      if (!data.next || results.length < limit) break;
      offset += limit;
    }

    const result = Object.entries(yearCounts)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year);

    cache[code] = { data: result, ts: Date.now() };
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}