import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

// ── Help drawer data ────────────────────────────────────────────────────────
const PAGES = [
  {
    icon: '🛰️',
    name: 'Mission Control',
    route: '/',
    color: '#e8a030',
    summary: 'Live tracker for upcoming launches',
    tips: [
      'The top card is always the next scheduled launch — countdown is live',
      'The 3 cards below show what\'s queued after that',
      'Data auto-refreshes every 5 min and whenever you switch back to this tab',
      'Click "Notify Me" to get an email 1 hour before launch',
      'Choose This launch only or All future launches when subscribing',
    ],
  },
  {
    icon: '📡',
    name: 'Launch Archive',
    route: '/archive',
    color: '#5b8dee',
    summary: 'Search every rocket launch ever recorded',
    tips: [
      'Search by mission name, rocket, or agency — press Enter or the search button',
      'Filter by status: Success or Failure',
      'Use the company and year dropdowns to narrow results further',
      'Filters apply server-side so results are accurate, not just visual',
    ],
  },
  {
    icon: '🌍',
    name: 'Space Race',
    route: '/space-race',
    color: '#3dbe8a',
    summary: 'A map of spaceflight history by country',
    tips: [
      'Click any country on the map to load its stats',
      'The 5 tabs show: Total launches, Successful, Success Rate, Upcoming, and Agencies',
      'The timeline chart always starts from 1950 regardless of when a country began launching',
      '2026 data is appended live — the chart is up to date',
    ],
  },
  {
    icon: '🔧',
    name: 'Rocket Builder',
    route: '/builder',
    color: '#c46aff',
    summary: 'Design a mission and check if it\'s physically possible',
    tips: [
      '5 steps: Destination → Payload → Rocket Body → Fuel → Configuration',
      'The Tsiolkovsky rocket equation runs in real time as you build',
      'Success probability ranges from 2–99% based on your choices',
      'After launch: edit your rocket, try again, copy the summary, or Browse Real Missions to see how real rockets compare',
    ],
  },
];

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(() => {
  return !localStorage.getItem('orbit-help-seen');
});
  const [activePage, setActivePage] = useState(0);

  const page = PAGES[activePage];

  return (
    <>
      <nav className="navbar">
        <NavLink to="/" className="navbar-logo">ORBIT</NavLink>
        <div className="navbar-links">
          <NavLink to="/"           end       className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Mission Control</NavLink>
          <NavLink to="/archive"              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Archive</NavLink>
          <NavLink to="/space-race"           className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Space Race</NavLink>
          <NavLink to="/builder"              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Rocket Builder</NavLink>
        </div>
        <div className="navbar-right">
          <div className="navbar-live">
            <span className="live-dot" />
            <span className="live-text">LIVE</span>
          </div>
          {/* Help button */}
          <button
            className="help-btn"
            onClick={() => setDrawerOpen(o => !o)}
            title="How to use ORBIT"
          >
            ?
          </button>
        </div>
      </nav>

      {/* Help drawer */}
      {drawerOpen && (
        <div className="help-drawer">
          <div className="help-drawer-header">
            <div>
              <div className="help-drawer-title">How to use ORBIT</div>
              <div className="help-drawer-sub">Select a page below</div>
            </div>
            <button className="help-drawer-close" onClick={() => {
              localStorage.setItem('orbit-help-seen', 'true');
              setDrawerOpen(false);
            }}>✕</button>
          </div>

          <div className="help-drawer-tabs">
            {PAGES.map((p, i) => (
              <button
                key={p.name}
                className={`help-tab ${activePage === i ? 'active' : ''}`}
                onClick={() => setActivePage(i)}
              >
                <span className="help-tab-icon">{p.icon}</span>
                <div className="help-tab-text">
                  <div className="help-tab-name">{p.name}</div>
                  <div className="help-tab-route">{p.route}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="help-drawer-body">
            <div className="help-panel" style={{ borderColor: page.color + '44' }}>
              <div className="help-panel-label" style={{ color: page.color }}>
                {page.icon} {page.name.toUpperCase()}
              </div>
              <div className="help-panel-summary">{page.summary}</div>
              <div className="help-panel-tips">
                {page.tips.map((tip, i) => (
                  <div key={i} className="help-tip">
                    <div className="help-tip-num" style={{ background: page.color + '22', borderColor: page.color + '55', color: page.color }}>
                      {i + 1}
                    </div>
                    <div className="help-tip-text">{tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
