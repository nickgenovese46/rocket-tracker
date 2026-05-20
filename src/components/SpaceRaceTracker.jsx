import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getAgencies } from '../services/api';
import './SpaceRaceTracker.css';

const COLORS = ['#3B82F6','#10D9A8','#F59E0B','#6D5FD8','#EF4444','#60A5FA'];

const STAT_CARDS = [
  { label: 'LAUNCHES IN 2026', value: '88',  color: 'var(--text-primary)' },
  { label: 'SUCCESS RATE',     value: '94%', color: 'var(--teal)'         },
  { label: 'TOTAL PAYLOAD',    value: '312t', color: 'var(--amber)'       },
  { label: 'OBJECTS IN ORBIT', value: '9,800+', color: 'var(--purple)'   },
];

export default function SpaceRaceTracker() {
  const [agencies, setAgencies] = useState([]);

  useEffect(() => {
    getAgencies()
      .then(data => {
        const chartData = data
          .filter(a => a.launch_library_url)
          .map(a => ({
            name:       a.abbrev || a.name,
            launches:   a.total_launch_count || 0,
            website:    a.website,
          }))
          .sort((a, b) => b.launches - a.launches)
          .slice(0, 6);
        setAgencies(chartData);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
  // Always clear agency cache on mount so SpaceRaceTracker 
  // reflects the latest launch counts
  try { sessionStorage.removeItem('agencies'); } catch(e) {}
  getAgencies()
    .then(data => {
      const chartData = data
        .filter(a => a.launch_library_url)
        .map(a => ({
          name:       a.abbrev || a.name,
          launches:   a.total_launch_count || 0,
          website:    a.website,
        }))
        .sort((a, b) => b.launches - a.launches)
        .slice(0, 6);
      setAgencies(chartData);
    })
    .catch(() => {});
}, []);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <div className="tt-name">{d.name}</div>
        <div className="tt-val">{d.launches} total launches</div>
        {d.website && (
          <a href={d.website} target="_blank" rel="noreferrer" className="tt-link">
            Visit website ↗
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="space-race">
      {/* STAT CARDS */}
      <div className="stat-cards">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="stat-card">
            <span className="stat-val" style={{ color: s.color }}>{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* BAR CHART */}
      {agencies.length > 0 && (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agencies} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={52}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="launches" radius={[0, 4, 4, 0]} barSize={14}>
                {agencies.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}