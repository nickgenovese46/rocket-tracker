import React, { useState, useEffect, useMemo } from 'react';
import { feature } from 'topojson-client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getAgencyCountryStats, getActiveLaunches, getPreviousLaunches } from '../services/api';
import './SpaceRace.css';

const COUNTRY_NUMERIC = {
  USA: 840, RUS: 643, CHN: 156, FRA: 250, GUF: 312,
  IND: 356, JPN: 392, NZL: 554, KAZ: 398, IRN: 364,
  KOR: 410, ISR: 376, AUS: 36,  PRK: 408, DEU: 276,
  GBR: 826, ITA: 380, UKR: 804,
};

const COUNTRIES = [
  { code: 'USA', name: 'United States',        flag: '🇺🇸', color: '#60A5FA', agencyCodes: ['USA'] },
  { code: 'RUS', name: 'Russia / Soviet Union', flag: '🇷🇺', color: '#A78BFA', agencyCodes: ['RUS', 'SUN', 'UKR'] },
  { code: 'CHN', name: 'China',                 flag: '🇨🇳', color: '#F87171', agencyCodes: ['CHN'] },
  { code: 'EUR', name: 'Europe',                flag: '🇪🇺', color: '#FBB840', agencyCodes: ['FRA', 'GUF', 'DEU', 'GBR', 'ITA', 'EUR', 'ESA'] },
  { code: 'IND', name: 'India',                 flag: '🇮🇳', color: '#FB923C', agencyCodes: ['IND'] },
  { code: 'JPN', name: 'Japan',                 flag: '🇯🇵', color: '#34D399', agencyCodes: ['JPN'] },
  { code: 'NZL', name: 'New Zealand',           flag: '🇳🇿', color: '#2EE8B8', agencyCodes: ['NZL'] },
  { code: 'KOR', name: 'South Korea',           flag: '🇰🇷', color: '#22D3EE', agencyCodes: ['KOR'] },
  { code: 'IRN', name: 'Iran',                  flag: '🇮🇷', color: '#F472B6', agencyCodes: ['IRN'] },
  { code: 'ISR', name: 'Israel',                flag: '🇮🇱', color: '#818CF8', agencyCodes: ['ISR'] },
  { code: 'AUS', name: 'Australia',             flag: '🇦🇺', color: '#C084FC', agencyCodes: ['AUS'] },
];

const COUNTRY_GROUP_NUMERICS = {
  USA: [840],
  RUS: [643, 804],
  CHN: [156],
  EUR: [250, 312, 276, 826, 380, 208, 528, 724, 620, 56, 40, 756, 752, 578, 246, 233, 428, 440, 616, 703, 705, 191],
  IND: [356],
  JPN: [392],
  NZL: [554],
  KOR: [410],
  IRN: [364],
  ISR: [376],
  AUS: [36],
};

const STAT_TABS = [
  { id: 'total',    label: 'Total Launches' },
  { id: 'success',  label: 'Successful'     },
  { id: 'rate',     label: 'Success Rate'   },
  { id: 'upcoming', label: 'Upcoming'       },
];

