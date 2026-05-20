import React, { useState, useEffect, useRef} from 'react';
import { getPreviousLaunches } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './Archive.css';

const STATUS_FILTERS = ['All', 'Success', 'Failure'];
const LIMIT = 20;

export default function Archive() {
  const [launches, setLaunches]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('All');
  const [company, setCompany]         = useState('');
  const [year, setYear]               = useState('');
  const [availableYears, setAvailableYears] = useState(() => {
  // Initialize immediately with last 20 years so dropdown always works
  const now = new Date().getFullYear();
  return Array.from({ length: 20 }, (_, i) => now - i);
});

useEffect(() => {
  fetch('https://ll.thespacedevs.com/2.2.0/launch/previous/?limit=1&ordering=net&mode=list')
    .then(r => r.json())
    .then(data => {
      if (data.results?.[0]?.net) {
        const oldest = new Date(data.results[0].net).getFullYear();
        const newest = new Date().getFullYear();
        setAvailableYears(
          Array.from({ length: newest - oldest + 1 }, (_, i) => newest - i)
        );
      }
    })
    .catch(() => {}); // fallback already set in useState initializer
}, []);
  
  const [expanded, setExpanded]       = useState(null);
  const [view, setView]               = useState('grid');
  const offsetRef   = useRef(0);
  const searchTimer = useRef(null);
  const navigate = useNavigate();

  function fetchLaunches(reset = false, searchArg = search, statusArg = statusFilter, companyArg = company, yearArg = year) {
  const offset = reset ? 0 : offsetRef.current;
  setError(null);
  if (reset) {
    setLoading(true);
    setLoadingMore(false);
  } else {
    setLoadingMore(true);
  }

  /*const statusParam =
  statusArg === 'Success'
    ? '&status=3'
    : statusArg === 'Failure'
    ? '&status=4'
    : '';*/

    const STATUS_MAP = {
  Success: 3,
  Failure: 4,
};

const statusParam = STATUS_MAP[statusArg]
  ? `&status=${STATUS_MAP[statusArg]}`
  : '';


  const searchParam  = searchArg  ? `&search=${encodeURIComponent(searchArg)}` : '';
  const companyParam = companyArg ? `&lsp__name=${encodeURIComponent(companyArg)}` : '';
  const yearParam    = yearArg    ? `&net__gte=${yearArg}-01-01&net__lte=${yearArg}-12-31` : '';

  getPreviousLaunches(LIMIT, offset, statusParam + searchParam + companyParam + yearParam)
    .then(data => {
      setLaunches(prev => reset ? data.results : [...prev, ...data.results]);
      setTotal(data.count);
      offsetRef.current = offset + LIMIT;
      setLoading(false);
      setLoadingMore(false);
    })
    .catch(err => {
      setError(err.message || 'Failed to load launches');
      setLoading(false);
      setLoadingMore(false);
    });
}

  useEffect(() => { fetchLaunches(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search handlers — no auto-fire on keystroke
  function handleSearch(val) {
    setSearch(val);
    setExpanded(null);
  }

  function executeSearch() {
    clearTimeout(searchTimer.current);
    offsetRef.current = 0;
    fetchLaunches(true, search, statusFilter, company, year);
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') executeSearch();
  }

  // Filter handlers — fire immediately on selection
  function handleStatus(val) {
    setStatus(val);
    setExpanded(null);
    offsetRef.current = 0;
    fetchLaunches(true, search, val, company, year);
  }

  function handleCompany(val) {
    setCompany(val);
    setExpanded(null);
    offsetRef.current = 0;
    fetchLaunches(true, search, statusFilter, val, year);
  }

  function handleYear(val) {
    setYear(val);
    setExpanded(null);
    offsetRef.current = 0;
    fetchLaunches(true, search, statusFilter, company, val);
  }

  function clearSecondaryFilters() {
    setCompany('');
    setYear('');
    offsetRef.current = 0;
    fetchLaunches(true, search, statusFilter, '', '');
  }

  if (loading) return <div className="page-state">Loading launch history...</div>;
  if (error)   return <div className="page-state error">⚠ {error}</div>;

  return (
    <div className="archive">

      {/* PRIMARY FILTER BAR — search + status + view toggle */}
      <div className="filter-bar">
        <div className="search-wrap">
          <input
            className="search-input"
            type="text"
            placeholder="Search missions, rockets, agencies..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button className="search-btn" onClick={executeSearch}>
            Search
          </button>
        </div>

        <div className="filter-pills">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              className={`pill ${statusFilter === f ? 'active' : ''}`}
              onClick={() => handleStatus(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="view-toggle">
          <button
            className={`view-btn ${view === 'grid' ? 'active' : ''}`}
            onClick={() => setView('grid')}
            title="Grid view"
          >⊞</button>
          <button
            className={`view-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
            title="List view"
          >≡</button>
        </div>
      </div>

      {/* SECONDARY FILTERS — company + year */}
      <div className="filter-row-2">
        <select
          className="filter-select"
          value={company}
          onChange={e => handleCompany(e.target.value)}
        >
          <option value="">All Companies</option>
          <option value="SpaceX">SpaceX</option>
          <option value="Rocket Lab">Rocket Lab</option>
          <option value="United Launch Alliance">ULA</option>
          <option value="Roscosmos State Corporation">Roscosmos</option>
          <option value="Arianespace">Arianespace</option>
          <option value="Indian Space Research Organization">ISRO</option>
          <option value="Japan Aerospace Exploration Agency">JAXA</option>
          <option value="China Aerospace Science and Technology Corporation">CASC</option>
          <option value="Blue Origin">Blue Origin</option>
          <option value="Northrop Grumman">Northrop Grumman</option>
        </select>

        <select
          className="filter-select"
          value={year}
          onChange={e => handleYear(e.target.value)}
        >
          <option value="">All Years</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {(company || year) && (
          <button className="clear-btn" onClick={clearSecondaryFilters}>
            Clear filters ✕
          </button>
        )}
      </div>

      {/* RESULT COUNT */}
      <div className="result-count">
        {total.toLocaleString()} launches
        {(search || statusFilter !== 'All' || company || year) ? ' (filtered)' : ''}
      </div>

      {/* LAUNCH GRID / LIST */}
      <div className={`launches-${view}`}>
        {launches.map(launch => (
        <ArchiveCard
          key={launch.id}
          launch={launch}
          expanded={expanded === launch.id}
          onToggle={() => setExpanded(expanded === launch.id ? null : launch.id)}
          view={view}
          onAgencyClick={() => navigate('/space-race')}
        />
      ))}
      </div>

      {/* LOAD MORE */}
      {offsetRef.current < total && (
        <div className="load-more-wrap">
          <button
            className="load-more-btn"
            onClick={() => fetchLaunches(false)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more launches'}
          </button>
        </div>
      )}
    </div>
  );
}

function ArchiveCard({ launch, expanded, onToggle, view, onAgencyClick }) {
  const agency    = launch.launch_service_provider;
  const mission   = launch.mission;
  const isSuccess = launch.status?.name?.toLowerCase().includes('success');
  const isFail    = launch.status?.name?.toLowerCase().includes('fail');

  const date = new Date(launch.net).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  });

  return (
    <div
      className={`arc-card ${expanded ? 'expanded' : ''} ${view}`}
      onClick={onToggle}
    >
      <div className="arc-main">
        <div className="arc-left">
          <div className="arc-header">
            <span className="arc-mission">{launch.name}</span>
            <span className={`arc-badge ${isSuccess ? 'success' : isFail ? 'fail' : 'unknown'}`}>
              {isSuccess ? '✓ Success' : isFail ? '✗ Failure' : launch.status?.name || 'Unknown'}
            </span>
          </div>

          <div className="arc-meta">
            <span
              className="arc-agency-link"
              onClick={e => { e.stopPropagation(); onAgencyClick(); }}
            >
              {agency?.name}
            </span>
            <span className="sep">·</span>
            <span>{launch.rocket?.configuration?.name}</span>
            <span className="sep">·</span>
            <span>{launch.pad?.location?.name}</span>
          </div>

          <div className="arc-date">{date}</div>

          <div className="arc-tags">
            {mission?.orbit?.name && <span className="tag">{mission.orbit.name}</span>}
            {mission?.type        && <span className="tag">{mission.type}</span>}
            {launch.rocket?.configuration?.reusable && <span className="tag">Reusable</span>}
          </div>
        </div>

        <div className="arc-arrow">{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div className="arc-detail" onClick={e => e.stopPropagation()}>
          <div className="detail-grid">
            <DetailStat label="Orbit"        value={mission?.orbit?.name || '—'} />
            <DetailStat label="Mission type" value={mission?.type || '—'} />
            <DetailStat label="Launch site"  value={launch.pad?.name || '—'} />
            <DetailStat label="Rocket"       value={launch.rocket?.configuration?.full_name || '—'} />
          </div>

          {mission?.description && (
            <p className="detail-desc">{mission.description}</p>
          )}

          {isFail && (
            <div className="detail-failure">
              <span className="fail-label">WHAT WENT WRONG</span>
              <p>{launch.failreason || 'Failure reason not recorded in the API for this mission.'}</p>
            </div>
          )}

          <div className="detail-links">
            {agency?.website && (
              <a href={agency.website} target="_blank" rel="noreferrer" className="detail-link">
                {agency.name} website ↗
              </a>
            )}
            {launch.vid_urls?.[0]?.url && (
              <a href={launch.vid_urls[0].url} target="_blank" rel="noreferrer" className="detail-link">
                Watch launch ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="detail-stat">
      <span className="ds-label">{label}</span>
      <span className="ds-value">{value}</span>
    </div>
  );
}
