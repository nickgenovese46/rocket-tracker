import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getUpcomingLaunches} from '../services/api';
import Countdown from '../components/Countdown';
import LaunchCard from '../components/LaunchCard';
import SpaceRaceTracker from '../components/SpaceRaceTracker.jsx';
import StarField from '../components/StarField';
import './Home.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Home() {
  const [launches, setLaunches]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [modalLaunch, setModalLaunch] = useState(null);
  const [streamOpen, setStreamOpen]   = useState(false);
  const [notifyEnabled, setNotifyEnabled]   = useState(false);
    const notifyTimers  = useRef([]);
    const statusPollRef = useRef(null);
    const [showNotifyModal, setShowNotifyModal]   = useState(false);
const [notifyContact, setNotifyContact]       = useState('');
const [notifyType, setNotifyType]             = useState('email');
const [notifySubmitted, setNotifySubmitted]   = useState(false);
const [notifySubmitting, setNotifySubmitting] = useState(false);
const [notifyError, setNotifyError]           = useState('');

  useEffect(() => {
    const fetchLaunches = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getUpcomingLaunches();
        setLaunches(data);
      } catch (err) {
        setError(err?.message || 'Failed to load launch data');
      } finally {
        setLoading(false);
      }
    };
    fetchLaunches();
  }, []);

useEffect(() => {
  const refresh = () => {
    // Clear all time-sensitive cache keys
    ['upcoming_launches', 'agencies', 'active_launches'].forEach(key => {
      try { sessionStorage.removeItem(key); } catch(e) {}
    });
    getUpcomingLaunches()
      .then(data => setLaunches(data))
      .catch(() => {});
  };

  // Refresh every 5 minutes
  const interval = setInterval(refresh, 5 * 60 * 1000);

  // Also refresh when user returns to the tab after being away
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, []);

  const nextLaunch  = useMemo(() => launches[0], [launches]);
  const upcoming    = useMemo(() => launches.slice(1, 4), [launches]);
  const isLive     = nextLaunch?.status?.name === 'In Flight';
  const streamUrl  = nextLaunch?.vid_urls?.[0]?.url;
  const provider   = nextLaunch?.launch_service_provider;
  const pad        = nextLaunch?.pad;
  const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

async function submitNotification() {
  const contact = notifyContact.trim();
  if (notifyType === 'email' && !EMAIL_RE.test(contact)) {
    setNotifyError('Enter a valid email address.');
    return;
  }
  if (notifyType === 'sms' && !PHONE_RE.test(contact.replace(/[\s\-().]/g, ''))) {
    setNotifyError('Enter a valid phone number (e.g. +1 555 000 0000).');
    return;
  }

  setNotifySubmitting(true);
  setNotifyError('');

  try {
    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact,
        type: notifyType,
        launchId: nextLaunch.id,
        launchName: nextLaunch.name,
        launchNet: nextLaunch.net,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Subscription failed');

    setNotifySubmitted(true);
    setNotifyEnabled(true);
    scheduleNotifications(nextLaunch);
  } catch(e) {
    setNotifyError(e.message || 'Subscription failed. Please try again.');
  } finally {
    setNotifySubmitting(false);
  }
}

function scheduleNotifications(launch) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Clear any existing timers
  notifyTimers.current.forEach(t => clearTimeout(t));
  notifyTimers.current = [];
  if (statusPollRef.current) {
    clearInterval(statusPollRef.current);
    statusPollRef.current = null;
  }

  const launchTime = new Date(launch.net).getTime();
  const now        = Date.now();

  // T-1 hour
  const msToOneHour = launchTime - 60 * 60 * 1000 - now;
  if (msToOneHour > 0) {
    notifyTimers.current.push(setTimeout(() => {
      new Notification('ORBIT — Launch in 1 Hour', {
        body: `${launch.name} launches in approximately 1 hour.`,
        icon: '/favicon.ico',
      });
    }, msToOneHour));
  }

  // T-1 minute
  const msToOneMin = launchTime - 60 * 1000 - now;
  if (msToOneMin > 0) {
    notifyTimers.current.push(setTimeout(() => {
      new Notification('ORBIT — T-Minus 1 Minute', {
        body: `${launch.name} is launching in approximately 1 minute!`,
        icon: '/favicon.ico',
      });
    }, msToOneMin));
  }

  // After launch NET + 5 min: start polling for success/failure
  const msToPostLaunch = launchTime - now + 5 * 60 * 1000;
  const startPoll = () => {
    if (statusPollRef.current) return;
    let attempts = 0;
    statusPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 24) { // poll for up to 12 minutes
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
        return;
      }
      try {
        const res  = await fetch('/api/previous?limit=5&offset=0');
        const data = await res.json();
        const result = data.results?.find(l => l.id === launch.id);
        if (result) {
          clearInterval(statusPollRef.current);
          statusPollRef.current = null;
          const isSuccess = result.status?.name?.toLowerCase().includes('success');
          new Notification(`ORBIT — ${launch.name}`, {
            body: isSuccess
              ? '🎉 Launch successful! Open ORBIT for details.'
              : '💥 Launch failed. Open ORBIT for details.',
            icon: '/favicon.ico',
          });
        }
      } catch(e) {}
    }, 30 * 1000);
  };

  if (msToPostLaunch > 0) {
    notifyTimers.current.push(setTimeout(startPoll, msToPostLaunch));
  } else if (Date.now() - launchTime < 30 * 60 * 1000) {
    startPoll(); // already past launch, still within window
  }
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    notifyTimers.current.forEach(t => clearTimeout(t));
    if (statusPollRef.current) clearInterval(statusPollRef.current);
  };
}, []);

