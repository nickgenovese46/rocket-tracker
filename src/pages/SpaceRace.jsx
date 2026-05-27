import React, { useState, useEffect, useMemo, useRef } from 'react';
import { feature } from 'topojson-client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

// Hardcoded launch counts per country per year (1950–2025)
// Note: approximate figures based on historical records
const LAUNCH_HISTORY = {
  USA: {
    1958:7, 1959:17, 1960:19, 1961:29, 1962:52, 1963:38, 1964:57, 1965:63,
    1966:73, 1967:58, 1968:45, 1969:35, 1970:27, 1971:31, 1972:27, 1973:23,
    1974:18, 1975:27, 1976:25, 1977:24, 1978:32, 1979:16, 1980:14, 1981:18,
    1982:18, 1983:22, 1984:22, 1985:17, 1986:7,  1987:8,  1988:12, 1989:18,
    1990:27, 1991:18, 1992:28, 1993:23, 1994:27, 1995:27, 1996:32, 1997:36,
    1998:36, 1999:30, 2000:28, 2001:24, 2002:19, 2003:26, 2004:16, 2005:14,
    2006:19, 2007:19, 2008:16, 2009:25, 2010:15, 2011:18, 2012:13, 2013:19,
    2014:23, 2015:20, 2016:22, 2017:29, 2018:34, 2019:27, 2020:44, 2021:51,
    2022:78, 2023:108, 2024:138, 2025:155,
  },
  RUS: {
    // Soviet Union (SUN) + Russia (RUS) combined
    1957:2,  1958:1,  1959:6,  1960:17, 1961:20, 1962:30, 1963:25, 1964:30,
    1965:48, 1966:45, 1967:67, 1968:71, 1969:60, 1970:81, 1971:83, 1972:74,
    1973:86, 1974:81, 1975:89, 1976:98, 1977:99, 1978:88, 1979:87, 1980:89,
    1981:98, 1982:101,1983:98, 1984:97, 1985:98, 1986:91, 1987:95, 1988:90,
    1989:74, 1990:75, 1991:59, 1992:54, 1993:47, 1994:48, 1995:32, 1996:26,
    1997:28, 1998:24, 1999:26, 2000:36, 2001:23, 2002:25, 2003:21, 2004:23,
    2005:26, 2006:25, 2007:26, 2008:27, 2009:31, 2010:31, 2011:32, 2012:24,
    2013:32, 2014:32, 2015:29, 2016:19, 2017:20, 2018:20, 2019:25, 2020:17,
    2021:25, 2022:22, 2023:19, 2024:18, 2025:15,
  },
  CHN: {
    1970:1,  1971:1,  1975:3,  1976:2,  1978:1,  1980:1,  1981:1,  1982:1,
    1983:1,  1984:2,  1985:1,  1986:2,  1987:3,  1988:4,  1990:5,  1991:1,
    1992:4,  1993:1,  1994:5,  1995:4,  1996:3,  1997:6,  1998:6,  1999:4,
    2000:5,  2001:1,  2002:4,  2003:6,  2004:8,  2005:5,  2006:6,  2007:10,
    2008:11, 2009:6,  2010:15, 2011:19, 2012:19, 2013:15, 2014:16, 2015:19,
    2016:22, 2017:18, 2018:39, 2019:34, 2020:39, 2021:55, 2022:64, 2023:67,
    2024:68, 2025:70,
  },
  EUR: {
    // ESA / Ariane / CNES — European launches
    1965:1,  1966:1,  1967:1,  1970:1,  1971:1,  1973:2,  1975:1,  1979:1,
    1980:2,  1981:2,  1982:3,  1983:3,  1984:6,  1985:3,  1986:3,  1987:6,
    1988:5,  1989:8,  1990:8,  1991:8,  1992:7,  1993:7,  1994:8,  1995:11,
    1996:10, 1997:12, 1998:11, 1999:10, 2000:12, 2001:10, 2002:12, 2003:7,
    2004:6,  2005:8,  2006:8,  2007:8,  2008:7,  2009:7,  2010:7,  2011:8,
    2012:11, 2013:7,  2014:11, 2015:12, 2016:12, 2017:11, 2018:10, 2019:9,
    2020:5,  2021:5,  2022:6,  2023:3,  2024:4,  2025:5,
  },
  IND: {
    1979:1,  1980:1,  1983:1,  1987:1,  1988:1,  1990:1,  1992:1,  1993:1,
    1994:1,  1996:1,  1997:1,  1999:1,  2001:2,  2002:1,  2003:1,  2004:1,
    2005:1,  2007:2,  2008:2,  2009:2,  2010:1,  2011:3,  2012:2,  2013:3,
    2014:4,  2015:5,  2016:7,  2017:5,  2018:5,  2019:7,  2020:2,  2021:3,
    2022:5,  2023:7,  2024:8,  2025:9,
  },
  JPN: {
    1970:1,  1971:1,  1972:1,  1974:1,  1975:1,  1976:1,  1977:2,  1978:2,
    1979:1,  1980:1,  1981:1,  1982:1,  1983:2,  1984:2,  1985:2,  1986:2,
    1987:2,  1988:2,  1989:3,  1990:4,  1991:3,  1992:2,  1993:2,  1994:4,
    1995:3,  1996:2,  1997:2,  1998:2,  1999:2,  2000:1,  2001:1,  2002:3,
    2003:3,  2005:2,  2006:6,  2007:4,  2008:3,  2009:4,  2010:2,  2011:3,
    2012:2,  2013:4,  2014:5,  2015:4,  2016:4,  2017:7,  2018:6,  2019:2,
    2020:4,  2021:3,  2022:3,  2023:6,  2024:5,  2025:4,
  },
  NZL: {
    2017:2,  2018:3,  2019:6,  2020:7,  2021:6,  2022:9,  2023:10, 2024:14, 2025:16,
  },
  KOR: {
    2013:1,  2018:1,  2022:1,  2023:2,  2024:3,  2025:4,
  },
  IRN: {
    2009:1,  2010:1,  2012:1,  2015:1,  2017:1,  2019:2,  2020:1,  2021:1,
    2022:2,  2023:3,  2024:3,  2025:2,
  },
  ISR: {
    1988:1,  1990:1,  1994:1,  1995:1,  1998:1,  2002:1,  2007:1,  2020:1,
    2021:1,  2023:1,  2024:1,
  },
  PRK: {
    1998:1,  2009:1,  2012:1,  2016:1,  2022:1,  2023:2,  2024:2,  2025:1,
  },
  AUS: { 2017:1, 2022:1, 2023:1, 2024:2, 2025:2 },
  CAN: { 1969:1, 1972:1 },
  BRA: { 2023:1, 2024:1 },
  KAZ: {},
};

