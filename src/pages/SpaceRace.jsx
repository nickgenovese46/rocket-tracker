import React, { useState, useEffect, useMemo, useRef } from 'react';
import { feature } from 'topojson-client';
import { getAgencyCountryStats, getActiveLaunches } from '../services/api';
import './SpaceRace.css';

// country_code values from the agency objects in Launch Library 2 API
const COUNTRIES = [
  { code: 'USA', name: 'United States',         flag: '🇺🇸', color: '#60A5FA', agencyCodes: ['USA'] },
  { code: 'RUS', name: 'Russia / Soviet Union',  flag: '🇷🇺', color: '#A78BFA', agencyCodes: ['RUS', 'SUN', 'UKR'] },
  { code: 'CHN', name: 'China',                  flag: '🇨🇳', color: '#F87171', agencyCodes: ['CHN'] },
  { code: 'EUR', name: 'Europe',                 flag: '🇪🇺', color: '#FBB840', agencyCodes: ['FRA', 'GUF', 'DEU', 'GBR', 'ITA', 'EUR', 'ESA'] },
  { code: 'IND', name: 'India',                  flag: '🇮🇳', color: '#FB923C', agencyCodes: ['IND'] },
  { code: 'JPN', name: 'Japan',                  flag: '🇯🇵', color: '#34D399', agencyCodes: ['JPN'] },
  { code: 'NZL', name: 'New Zealand',            flag: '🇳🇿', color: '#2EE8B8', agencyCodes: ['NZL'] },
  { code: 'KOR', name: 'South Korea',            flag: '🇰🇷', color: '#22D3EE', agencyCodes: ['KOR'] },
  { code: 'IRN', name: 'Iran',                   flag: '🇮🇷', color: '#F472B6', agencyCodes: ['IRN'] },
  { code: 'ISR', name: 'Israel',                 flag: '🇮🇱', color: '#818CF8', agencyCodes: ['ISR'] },
  { code: 'AUS', name: 'Australia',              flag: '🇦🇺', color: '#C084FC', agencyCodes: ['AUS'] },
  { code: 'CAN', name: 'Canada',                 flag: '🇨🇦', color: '#F43F5E', agencyCodes: ['CAN'] },
  { code: 'BRA', name: 'Brazil',                 flag: '🇧🇷', color: '#84CC16', agencyCodes: ['BRA'] },
  { code: 'KAZ', name: 'Kazakhstan',             flag: '🇰🇿', color: '#38BDF8', agencyCodes: ['KAZ'] },
  { code: 'PRK', name: 'North Korea',            flag: '🇰🇵', color: '#F97316', agencyCodes: ['PRK'] },
  { code: 'UAE', name: 'United Arab Emirates',   flag: '🇦🇪', color: '#10B981', agencyCodes: ['UAE'] },
];

// Numeric IDs for each country group on the map
const COUNTRY_GROUP_NUMERICS = {
  USA: [840],
  RUS: [643, 804],
  CHN: [156],
  EUR: [250, 312, 276, 826, 380, 208, 528, 724, 620, 56, 40, 756, 752, 578, 246, 233, 428, 440, 616, 703, 705, 191, 703],
  IND: [356],
  JPN: [392],
  NZL: [554],
  KOR: [410],
  IRN: [364],
  ISR: [376],
  AUS: [36],
  CAN: [124],
  BRA: [76],
  KAZ: [398],
  PRK: [408],
  UAE: [784],
};

const STAT_TABS = [
  { id: 'total',    label: 'Total Launches' },
  { id: 'success',  label: 'Successful'     },
  { id: 'rate',     label: 'Success Rate'   },
  { id: 'upcoming', label: 'Upcoming'       },
  { id: 'agencies', label: 'Agencies'        },
];