// Reschedule if launch changes
useEffect(() => {
  if (notifyEnabled && nextLaunch) scheduleNotifications(nextLaunch);
}, [nextLaunch, notifyEnabled]);

  if (loading) return <div className="page-state">Fetching launch data...</div>;
  if (error)   return (
    <div className="page-state error">
      ⚠ {error}
      <button onClick={() => window.location.reload()} className="retry-btn">Try Again</button>
    </div>
  );
  if (!nextLaunch) return <div className="page-state">No upcoming launches found</div>;

  return (
    <div className="home">

      {/* HERO */}
<section className="hero">
  <div className="hero-star-wrap">
    <StarField />

    <div className="hero-body">
      {/* TOP */}
      <div className="hero-top">
        <span className="hero-eyebrow">
          {isLive ? '🔴 LIVE NOW' : 'NEXT LAUNCH'}
        </span>
        <h1 className="hero-title">{nextLaunch.name}</h1>
        <p className="hero-sub">
          {nextLaunch.rocket?.configuration?.name}
          <span className="dot-sep">·</span>
          {provider?.name}
          {provider?.website && (
            <a href={provider.website} target="_blank" rel="noopener noreferrer"
              className="agency-link" aria-label={`Visit ${provider.name} website`}>↗</a>
          )}
        </p>
      </div>

      {/* BOTTOM */}
      <div className="hero-bottom">
        <div className="hero-left">
          <Countdown launchTime={nextLaunch.net} />
          <div className="hero-meta">
            📍 {pad?.name || 'Unknown location'}
            <span className="dot-sep">·</span>
            {new Date(nextLaunch.net).toLocaleString('en-US', {
              timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short',
            })} UTC
          </div>
          <div className="hero-details">
            <div className="hd-grid">
              <HeroStat label="Launch Site"  value={pad?.name} />
              <HeroStat label="Location"     value={pad?.location?.name} />
              <HeroStat label="Status"       value={nextLaunch.status?.name} />
              <HeroStat label="Orbit"        value={nextLaunch.mission?.orbit?.name || '—'} />
              <HeroStat label="Mission Type" value={nextLaunch.mission?.type || '—'} />
              <HeroStat label="Vehicle"      value={nextLaunch.rocket?.configuration?.full_name || nextLaunch.rocket?.configuration?.name} />
            </div>
            {nextLaunch.mission?.description && (
              <div className="hd-desc">{nextLaunch.mission.description}</div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="hero-right">
          {streamUrl && streamOpen ? (
            <div className="stream-panel">
              <iframe
                src={streamUrl.includes('youtube') || streamUrl.includes('youtu.be')
                  ? streamUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
                  : streamUrl}
                title={`Live stream — ${nextLaunch.name}`}
                allowFullScreen className="stream-frame" loading="lazy"
              />
              <button className="stream-close-btn" onClick={() => setStreamOpen(false)}>
                ✕ Close Stream
              </button>
            </div>
          ) : (
            <div className="standby-panel">
              <div className="standby-scanlines" />
              <div className="standby-inner">
                <div className="standby-signal">
                  <span className="standby-dot" />
                  <span className="standby-dot" />
                  <span className="standby-dot" />
                </div>
                <div className="standby-label">STANDBY</div>
                <div className="standby-mission">{nextLaunch.name}</div>
                <div className="standby-sub">
                  {streamUrl ? 'Live stream available' : 'Live stream not yet available'}
                </div>
                {streamUrl && (
                  <button className="standby-watch-btn" onClick={() => setStreamOpen(true)}>
                    ▶ Watch Live
                  </button>
                )}
                {!streamUrl && (
                  <div className="standby-incoming">Stream goes live closer to launch</div>
                )}
              </div>
            </div>
          )}

          <div className="hero-action-row">
            <button
              className={`notify-btn ${notifyEnabled ? 'active' : ''}`}
              onClick={() => {
                if (notifyEnabled) {
                  notifyTimers.current.forEach(t => clearTimeout(t));
                  if (statusPollRef.current) {
                    clearInterval(statusPollRef.current);
                    statusPollRef.current = null;
                  }
                  setNotifyEnabled(false);
                  setNotifySubmitted(false);
                  setNotifyContact('');
                } else {
                  setNotifyError('');
                  setShowNotifyModal(true);
                }
              }}
            >
              {notifyEnabled ? '🔔 Notifications On — Click to Cancel' : '🔔 Notify Me Before Launch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* UPCOMING LAUNCHES */}
      <section className="section">
        <div className="section-header">
          <span className="section-label">UPCOMING LAUNCHES</span>
            <span className="section-sub">Next 3 after the featured mission</span>      
        </div>
        <div className="cards-row">
            {upcoming.map((launch, index) => (
                <LaunchCard
                key={launch.id || index}
                launch={launch}
                featured={false}
                onDetails={setModalLaunch}
                />
            ))}
            </div>
      </section>

      {/* SPACE RACE TRACKER */}
      <section className="section">
        <div className="section-header">
          <span className="section-label">LAUNCH ACTIVITY TRACKER</span>
          <span className="section-sub">2026 launches to date</span>
        </div>
        <SpaceRaceTracker />
      </section>

      {/* DETAILS MODAL */}
      {modalLaunch && (
        <div className="modal-overlay" onClick={() => setModalLaunch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalLaunch(null)}>✕</button>
            <div className="modal-eyebrow">LAUNCH DETAILS</div>
            <h2 className="modal-title">{modalLaunch.name}</h2>
            <p className="modal-sub">
              {modalLaunch.rocket?.configuration?.name}
              <span className="dot-sep">·</span>
              {modalLaunch.launch_service_provider?.name}
            </p>
            <div className="modal-grid">
              <ModalStat label="Launch site"  value={modalLaunch.pad?.name} />
              <ModalStat label="Location"     value={modalLaunch.pad?.location?.name} />
              <ModalStat label="NET"          value={new Date(modalLaunch.net).toUTCString()} />
              <ModalStat label="Status"       value={modalLaunch.status?.name} />
              <ModalStat label="Orbit"        value={modalLaunch.mission?.orbit?.name || '—'} />
              <ModalStat label="Mission type" value={modalLaunch.mission?.type || '—'} />
            </div>
            {modalLaunch.mission?.description && (
              <p className="modal-desc">{modalLaunch.mission.description}</p>
            )}
            <div className="modal-links">
              {modalLaunch.launch_service_provider?.website && (
                <a href={modalLaunch.launch_service_provider.website}
                  target="_blank" rel="noreferrer" className="modal-link">
                  {modalLaunch.launch_service_provider.name} website ↗
                </a>
              )}
              {modalLaunch.vid_urls?.[0]?.url && (
                <a href={modalLaunch.vid_urls[0].url}
                  target="_blank" rel="noreferrer" className="modal-link">
                  Watch live stream ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
        {showNotifyModal && (
  <div className="modal-overlay" onClick={() => setShowNotifyModal(false)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setShowNotifyModal(false)}>✕</button>

      <div className="modal-eyebrow">LAUNCH NOTIFICATIONS</div>
      <h2 className="modal-title">Notify me for this launch</h2>
      <p className="modal-sub" style={{ display: 'block', marginBottom: 24 }}>
        {nextLaunch.name}
      </p>

      {notifySubmitted ? (
        <div className="notify-confirm">
          <div className="nc-icon">🔔</div>
          <div className="nc-title">You're subscribed</div>
          <div className="nc-body">
            We'll send you a message at T-1 minute before launch and again
            once the outcome is confirmed.
          </div>
          <div className="nc-contact">{notifyContact}</div>
        </div>
      ) : (
        <>
          <div className="notify-type-row">
            <button
              className={`notify-type-btn ${notifyType === 'email' ? 'active' : ''}`}
              onClick={() => setNotifyType('email')}
            >
              ✉ Email
            </button>
            <button
              className={`notify-type-btn ${notifyType === 'sms' ? 'active' : ''}`}
              onClick={() => setNotifyType('sms')}
            >
              📱 SMS
            </button>
          </div>

          <input
            className="search-input"
            style={{ width: '100%', marginBottom: 12 }}
            type={notifyType === 'email' ? 'email' : 'tel'}
            placeholder={notifyType === 'email' ? 'your@email.com' : '+1 (555) 000-0000'}
            value={notifyContact}
            onChange={e => {
              setNotifyContact(e.target.value);
              setNotifyError('');
            }}
          />
          {notifyError && <div className="notify-error">{notifyError}</div>}

          <div className="notify-what">
            <div className="nw-title">YOU WILL RECEIVE</div>
            <div className="nw-item">⏱ T-1 minute alert with a link to the live stream</div>
            <div className="nw-item">🎯 Launch outcome — success or failure with details</div>
          </div>

          <div className="notify-disclaimer">
            Notifications are for this launch only and will not be used for marketing.
            Email delivery is powered by Resend and subscription storage by Supabase.
          </div>

          <button
            className="next-btn"
            style={{ width: '100%', marginTop: 16 }}
            disabled={!notifyContact || notifySubmitting}
            onClick={submitNotification}
          >
            {notifySubmitting ? 'Subscribing...' : `Subscribe to ${notifyType} notifications`}
          </button>
        </>
      )}
    </div>
  </div>
)}
    </div>
  );
}

function ModalStat({ label, value }) {
  return (
    <div className="modal-stat">
      <span className="ms-label">{label}</span>
      <span className="ms-value">{value || '—'}</span>
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="hero-stat">
      <span className="hs-label">{label}</span>
      <span className="hs-value">{value || '—'}</span>
    </div>
  );
}
