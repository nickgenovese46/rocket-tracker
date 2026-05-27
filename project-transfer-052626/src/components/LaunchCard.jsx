import React from 'react';
import './LaunchCard.css';

export default function LaunchCard({ launch, featured, onDetails }) {
  const agency  = launch.launch_service_provider;
  const timeStr = new Date(launch.net).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  });

  const daysUntil = Math.ceil(
    (new Date(launch.net) - new Date()) / (1000 * 60 * 60 * 24)
  );

  const streamUrl = launch.vid_urls?.[0]?.url;

  return (
    <div className={`launch-card ${featured ? 'featured' : ''}`}>
      <div className="lc-badge">
        {featured ? '▶ NEXT UP' : `T-${daysUntil}d`}
      </div>

      <div className="lc-mission">{launch.name}</div>
      <div className="lc-rocket">{launch.rocket?.configuration?.name}</div>

      <div className="lc-divider" />

      <div className="lc-row">
        <span className="lc-site">{launch.pad?.location?.name}</span>
        <span className="lc-time">{timeStr}</span>
      </div>

      <div className="lc-agency">
        {agency?.website ? (
          <a href={agency.website} target="_blank" rel="noreferrer" className="agency-name-link">
            {agency.name} ↗
          </a>
        ) : (
          <span>{agency?.name}</span>
        )}
      </div>

      <div className="lc-footer">
        {featured && streamUrl ? (
          <a href={streamUrl} target="_blank" rel="noreferrer" className="lc-btn primary">
            ▶ Watch Live
          </a>
        ) : (
          <button className="lc-btn secondary" onClick={() => onDetails && onDetails(launch)}>
            Details →
            </button>
        )}
      </div>
    </div>
  );
}