export default function SpaceRace() {
  const [agencies, setAgencies]         = useState([]);
  const [upcoming, setUpcoming]         = useState([]);
  const [geoFeatures, setGeoFeatures]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selected, setSelected]         = useState(null);
  const [statTab, setStatTab]           = useState('total');
  const [hoveredCountry, setHoveredCountry] = useState(null);

  useEffect(() => {
    // Use 50m for better resolution and cleaner outlines
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
      .then(r => r.json())
      .then(world => setGeoFeatures(feature(world, world.objects.countries).features))
      .catch(() => {
        // Fallback to 110m
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
          .then(r => r.json())
          .then(world => setGeoFeatures(feature(world, world.objects.countries).features))
          .catch(() => {});
      });

    Promise.allSettled([getAgencyCountryStats(), getActiveLaunches()])
      .then(([agencyResult, upcomingResult]) => {
        if (agencyResult.status === 'rejected') {
          setError(agencyResult.reason?.message || 'Space Race data is temporarily unavailable.');
          setAgencies([]);
        } else {
          setAgencies(agencyResult.value);
        }
        if (upcomingResult.status === 'fulfilled') {
          setUpcoming(upcomingResult.value);
        }
        if (agencyResult.status === 'fulfilled') {
          setError(null);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err?.message || 'Space Race data is temporarily unavailable.');
        setLoading(false);
      });
  }, []);

  // Aggregate per country from agency records
  const countryStats = useMemo(() => {
    return COUNTRIES.map(country => {
      const matched = agencies.filter(a => {
        const codes = (a.country_code || '')
          .split(',')
          .map(c => c.trim().toUpperCase());
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
      const activeAgencies = matched.filter(a => (a.total_launch_count || 0) > 0).length;
      const topAgency = topAgencies[0];

      return { ...country, total, successful, rate, upcomingCount, topAgencies, topAgency, activeAgencies };
    }).filter(c => c.total > 0 || c.upcomingCount > 0);
  }, [agencies, upcoming]);

  const sorted = useMemo(() => {
    return [...countryStats].sort((a, b) => {
      if (statTab === 'total')    return b.total         - a.total;
      if (statTab === 'success')  return b.successful    - a.successful;
      if (statTab === 'rate')     return b.rate          - a.rate;
      if (statTab === 'upcoming') return b.upcomingCount - a.upcomingCount;
      if (statTab === 'agencies') return b.activeAgencies - a.activeAgencies;
      return 0;
    });
  }, [countryStats, statTab]);

  function getVal(c) {
    if (statTab === 'total')    return c.total;
    if (statTab === 'success')  return c.successful;
    if (statTab === 'rate')     return c.rate;
    if (statTab === 'upcoming') return c.upcomingCount;
    if (statTab === 'agencies') return c.activeAgencies;
    return 0;
  }

  function formatVal(c) {
    if (statTab === 'rate') return `${c.rate}%`;
    return getVal(c).toLocaleString();
  }

  const maxVal = sorted.length > 0 ? Math.max(getVal(sorted[0]), 1) : 1;

  // Build numeric → country map for choropleth
  const colorMap = useMemo(() => {
    const maxTotal = Math.max(...countryStats.map(c => c.total), 1);
    const map = {};
    countryStats.forEach(c => {
      const numerics = COUNTRY_GROUP_NUMERICS[c.code] || [];
      numerics.forEach(numId => {
        map[numId] = {
          color:     c.color,
          intensity: Math.min(1, c.total / maxTotal),
          country:   c,
        };
      });
    });
    return map;
  }, [countryStats]);

  const selectedCountry = countryStats.find(c => c.code === selected);
  const globalTotal     = countryStats.reduce((s, c) => s + c.total, 0);
  const globalSuccess   = countryStats.reduce((s, c) => s + c.successful, 0);
  const globalRate      = globalTotal > 0 ? Math.round((globalSuccess / globalTotal) * 100) : 0;
  const totalAgencies   = agencies.length;
  const activeCountries = countryStats.length;
  const listRef = useRef(null);

  useEffect(() => {
  if (!selected || !listRef.current) return;
  const card = listRef.current.querySelector('.lb-selected');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}, [selected]);

  if (loading) return <div className="page-state">Loading Space Race data...</div>;
  if (error) return (
    <div className="page-state error">
      ⚠ {error}
      <button onClick={() => window.location.reload()} className="retry-btn">Try Again</button>
    </div>
  );

  return (
    <div className="spacerace">

      <div className="sr-header">
        <div>
          <div className="sr-eyebrow">COUNTRY VS COUNTRY</div>
          <h1 className="sr-title">Space Race</h1>
          <p className="sr-sub">
            Which nation leads the race to space? Stats from{' '}
            {totalAgencies} agencies spanning the full history of spaceflight.
            Click any country to explore further.
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
        <StatBlock value={activeCountries}                label="Countries tracked"          color="var(--red)"        />
      </div>

      <div className="sr-layout">

        {/* LEFT — LEADERBOARD */}
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

          <div className="lb-list" ref={listRef}>
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
                      <div
                        className="lb-bar"
                        style={{
                          width: `${(val / maxVal) * 100}%`,
                          background: country.color,
                        }}
                      />
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
                      <span className="lb-sub-sep">·</span>
                      <span className="lb-sub-item">
                        <span className="lb-sub-label">Agencies</span>
                        <span className="lb-sub-val">{country.activeAgencies}</span>
                      </span>
                      {country.upcomingCount > 0 && (
                        <>
                          <span className="lb-sub-sep">·</span>
                          <span className="lb-sub-item">
                            <span className="lb-sub-label">Upcoming</span>
                            <span className="lb-sub-val" style={{ color: country.color }}>
                              {country.upcomingCount}
                            </span>
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
                          <a
                            href={country.topAgencies[0].website}
                            target="_blank"
                            rel="noreferrer"
                            className="lb-link"
                            onClick={e => e.stopPropagation()}
                            style={{ color: country.color }}
                          >
                            Primary agency website ↗
                          </a>
                        )}
                        {country.topAgency && (
                          <div className="lb-agency-note">
                            Lead agency: {country.topAgency.name}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — MAP + LEGEND */}
        <div className="sr-right">
            {selectedCountry && (
  <div className="sr-selected-panel" style={{ borderColor: selectedCountry.color }}>
    <div className="ssp-header">
      <div className="ssp-title">
        <span className="ssp-flag">{selectedCountry.flag}</span>
        <span className="ssp-name" style={{ color: selectedCountry.color }}>
          {selectedCountry.name}
        </span>
      </div>
      <button className="sr-clear-btn" onClick={() => setSelected(null)}>✕</button>
    </div>

    <div className="ssp-stats">
      <div className="ssp-stat">
        <span className="ssp-val" style={{ color: selectedCountry.color }}>
          {selectedCountry.total.toLocaleString()}
        </span>
        <span className="ssp-label">Total launches</span>
      </div>
      <div className="ssp-stat">
        <span className="ssp-val" style={{ color: selectedCountry.color }}>
          {selectedCountry.successful.toLocaleString()}
        </span>
        <span className="ssp-label">Successful</span>
      </div>
      <div className="ssp-stat">
        <span className="ssp-val" style={{ color: selectedCountry.color }}>
          {selectedCountry.rate}%
        </span>
        <span className="ssp-label">Success rate</span>
      </div>
      <div className="ssp-stat">
        <span className="ssp-val" style={{ color: selectedCountry.color }}>
          {selectedCountry.upcomingCount}
        </span>
        <span className="ssp-label">Upcoming</span>
      </div>
      <div className="ssp-stat">
        <span className="ssp-val" style={{ color: selectedCountry.color }}>
          {selectedCountry.activeAgencies}
        </span>
        <span className="ssp-label">Agencies</span>
      </div>
    </div>

    <div className="ssp-compare">
      <div>
        <span className="ssp-compare-label">Share of tracked launches</span>
        <strong style={{ color: selectedCountry.color }}>
          {globalTotal > 0 ? `${((selectedCountry.total / globalTotal) * 100).toFixed(1)}%` : '0%'}
        </strong>
      </div>
      <div>
        <span className="ssp-compare-label">Leader</span>
        <strong style={{ color: selectedCountry.color }}>
          {selectedCountry.topAgency?.name || 'No agency data'}
        </strong>
      </div>
    </div>

    {selectedCountry.topAgencies.length > 0 && (
      <div className="ssp-agencies">
        <div className="ssp-agencies-label">TOP AGENCIES</div>
        {selectedCountry.topAgencies.map(a => (
          <div key={a.id} className="ssp-agency-row">
            <span className="ssp-agency-name">{a.name}</span>
            <span className="ssp-agency-count" style={{ color: selectedCountry.color }}>
              {(a.total_launch_count || 0).toLocaleString()}
            </span>
          </div>
        ))}
        {selectedCountry.topAgencies[0]?.website && (
          <a
            href={selectedCountry.topAgencies[0].website}
            target="_blank"
            rel="noreferrer"
            className="lb-link"
            style={{ color: selectedCountry.color, marginTop: 8, display: 'inline-block' }}
          >
            Agency website ↗
          </a>
        )}
      </div>
    )}
  </div>
)}
          <div className="sr-map-wrap">
            <div className="sr-map-label">
              {selected
                ? `${selectedCountry?.flag} ${selectedCountry?.name} — ${selectedCountry?.total.toLocaleString()} total launches`
                : 'Brighter = more launches. Click a country on the map or in the list.'}
            </div>

            <svg
              viewBox="0 0 960 480"
              className="sr-map-svg"
            >
              <rect width="960" height="480" fill="#020D1F" />

              {geoFeatures.map((feat, i) => {
                const numId = parseInt(feat.id);
                const entry = colorMap[numId];
                const geo   = feat.geometry;
                if (!geo) return null;

                const toPath = (coordinates) =>
                coordinates.map(ring => {
                    let d = '';
                    let prevX = null;
                    for (let i = 0; i < ring.length; i++) {
                    const x = ((parseFloat(ring[i][0]) + 180) / 360) * 960;
                    const y = ((90 - parseFloat(ring[i][1])) / 180) * 480;
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
                  : geo.type === 'MultiPolygon'
                  ? geo.coordinates : [];

                let fill    = '#0A1E35';
                let stroke  = '#132840';
                let sWidth  = 0.5;
                let opacity = 1;

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
                    fill={fill}
                    fillOpacity={opacity}
                    stroke={stroke}
                    strokeWidth={sWidth}
                    strokeOpacity={entry ? 0.5 : 0.4}
                    style={{ cursor: entry ? 'pointer' : 'default' }}
                    onMouseEnter={() => entry && setHoveredCountry(entry.country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    onClick={() => entry && setSelected(
                      selected === entry.country?.code ? null : entry.country?.code
                    )}
                  />
                ));
              })}

              {/* Latitude lines */}
              {[-60,-30,0,30,60].map(lat => {
                const y = ((90 - lat) / 180) * 480;
                return <line key={lat} x1="0" y1={y} x2="960" y2={y}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
              })}
              {/* Longitude lines */}
              {[-120,-60,0,60,120].map(lng => {
                const x = ((lng + 180) / 360) * 960;
                return <line key={lng} x1={x} y1="0" x2={x} y2="480"
                  stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
              })}
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

          {/* LEGEND */}
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
                  <span className="legend-dot"  style={{ background: c.color }} />
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