export default function SpaceRace() {
  const [agencies, setAgencies]       = useState([]);
  const [upcoming, setUpcoming]       = useState([]);
  const [geoFeatures, setGeoFeatures] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [statTab, setStatTab]         = useState('total');
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [timelineData, setTimelineData]     = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
      .then(r => r.json())
      .then(world => setGeoFeatures(feature(world, world.objects.countries).features))
      .catch(() => {
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
          .then(r => r.json())
          .then(world => setGeoFeatures(feature(world, world.objects.countries).features))
          .catch(() => {});
      });

    Promise.all([getAgencyCountryStats(), getActiveLaunches()])
      .then(([agencyData, upcomingData]) => {
        setAgencies(agencyData);
        setUpcoming(upcomingData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch launch history for timeline — 10 pages × 100 = 1000 launches
  useEffect(() => {
    const offsets = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    Promise.all(offsets.map(offset => getPreviousLaunches(100, offset)))
      .then(pages => {
        const all = pages.flatMap(p => p.results || []);
        const byYear = {};
        all.forEach(l => {
          if (!l.net) return;
          const year = new Date(l.net).getFullYear();
          if (year < 1955 || year > new Date().getFullYear()) return;
          const rawCode = (l.pad?.location?.country_code || '').trim().toUpperCase();
          let countryCode = 'OTHER';
          for (const country of COUNTRIES) {
            if (country.agencyCodes.some(pc => rawCode === pc || rawCode.startsWith(pc))) {
              countryCode = country.code;
              break;
            }
          }
          if (!byYear[year]) byYear[year] = {};
          byYear[year][countryCode] = (byYear[year][countryCode] || 0) + 1;
        });
        const data = Object.entries(byYear)
          .map(([year, counts]) => ({ year: parseInt(year), ...counts }))
          .sort((a, b) => a.year - b.year);
        setTimelineData(data);
        setTimelineLoading(false);
      })
      .catch(() => setTimelineLoading(false));
  }, []);

  const countryStats = useMemo(() => {
    return COUNTRIES.map(country => {
      const matched = agencies.filter(a => {
        const codes = (a.country_code || '').split(',').map(c => c.trim().toUpperCase());
        return country.agencyCodes.some(target =>
          codes.some(code => code === target || code.startsWith(target))
        );
      });
      const total      = matched.reduce((s, a) => s + (a.total_launch_count  || 0), 0);
      const successful = matched.reduce((s, a) => s + (a.successful_launches || 0), 0);
      const rate       = total > 0 ? Math.round((successful / total) * 100) : 0;
      const upcomingCount = upcoming.filter(l => {
        const code = (l.pad?.location?.country_code || '').trim().toUpperCase();
        return country.agencyCodes.some(c => code === c || code.startsWith(c));
      }).length;
      const topAgencies = [...matched]
        .sort((a, b) => (b.total_launch_count || 0) - (a.total_launch_count || 0))
        .slice(0, 5);
      return { ...country, total, successful, rate, upcomingCount, topAgencies };
    }).filter(c => c.total > 0 || c.upcomingCount > 0);
  }, [agencies, upcoming]);

  const sorted = useMemo(() => {
    return [...countryStats].sort((a, b) => {
      if (statTab === 'total')    return b.total         - a.total;
      if (statTab === 'success')  return b.successful    - a.successful;
      if (statTab === 'rate')     return b.rate          - a.rate;
      if (statTab === 'upcoming') return b.upcomingCount - a.upcomingCount;
      return 0;
    });
  }, [countryStats, statTab]);

  function getVal(c) {
    if (statTab === 'total')    return c.total;
    if (statTab === 'success')  return c.successful;
    if (statTab === 'rate')     return c.rate;
    if (statTab === 'upcoming') return c.upcomingCount;
    return 0;
  }

  function formatVal(c) {
    if (statTab === 'rate') return `${c.rate}%`;
    return getVal(c).toLocaleString();
  }

  const maxVal      = sorted.length > 0 ? Math.max(getVal(sorted[0]), 1) : 1;
  const colorMap    = useMemo(() => {
    const maxTotal = Math.max(...countryStats.map(c => c.total), 1);
    const map = {};
    countryStats.forEach(c => {
      (COUNTRY_GROUP_NUMERICS[c.code] || []).forEach(numId => {
        map[numId] = { color: c.color, intensity: Math.min(1, c.total / maxTotal), country: c };
      });
    });
    return map;
  }, [countryStats]);

  const selectedCountry = countryStats.find(c => c.code === selected);
  const globalTotal     = countryStats.reduce((s, c) => s + c.total, 0);
  const globalSuccess   = countryStats.reduce((s, c) => s + c.successful, 0);
  const globalRate      = globalTotal > 0 ? Math.round((globalSuccess / globalTotal) * 100) : 0;

  if (loading) return <div className="page-state">Loading Space Race data...</div>;

  return (
    <div className="spacerace">

      <div className="sr-header">
        <div>
          <div className="sr-eyebrow">COUNTRY VS COUNTRY</div>
          <h1 className="sr-title">Space Race</h1>
          <p className="sr-sub">
            Which nation leads the race to space? Stats from {agencies.length} agencies
            spanning the full history of spaceflight. Click any country to explore.
          </p>
        </div>
        {selected && (
          <button className="sr-clear-btn" onClick={() => setSelected(null)}>
            ✕ Clear selection
          </button>
        )}
      </div>

      <div className="sr-stats-row">
        <StatBlock value={globalTotal.toLocaleString()}   label="Total launches (all time)" color="var(--blue-light)" />
        <StatBlock value={globalSuccess.toLocaleString()} label="Successful launches"        color="var(--teal)"       />
        <StatBlock value={`${globalRate}%`}               label="Global success rate"        color="var(--amber)"      />
        <StatBlock value={upcoming.length}                label="Upcoming launches"          color="var(--purple)"     />
      </div>

      <div className="sr-layout">

        {/* LEFT — LEADERBOARD + TIMELINE */}
        <div className="sr-left">
          <div className="sr-stat-tabs">
            {STAT_TABS.map(t => (
              <button
                key={t.id}
                className={`sr-stat-tab ${statTab === t.id ? 'active' : ''}`}
                onClick={() => setStatTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="sr-section-label" style={{ marginBottom: 14 }}>
            RANKED BY {STAT_TABS.find(t => t.id === statTab)?.label.toUpperCase()}
          </div>

          {/* COUNTRY CARDS */}
          <div className="lb-list">
            {sorted.map((country, i) => {
              const val        = getVal(country);
              const isSelected = selected === country.code;
              const isOther    = selected && !isSelected;
              return (
                <div
                  key={country.code}
                  className={`lb-card ${isSelected ? 'lb-selected' : ''} ${isOther ? 'lb-dimmed' : ''}`}
                  onClick={() => setSelected(isSelected ? null : country.code)}
                  style={isSelected ? { borderColor: country.color } : {}}
                >
                  <div className="lb-card-bar" style={{ background: country.color }} />
                  <div className="lb-card-body">
                    <div className="lb-card-top">
                      <div className="lb-rank-name">
                        <span className="lb-rank" style={{ color: country.color }}>#{i + 1}</span>
                        <span className="lb-flag">{country.flag}</span>
                        <span className="lb-name">{country.name}</span>
                      </div>
                      <div className="lb-stat-val" style={{ color: country.color }}>
                        {formatVal(country)}
                      </div>
                    </div>
                    <div className="lb-bar-wrap">
                      <div className="lb-bar" style={{ width: `${(val / maxVal) * 100}%`, background: country.color }} />
                    </div>
                    <div className="lb-sub-stats">
                      <span className="lb-sub-item">
                        <span className="lb-sub-label">Total</span>
                        <span className="lb-sub-val">{country.total.toLocaleString()}</span>
                      </span>
                      <span className="lb-sub-sep">·</span>
                      <span className="lb-sub-item">
                        <span className="lb-sub-label">Success</span>
                        <span className="lb-sub-val">{country.successful.toLocaleString()}</span>
                      </span>
                      <span className="lb-sub-sep">·</span>
                      <span className="lb-sub-item">
                        <span className="lb-sub-label">Rate</span>
                        <span className="lb-sub-val">{country.rate}%</span>
                      </span>
                      {country.upcomingCount > 0 && (
                        <>
                          <span className="lb-sub-sep">·</span>
                          <span className="lb-sub-item">
                            <span className="lb-sub-label">Upcoming</span>
                            <span className="lb-sub-val" style={{ color: country.color }}>{country.upcomingCount}</span>
                          </span>
                        </>
                      )}
                    </div>
                    {isSelected && country.topAgencies.length > 0 && (
                      <div className="lb-agencies">
                        <div className="lb-agencies-label">TOP AGENCIES</div>
                        {country.topAgencies.map(a => (
                          <div key={a.id} className="lb-agency-row">
                            <span className="lb-agency-name">{a.name}</span>
                            <span className="lb-agency-count" style={{ color: country.color }}>
                              {(a.total_launch_count || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {country.topAgencies[0]?.website && (
                          <a href={country.topAgencies[0].website} target="_blank" rel="noreferrer"
                            className="lb-link" onClick={e => e.stopPropagation()}
                            style={{ color: country.color }}>
                            Primary agency website ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* TIMELINE — below leaderboard */}
          <div className="sr-timeline">
            <div className="sr-timeline-header">
              <div className="sr-section-label">LAUNCH HISTORY BY YEAR</div>
              {selected && (
                <div className="sr-timeline-hint" style={{ color: selectedCountry?.color }}>
                  {selectedCountry?.flag} {selectedCountry?.name} highlighted
                </div>
              )}
            </div>
            {timelineLoading ? (
              <div className="sr-timeline-loading">Loading timeline...</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const total = payload.reduce((s, p) => s + (p.value || 0), 0);
                      return (
                        <div style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-active)',
                          borderRadius: 8, padding: '10px 14px',
                          fontSize: 11, color: 'var(--text-primary)', minWidth: 150,
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
                          {payload
                            .filter(p => p.value > 0)
                            .sort((a, b) => b.value - a.value)
                            .map(p => {
                              const country = COUNTRIES.find(c => c.code === p.dataKey);
                              return (
                                <div key={p.dataKey} style={{
                                  display: 'flex', justifyContent: 'space-between',
                                  gap: 10, color: p.fill, marginBottom: 2,
                                }}>
                                  <span>{country?.flag} {country?.name || p.dataKey}</span>
                                  <span style={{ fontWeight: 600 }}>{p.value}</span>
                                </div>
                              );
                            })}
                          <div style={{
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            marginTop: 5, paddingTop: 5,
                            color: 'var(--text-secondary)',
                            display: 'flex', justifyContent: 'space-between',
                          }}>
                            <span>Total</span>
                            <span style={{ fontWeight: 700 }}>{total}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {COUNTRIES.map(country => (
                    <Area
                      key={country.code}
                      type="monotone"
                      dataKey={country.code}
                      stackId="a"
                      stroke={country.color}
                      fill={country.color}
                      fillOpacity={selected
                        ? selected === country.code ? 0.5  : 0.03
                        : 0.22}
                      strokeOpacity={selected
                        ? selected === country.code ? 1.0  : 0.08
                        : 0.65}
                      strokeWidth={selected === country.code ? 2 : 1}
                      onClick={() => setSelected(selected === country.code ? null : country.code)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RIGHT — MAP + LEGEND */}
        <div className="sr-right">
          <div className="sr-map-wrap">
            <div className="sr-map-label">
              {selected
                ? `${selectedCountry?.flag} ${selectedCountry?.name} — ${selectedCountry?.total.toLocaleString()} total launches`
                : 'Brighter = more launches. Click a country on the map or in the list.'}
            </div>
            <svg viewBox="0 0 960 520" className="sr-map-svg">
              <rect width="960" height="520" fill="#020D1F" />
              {geoFeatures.map((feat, i) => {
                const numId = parseInt(feat.id);
                const entry = colorMap[numId];
                const geo   = feat.geometry;
                if (!geo) return null;
                const toPath = (coordinates) =>
                  coordinates.map(ring => {
                    let d = ''; let prevX = null;
                    for (let i = 0; i < ring.length; i++) {
                      const x = ((parseFloat(ring[i][0]) + 180) / 360) * 960;
                      const y = ((90 - parseFloat(ring[i][1])) / 180) * 520;
                      if (i === 0 || (prevX !== null && Math.abs(x - prevX) > 480)) {
                        d += `M${x.toFixed(1)},${y.toFixed(1)}`;
                      } else {
                        d += `L${x.toFixed(1)},${y.toFixed(1)}`;
                      }
                      prevX = x;
                    }
                    return d + 'Z';
                  }).join(' ');
                const polygons = geo.type === 'Polygon'
                  ? [geo.coordinates]
                  : geo.type === 'MultiPolygon' ? geo.coordinates : [];
                let fill = '#0A1E35', stroke = '#132840', sWidth = 0.5, opacity = 1;
                if (entry) {
                  fill    = entry.color;
                  opacity = selected
                    ? (entry.country?.code === selected ? 0.65 : 0.06)
                    : Math.max(0.15, entry.intensity * 0.8);
                  stroke  = entry.color;
                  sWidth  = 0.8;
                }
                return polygons.map((coords, j) => (
                  <path
                    key={`${i}-${j}`}
                    d={toPath(coords)}
                    fill={fill} fillOpacity={opacity}
                    stroke={stroke} strokeWidth={sWidth} strokeOpacity={entry ? 0.5 : 0.4}
                    style={{ cursor: entry ? 'pointer' : 'default' }}
                    onMouseEnter={() => entry && setHoveredCountry(entry.country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    onClick={() => entry && setSelected(
                      selected === entry.country?.code ? null : entry.country?.code
                    )}
                  />
                ));
              })}
              {[-60,-30,0,30,60].map(lat => (
                <line key={lat} x1="0" y1={((90-lat)/180)*520} x2="960" y2={((90-lat)/180)*520}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              ))}
              {[-120,-60,0,60,120].map(lng => (
                <line key={lng} x1={((lng+180)/360)*960} y1="0" x2={((lng+180)/360)*960} y2="520"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              ))}
            </svg>
            {hoveredCountry && (
              <div className="sr-pad-tooltip">
                <div className="spt-name">{hoveredCountry.flag} {hoveredCountry.name}</div>
                <div className="spt-meta">
                  {hoveredCountry.total.toLocaleString()} launches · {hoveredCountry.rate}% success rate
                </div>
              </div>
            )}
          </div>

          <div className="sr-legend">
            <div className="sr-section-label" style={{ marginBottom: 10 }}>COUNTRY KEY</div>
            <div className="legend-grid">
              {countryStats.map(c => (
                <div
                  key={c.code}
                  className={`legend-item ${selected === c.code ? 'active' : ''}`}
                  onClick={() => setSelected(selected === c.code ? null : c.code)}
                  style={selected === c.code ? { borderColor: c.color } : {}}
                >
                  <span className="legend-dot" style={{ background: c.color }} />
                  <span className="legend-flag">{c.flag}</span>
                  <span className="legend-name">{c.name}</span>
                  <span className="legend-count" style={{ color: c.color }}>
                    {c.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ value, label, color }) {
  return (
    <div className="sr-stat-block">
      <span className="ssb-val" style={{ color }}>{value}</span>
      <span className="ssb-label">{label}</span>
    </div>
  );
}