export default function SpaceRace() {
  const [agencies, setAgencies]         = useState([]);
  const [upcoming, setUpcoming]         = useState([]);
  const [geoFeatures, setGeoFeatures]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selected, setSelected]         = useState(null);
  const [statTab, setStatTab]           = useState('total');
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [countryHistory, setCountryHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

useEffect(() => {
  if (!selected) { setCountryHistory([]); return; }

  const staticData = LAUNCH_HISTORY[selected] || {};
  const firstYear = Math.min(...Object.keys(staticData).map(Number).filter(y => staticData[y] > 0), 2025);

  const rows = [];
  for (let y = firstYear; y <= 2025; y++) {
    rows.push({ year: y, count: staticData[y] || 0 });
  }

  setHistoryLoading(true);

  fetch('/api/yearlaunches')
    .then(r => r.json())
    .then(data => {
      const results = data.results || [];
      const country = COUNTRIES.find(c => c.code === selected);
      const count2026 = results.filter(l => {
        const providerCode = (l.launch_service_provider?.country_code || '').toUpperCase();
        if (providerCode && country?.agencyCodes.some(ac => providerCode.includes(ac))) return true;
        const padCode = (l.pad?.location?.country_code || '').toUpperCase();
        if (padCode && country?.agencyCodes.some(ac => padCode.includes(ac))) return true;
        const agencyName = (l.launch_service_provider?.name || '').toLowerCase();
        if (selected === 'USA' && (agencyName.includes('spacex') || agencyName.includes('nasa') || agencyName.includes('rocket lab') || agencyName.includes('united launch') || agencyName.includes('blue origin'))) return true;
        if (selected === 'CHN' && (agencyName.includes('casc') || agencyName.includes('china') || agencyName.includes('galactic energy') || agencyName.includes('landspace') || agencyName.includes('icefire'))) return true;
        if (selected === 'RUS' && (agencyName.includes('roscosmos') || agencyName.includes('russian'))) return true;
        if (selected === 'IND' && agencyName.includes('isro')) return true;
        if (selected === 'JPN' && (agencyName.includes('jaxa') || agencyName.includes('mitsubishi') || agencyName.includes('space one'))) return true;
        if (selected === 'EUR' && (agencyName.includes('ariane') || agencyName.includes('esa') || agencyName.includes('avio'))) return true;
        if (selected === 'NZL' && agencyName.includes('rocket lab')) return true;
        return false;
      }).length;
      setCountryHistory([...rows, { year: 2026, count: count2026 }]);
    })
    .catch(() => setCountryHistory(rows))
    .finally(() => setHistoryLoading(false));
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

    <div className="ssp-history">
      <div className="ssp-agencies-label">LAUNCHES OVER TIME</div>
      {historyLoading ? (
  <div className="ssp-history-loading">Loading chart data...</div>
) : countryHistory.length > 0 ? (
  <ResponsiveContainer width="100%" height={160}>
          <LineChart data={countryHistory} margin={{ left: -20, right: 12, top: 4, bottom: 0 }}>
            <XAxis
              dataKey="year"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#020D1F',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                fontSize: 13,
              }}
              labelFormatter={y => `${y}`}
              formatter={v => [v, 'Launches']}
              cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={selectedCountry.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: selectedCountry.color }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="ssp-history-loading">No historical data</div>
      )}
    </div>


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
