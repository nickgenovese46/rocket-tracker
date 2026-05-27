import React, { useState, useMemo} from 'react';
import { useNavigate } from 'react-router-dom';
import './RocketBuilder.css';

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const ROCKETS = [
  {
    id: 'light', name: 'Light', example: 'Electron / Rocket Lab',
    maxPayload: 5, dryMass: 1.0, wetMass: 13, thrust: 162,
    icon: '🚀', baseCost: 8,
    description: 'Small, agile. Best for lightweight payloads to LEO.',
  },
  {
    id: 'medium', name: 'Medium', example: 'Falcon 9 / SpaceX',
    maxPayload: 22, dryMass: 22, wetMass: 550, thrust: 7607,
    icon: '🛸', baseCost: 67,
    description: 'The workhorse. Handles most commercial and government missions.',
  },
  {
    id: 'heavy', name: 'Heavy', example: 'Falcon Heavy / SpaceX',
    maxPayload: 70, dryMass: 65, wetMass: 1420, thrust: 22819,
    icon: '⭐', baseCost: 150,
    description: 'Maximum lift capacity. Required for deep space missions.',
  },
];

const FUELS = [
  { id: 'rp1',     name: 'RP-1 / LOX',      label: 'Kerosene',        isp: 311, costPerTonne: 0.015, color: '#F59E0B', description: 'Most common fuel. Reliable, dense, and well understood.' },
  { id: 'lh2',     name: 'LH2 / LOX',        label: 'Liquid Hydrogen', isp: 450, costPerTonne: 0.040, color: '#3B82F6', description: 'Highest efficiency. Bulky tanks, harder to handle.' },
  { id: 'solid',   name: 'Solid Propellant',  label: 'Solid Fuel',      isp: 270, costPerTonne: 0.008, color: '#EF4444', description: 'Simple and storable. Once ignited, cannot throttle or stop.' },
  { id: 'methane', name: 'Methane / LOX',      label: 'Methane',         isp: 380, costPerTonne: 0.018, color: '#10D9A8', description: 'Next-gen fuel. Efficient, reusable-friendly, used by Starship.' },
];

// availableYears is managed inside the RocketBuilder component (hooks cannot be used at module scope)

const PAYLOADS = [
  { id: 'crew',        name: 'Crew Mission',       icon: '👨‍🚀', mass: 10.4, desc: 'Astronauts + crew capsule. Dragon or Orion class.',            realWorld: 'Similar to SpaceX Crew Dragon' },
  { id: 'resupply',    name: 'Resupply Cargo',      icon: '📦',  mass: 3.2,  desc: 'Station resupply. Food, equipment, experiments.',             realWorld: 'Similar to Cygnus cargo freighter' },
  { id: 'smallsat',   name: 'Small Satellite',      icon: '🛰️', mass: 0.3,  desc: 'CubeSat or microsatellite. Communications or Earth observation.', realWorld: 'Similar to a Planet Labs Dove' },
  { id: 'comms',       name: 'Comms Satellite',      icon: '📡',  mass: 5.5,  desc: 'Geostationary communications relay.',                         realWorld: 'Similar to Intelsat class satellite' },
  { id: 'observation', name: 'Earth Observation',    icon: '🌍',  mass: 8.0,  desc: 'High-resolution imaging satellite.',                          realWorld: 'Similar to WorldView-4' },
  { id: 'telescope',   name: 'Space Telescope',      icon: '🔭',  mass: 11.1, desc: 'Large space observatory. Maximum mass payload.',              realWorld: 'Similar to Hubble Space Telescope (11.1t)' },
];

const STAGES = [
  { id: 1, label: '1 Stage',  multiplier: 1.0, cost: 0,  desc: 'Simple. Single burn, all hardware stays attached.' },
  { id: 2, label: '2 Stages', multiplier: 1.7, cost: 10, desc: 'Standard. First stage separates after initial burn.' },
  { id: 3, label: '3 Stages', multiplier: 2.2, cost: 22, desc: 'Maximum range. Each stage separation sheds dead weight.' },
];

const NOZZLES = [
  {
    id: 'standard',
    label: 'Standard',
    ispBonus: 1.0,
    thrustFactor: 1.0,
    cost: 0,
    desc: 'Optimized for sea-level atmosphere. Best for first stage.',
  },
  {
    id: 'vacuum',
    label: 'Vacuum-Optimized',
    ispBonus: 1.18,
    thrustFactor: 1.0,
    cost: 4,
    desc: 'Expands exhaust fully in vacuum. +18% fuel efficiency for upper stages.',
  },
];

const DESTINATIONS = [
  { id: 'leo',  name: 'Low Earth Orbit', icon: '🌍', dv: 9.4,  baseBudget: 50,  budgetPerTonne: 9,  desc: '200–2,000 km altitude. ISS, Starlink, most satellites.' },
  { id: 'gto',  name: 'GTO / ISS',       icon: '🛰️', dv: 11.8, baseBudget: 90,  budgetPerTonne: 12, desc: 'Geostationary transfer or station rendezvous.' },
  { id: 'moon', name: 'The Moon',         icon: '🌙', dv: 13.7, baseBudget: 180, budgetPerTonne: 18, desc: '384,400 km away. Requires lunar transfer orbit.' },
  { id: 'mars', name: 'Mars',             icon: '🔴', dv: 17.4, baseBudget: 280, budgetPerTonne: 28, desc: '~225M km average. Trans-Mars injection burn.' },
];

const REUSABILITY = [
  { id: 'expendable', label: 'Expendable', massPenalty: 0.0,  costModifier: 1.0,  desc: 'Maximum performance. Hardware burns up on reentry.' },
  { id: 'reusable',   label: 'Reusable',   massPenalty: 0.15, costModifier: 0.65, desc: 'Landing legs and propellant reserves add 15% dry mass. Reduces rocket cost 35%.' },
];

const G0 = 9.80665;
const STEPS = ['Destination', 'Payload', 'Rocket Body', 'Fuel Type', 'Configuration'];



// ── PHYSICS ────────────────────────────────────────────────────────────────

// payloadTonnes is always a NUMBER here — callers extract .mass before passing
function calcPhysics(rocket, fuel, payloadTonnes, destination, stages, nozzle, reusability) {
  if (!rocket || !fuel || !destination || !stages || !nozzle || !reusability) return null;

  const reuseMassPenalty = rocket.dryMass * reusability.massPenalty;
  const mDry = rocket.dryMass + reuseMassPenalty + payloadTonnes;
  const mWet = rocket.wetMass;
  if (mDry >= mWet) return null;

  const effectiveIsp = fuel.isp * nozzle.ispBonus;
  const dvBase      = effectiveIsp * G0 * Math.log(mWet / mDry) / 1000;
  const dvAvailable = dvBase * stages.multiplier;
  const dvRequired  = destination.dv;

  // TWR uses first stage thrust only — no nozzle penalty since
  // vacuum nozzles are upper stage engines that don't fire at sea level
  const mLaunch = mWet + payloadTonnes;
  const twr = rocket.thrust / (mLaunch * G0);

  const margin = dvAvailable - dvRequired;

  const marginProb = margin >= 0
    ? Math.min(97, 58 + margin * 13)
    : Math.max(3,  50 + margin * 18);
  const twrMod = twr >= 1.5 ? 2 : twr >= 1.3 ? 0 : twr >= 1.1 ? -8 : -20;
  const successProb = Math.min(99, Math.max(2, Math.round(marginProb + twrMod)));

  return { dvAvailable, dvRequired, twr, margin, successProb, effectiveIsp };
}

function calcCost(rocket, fuel, payloadTonnes, stages, nozzle, reusability) {
  if (!rocket || !fuel || !stages || !nozzle || !reusability) return null;

  const rocketCost  = rocket.baseCost * reusability.costModifier;
  // propellant mass in tonnes × cost per tonne (no ×1000 — costPerTonne is M$/tonne)
  const fuelCost    = (rocket.wetMass - rocket.dryMass) * fuel.costPerTonne;
  const payloadCost = payloadTonnes * 3;   // $3M per tonne integration
  const stagingCost = stages.cost;
  const nozzleCost  = nozzle.cost;
  const total       = rocketCost + fuelCost + payloadCost + stagingCost + nozzleCost;

  return {
    total: Math.round(total),
    breakdown: {
      rocket:  Math.round(rocketCost),
      fuel:    Math.round(fuelCost),
      payload: Math.round(payloadCost),
      staging: Math.round(stagingCost),
      nozzle:  Math.round(nozzleCost),
    },
  };
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function RocketBuilder() {
  const [step, setStep]               = useState(0);
  const [rocket, setRocket]           = useState(null);
  const [fuel, setFuel]               = useState(null);
  const [payload, setPayload]         = useState(null); // full payload OBJECT
  const [destination, setDest]        = useState(null);
  const [stages, setStages]           = useState(STAGES[1]);
  const [nozzle, setNozzle]           = useState(NOZZLES[0]);
  const [reusability, setReuse]       = useState(REUSABILITY[0]);
  const [launched, setLaunched]       = useState(false);
  const [animating, setAnimating]     = useState(false);
  const [lastStep, setLastStep]       = useState(0);
  const [launchSuccess, setSuccess]   = useState(false);
  const [readoutTab, setReadoutTab]   = useState('mission');
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Always a number — safe to pass to physics/cost
  const payloadMass = payload?.mass || 0;

  const physics = useMemo(
    () => calcPhysics(rocket, fuel, payloadMass, destination, stages, nozzle, reusability),
    [rocket, fuel, payloadMass, destination, stages, nozzle, reusability]
  );

  const cost = useMemo(
    () => calcCost(rocket, fuel, payloadMass, stages, nozzle, reusability),
    [rocket, fuel, payloadMass, stages, nozzle, reusability]
  );

const budget = useMemo(() => {
  if (!destination) return null;
  return Math.round(destination.baseBudget + payloadMass * destination.budgetPerTonne);
}, [destination, payloadMass]);

const optimalMission = useMemo(() => {
  if (!launched || !destination || !payload || !budget) return null;
  return findOptimalMission(destination, payload, budget);
}, [launched, destination, payload, budget]);

  const allSelected = !!(rocket && fuel && payload && destination);

  function handleLaunch() {
    if (!physics) return;
    setLastStep(step);
    setAnimating(true);
    const succeeded = Math.random() * 100 < physics.successProb;
    setTimeout(() => {
      setAnimating(false);
      setLaunched(true);
      setSuccess(succeeded);
    }, 2200);
  }

  function handleReset() {
    setStep(0); setRocket(null); setFuel(null); setPayload(null);
    setDest(null); setStages(STAGES[1]); setNozzle(NOZZLES[0]);
    setReuse(REUSABILITY[0]); setLaunched(false);
    setAnimating(false); setSuccess(false);
  }

  function copyMission() {
    if (!launched || !rocket || !payload || !destination) return;
    const outcome  = launchSuccess ? '✅ SUCCESS' : '❌ FAILURE';
    const budgetStatus = cost && budget
      ? cost.total <= budget ? `Under budget by $${budget - cost.total}M` : `Over budget by $${cost.total - budget}M`
      : '';
    const text = [
      `🚀 ORBIT — Rocket Builder Mission Report`,
      ``,
      `Outcome:     ${outcome}`,
      `Destination: ${destination.name}`,
      `Payload:     ${payload.name} (${payloadMass}t)`,
      `Rocket:      ${rocket.name}-class`,
      `Fuel:        ${fuel.name}`,
      `Stages:      ${stages.label}`,
      `Nozzle:      ${nozzle.label}`,
      `Reusability: ${reusability.label}`,
      ``,
      `Mission cost: $${cost?.total}M`,
      `Target budget: $${budget}M`,
      `${budgetStatus}`,
      ``,
      `Success probability: ${physics?.successProb}%`,
      `Velocity margin: ${physics ? (physics.margin >= 0 ? '+' : '') + physics.margin.toFixed(2) + ' km/s' : '—'}`,
      ``,
      `Built on ORBIT — rocket-launch-tracker.vercel.app`,
    ].join('\n');

    navigator.clipboard.writeText(text)
      .then(() => setCopied(true))
      .catch(() => {});
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="builder">

      {/* STEP INDICATOR */}
      <div className="steps">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`step ${i < step ? 'done' : i === step ? 'current' : 'todo'}`}
            onClick={() => {
              // Can always go back; can go forward if allSelected
              if (i < step || allSelected) setStep(i);
            }}
          >
            {i < step ? `✓ ${s}` : `${i + 1} · ${s}`}
          </div>
        ))}
      </div>

      <div className="builder-layout">
        <div className="builder-left">

          {/* STEP 0 — DESTINATION */}
          {step === 0 && !launched && !animating && (
            <div className="builder-section">
              <div className="bs-label">SELECT YOUR DESTINATION</div>
              <div className="dest-grid">
                {DESTINATIONS.map(d => (
                  <div
                    key={d.id}
                    className={`dest-card ${destination?.id === d.id ? 'selected' : ''}`}
                    onClick={() => setDest(d)}
                  >
                    <span className="dest-icon">{d.icon}</span>
                    <div className="dest-right">
                      <div className="dest-name">{d.name}</div>
                      <div className="dest-dv">Δv {d.dv} km/s · Budget scales with payload</div>
                      <div className="dest-desc">{d.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="next-btn" disabled={!destination} onClick={() => setStep(1)}>
                Next: Choose Payload →
              </button>
            </div>
          )}

          {/* STEP 1 — PAYLOAD */}
          {step === 1 && !launched && !animating && (
            <div className="builder-section">
              <div className="bs-label">SELECT YOUR PAYLOAD</div>
              <div className="payload-grid">
                {PAYLOADS.map(p => (
                  <div
                    key={p.id}
                    className={`payload-card ${payload?.id === p.id ? 'selected' : ''}`}
                    onClick={() => setPayload(p)}
                  >
                    <div className="pc-icon">{p.icon}</div>
                    <div className="pc-name">{p.name}</div>
                    <div className="pc-mass">{p.mass}t</div>
                    <div className="pc-desc">{p.desc}</div>
                    <div className="pc-real">{p.realWorld}</div>
                  </div>
                ))}
              </div>
              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(0)}>← Back</button>
                <button className="next-btn" disabled={!payload} onClick={() => setStep(2)}>
                  Next: Choose Rocket →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — ROCKET BODY */}
          {step === 2 && !launched && !animating && (
            <div className="builder-section">
              <div className="bs-label">CHOOSE YOUR ROCKET CLASS</div>
              <div className="option-grid">
                {ROCKETS.map(r => (
                  <div
                    key={r.id}
                    className={`option-card ${rocket?.id === r.id ? 'selected' : ''}`}
                    onClick={() => {
                      setRocket(r);
                      if (!fuel) setFuel(FUELS[0]);
                      // NOTE: do NOT reset payload here
                    }}
                  >
                    <div className="oc-icon">{r.icon}</div>
                    <div className="oc-name">{r.name}</div>
                    <div className="oc-example">{r.example}</div>
                    <div className="oc-desc">{r.description}</div>
                    <div className="oc-stat">Up to {r.maxPayload}t to LEO</div>
                  </div>
                ))}
              </div>
              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(1)}>← Back</button>
                <button className="next-btn" disabled={!rocket} onClick={() => setStep(3)}>
                  Next: Choose Fuel →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — FUEL */}
          {step === 3 && !launched && !animating && (
            <div className="builder-section">
              <div className="bs-label">CHOOSE YOUR PROPELLANT</div>
              <div className="option-grid">
                {FUELS.map(f => (
                  <div
                    key={f.id}
                    className={`option-card ${fuel?.id === f.id ? 'selected' : ''}`}
                    onClick={() => setFuel(f)}
                    style={fuel?.id === f.id ? { borderColor: f.color } : {}}
                  >
                    <div className="oc-fuel-dot" style={{ background: f.color }} />
                    <div className="oc-name">{f.name}</div>
                    <div className="oc-example">{f.label}</div>
                    <div className="oc-desc">{f.description}</div>
                    <div className="oc-stat">Fuel efficiency: {f.isp}s (Isp)</div>
                  </div>
                ))}
              </div>
              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(2)}>← Back</button>
                <button className="next-btn" disabled={!fuel} onClick={() => setStep(4)}>
                  Next: Configuration →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — CONFIGURATION */}
          {step === 4 && !launched && !animating && (
            <div className="builder-section">
              <div className="bs-label">NUMBER OF STAGES</div>
              <div className="option-grid">
                {STAGES.map(s => (
                  <div
                    key={s.id}
                    className={`option-card ${stages?.id === s.id ? 'selected' : ''}`}
                    onClick={() => setStages(s)}
                  >
                    <div className="oc-icon">{'I'.repeat(s.id)}</div>
                    <div className="oc-name">{s.label}</div>
                    <div className="oc-desc">{s.desc}</div>
                    <div className="oc-stat">×{s.multiplier} velocity multiplier</div>
                  </div>
                ))}
              </div>

              <div className="bs-label" style={{ marginTop: 16 }}>ENGINE NOZZLE</div>
              <div className="option-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {NOZZLES.map(n => (
                  <div
                    key={n.id}
                    className={`option-card ${nozzle?.id === n.id ? 'selected' : ''}`}
                    onClick={() => setNozzle(n)}
                  >
                    <div className="oc-icon">{n.id === 'standard' ? '🔥' : '🌌'}</div>
                    <div className="oc-name">{n.label}</div>
                    <div className="oc-desc">{n.desc}</div>
                  </div>
                ))}
              </div>

              <div className="bs-label" style={{ marginTop: 16 }}>REUSABILITY</div>
              <div className="option-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {REUSABILITY.map(r => (
                  <div
                    key={r.id}
                    className={`option-card ${reusability?.id === r.id ? 'selected' : ''}`}
                    onClick={() => setReuse(r)}
                  >
                    <div className="oc-icon">{r.id === 'expendable' ? '💥' : '🔄'}</div>
                    <div className="oc-name">{r.label}</div>
                    <div className="oc-desc">{r.desc}</div>
                  </div>
                ))}
              </div>

              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(3)}>← Back</button>
                <button
                  className="launch-btn"
                  disabled={!destination || !physics}
                  onClick={handleLaunch}
                >
                  ⚡ INITIATE LAUNCH SEQUENCE
                </button>
              </div>
            </div>
          )}

          {/* LAUNCH ANIMATION */}
          {animating && (
            <div className="launch-anim">
              <div className="anim-rocket">🚀</div>
              <div className="anim-text">Launch sequence initiated...</div>
              <div className="anim-bar"><div className="anim-fill" /></div>
            </div>
          )}

          {/* RESULT */}
          {launched && (
            <>
              <div className={`result-banner ${launchSuccess ? 'success' : 'fail'}`}>
                <div className="result-icon">{launchSuccess ? '🎉' : '💥'}</div>
                <div className="result-title">
                  {launchSuccess ? 'MISSION SUCCESSFUL' : 'MISSION FAILED'}
                </div>
                <div className="result-body">
                  {launchSuccess
                    ? `Your ${rocket.name}-class rocket successfully delivered a ${payload.name} (${payloadMass}t) to ${destination.name}. Fuel reserve: +${physics.margin.toFixed(2)} km/s to spare.`
                    : getFailureAdvice(physics, rocket, fuel, payloadMass, destination)
                  }
                </div>
              </div>

              {optimalMission && (
                <div className="optimal-panel">
                  <div className="op-title">
                    {launchSuccess ? '📊 MINIMUM VIABLE CONFIGURATION' : '💡 A CONFIGURATION THAT WORKS'}
                  </div>
                  <div className="op-body">
                    {launchSuccess
                      ? 'For comparison, the cheapest configuration that reaches this destination:'
                      : 'Here is the minimum configuration that can reach this destination:'}
                  </div>
                  <div className="op-grid">
                    <OptStat label="Rocket"          value={optimalMission.rocket.name} />
                    <OptStat label="Fuel"            value={optimalMission.fuel.label} />
                    <OptStat label="Stages"          value={optimalMission.stages.label} />
                    <OptStat label="Nozzle"          value={optimalMission.nozzle.label} />
                    <OptStat label="Reusability"     value={optimalMission.reusability.label} />
                    <OptStat label="Total cost"      value={`$${optimalMission.cost.total}M`} />
                    <OptStat label="Velocity margin" value={`+${optimalMission.physics.margin.toFixed(2)} km/s`} />
                    <OptStat label="vs Your cost"
                      value={cost
                        ? optimalMission.cost.total < cost.total
                          ? `$${cost.total - optimalMission.cost.total}M cheaper`
                          : `$${optimalMission.cost.total - cost.total}M more`
                        : '—'}
                    />
                  </div>
                </div>
              )}

              {cost && destination && (
                <div className={`budget-banner ${cost.total <= budget ? 'under' : 'over'}`}>
                  <div className="budget-icon">{cost.total <= budget ? '💰' : '📈'}</div>
                  <div className="budget-title">
                    {cost.total <= budget ? 'UNDER BUDGET' : 'OVER BUDGET'}
                  </div>
                  <div className="budget-body">
                    Mission cost <strong>${cost.total}M</strong> vs target of <strong>${budget}M</strong> —{' '}
                    {cost.total <= budget
                      ? `$${budget - cost.total}M saved.`
                      : `$${cost.total - budget}M over. Consider a lighter rocket or reusability.`
                    }
                  </div>
                  <div className="budget-breakdown">
                    <span>Rocket ${cost.breakdown.rocket}M</span>
                    <span>·</span><span>Fuel ${cost.breakdown.fuel}M</span>
                    <span>·</span><span>Payload integration ${cost.breakdown.payload}M</span>
                    <span>·</span><span>Staging ${cost.breakdown.staging}M</span>
                    {cost.breakdown.nozzle > 0 && <><span>·</span><span>Nozzle ${cost.breakdown.nozzle}M</span></>}
                  </div>
                </div>
              )}
            <div className="result-btns">
              <button className="edit-btn" onClick={() => { setLaunched(false); setAnimating(false); setStep(lastStep); }}>
                ✏ Edit Rocket
              </button>
              <button className="reset-btn" onClick={handleReset}>
                ↺ Try Again
              </button>
              <button className="copy-btn" onClick={copyMission}>
                {copied ? '✓ Copied!' : '📋 Copy Summary'}
              </button>
              <button className="compare-btn" onClick={() => navigate('/archive')}>
                🔍 Browse Real Missions
              </button>
            </div>

            </>
          )}
        </div>

        {/* RIGHT — LIVE READOUT */}
        <div className="builder-right">
          <RocketDiagram rocket={rocket} fuel={fuel} payloadMass={payloadMass} />

          <div className="readout">
            <div className="readout-tabs">
              <button
                className={`readout-tab ${readoutTab === 'mission' ? 'active' : ''}`}
                onClick={() => setReadoutTab('mission')}
              >
                Mission
              </button>
              <button
                className={`readout-tab ${readoutTab === 'budget' ? 'active' : ''}`}
                onClick={() => setReadoutTab('budget')}
              >
                Budget
              </button>
            </div>

            {!destination && !rocket ? (
              <div className="readout-empty">Configure your rocket to see live mission data.</div>
            ) : (
              <>
                {physics && (
                  <div className={`prob-wrap ${readoutTab === 'mission' ? 'prob-active' : ''}`}>
                    <div className="prob-label-row">
                      <span>Success probability</span>
                      <span style={{ color: physics.successProb >= 70 ? 'var(--teal)' : physics.successProb >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                        {physics.successProb}%
                      </span>
                    </div>
                    <div className="prob-track">
                      <div className="prob-fill" style={{
                        width: `${physics.successProb}%`,
                        background: physics.successProb >= 70 ? 'var(--teal)' : physics.successProb >= 40 ? 'var(--amber)' : 'var(--red)',
                      }} />
                    </div>
                  </div>
                )}

                {cost && destination && (
                  <div className={`prob-wrap ${readoutTab === 'budget' ? 'prob-active' : ''}`}>
                    <div className="prob-label-row">
                      <span>Budget used</span>
                      <span style={{ color:
                        cost.total / budget <= 0.8 ? 'var(--teal)' :
                        cost.total / budget <= 1.0 ? 'var(--amber)' : 'var(--red)'
                      }}>
                        {Math.round((cost.total / budget) * 100)}%
                      </span>
                    </div>
                    <div className="prob-track">
                      <div className="prob-fill" style={{
                        width: `${Math.min(100, Math.round((cost.total / budget) * 100))}%`,
                        background:
                          cost.total / budget <= 0.8 ? 'var(--teal)' :
                          cost.total / budget <= 1.0 ? 'var(--amber)' : 'var(--red)',
                      }} />
                    </div>
                  </div>
                )}

                <div className="readout-divider" />

                {readoutTab === 'mission' ? (
                  <>
                    <ReadoutRow label="Payload"
                      value={payload ? `${payload.name} (${payloadMass}t)` : 'Incomplete'}
                      status="neutral" />
                    <ReadoutRow label="Thrust-to-weight"
                      value={physics ? physics.twr.toFixed(2) + ' TWR' : 'Incomplete'}
                      status={!physics ? 'neutral' : physics.twr >= 1.3 ? 'good' : physics.twr >= 1.0 ? 'warn' : 'bad'} />
                    <ReadoutRow label="Velocity budget"
                      value={physics ? physics.dvAvailable.toFixed(2) + ' km/s' : 'Incomplete'}
                      status={!physics ? 'neutral' : 'good'} />
                    <ReadoutRow label="Velocity needed"
                      value={destination ? destination.dv + ' km/s' : 'Incomplete'}
                      status="neutral" />
                    <ReadoutRow label="Margin"
                      value={physics ? (physics.margin >= 0 ? '+' : '') + physics.margin.toFixed(2) + ' km/s' : 'Incomplete'}
                      status={!physics ? 'neutral' : physics.margin >= 0.5 ? 'good' : physics.margin >= 0 ? 'warn' : 'bad'} />
                    <ReadoutRow label="Fuel efficiency"
                      value={physics ? Math.round(physics.effectiveIsp) + 's (Isp)' : 'Incomplete'}
                      status="neutral" />
                  </>
                ) : (
                  <>
                    <ReadoutRow label="Mission cost"
                      value={cost ? `$${cost.total}M` : 'Incomplete'}
                      status="neutral" />
                    <ReadoutRow label="Target budget"
                      value={budget ? `$${budget}M` : '—'}
                      status="neutral" />
                    {cost && budget && (
                      <ReadoutRow label="Budget margin"
                        value={cost.total <= budget
                          ? `-$${budget - cost.total}M under`
                          : `+$${cost.total - budget}M over`}
                        status={cost.total <= budget ? 'good' : cost.total <= budget * 1.2 ? 'warn' : 'bad'} />
                    )}
                    {cost && (
                      <div className="cost-breakdown">
                        <div className="cb-row"><span>Rocket</span><span>${cost.breakdown.rocket}M</span></div>
                        <div className="cb-row"><span>Fuel</span><span>${cost.breakdown.fuel}M</span></div>
                        <div className="cb-row"><span>Payload integration</span><span>${cost.breakdown.payload}M</span></div>
                        <div className="cb-row"><span>Staging</span><span>${cost.breakdown.staging}M</span></div>
                        {cost.breakdown.nozzle > 0 && (
                          <div className="cb-row"><span>Nozzle</span><span>${cost.breakdown.nozzle}M</span></div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function RocketDiagram({ rocket, fuel, payloadMass }) {
  const scale  = rocket ? { light: 0.65, medium: 1, heavy: 1.35 }[rocket.id] : 0.8;
  const fColor = fuel?.color || 'rgba(255,255,255,0.1)';
  const maxP   = rocket?.maxPayload || 10;
  const pScale = Math.min(1, payloadMass / maxP); // always 0-1

  return (
    <div className="rocket-diagram">
      <div className="rd-label">LIVE BUILD</div>
      <svg
        viewBox="0 0 80 200"
        width={80 * scale}
        height={200 * scale}
        style={{ transition: 'all 0.4s ease' }}
      >
        <ellipse cx="40" cy="30" rx="16" ry="22" fill="#3B82F6" opacity="0.9" />
        <rect x="28" y="30" width="24" height={10 + pScale * 14} rx="2" fill="#2563EB" opacity="0.85" />
        <rect x="26" y={40 + pScale * 14} width="28" height="80" rx="3" fill={fColor} opacity="0.7" />
        <rect x="28" y="120" width="24" height="24" rx="2" fill="#1e3a5f" />
        <polygon points="14,144 26,110 26,144" fill="#1d4ed8" opacity="0.8" />
        <polygon points="66,144 54,110 54,144" fill="#1d4ed8" opacity="0.8" />
        <ellipse cx="40" cy="148" rx="10" ry="7" fill="#0f172a" />
        <ellipse cx="40" cy="155" rx="7" ry="10" fill="#F59E0B" opacity="0.7" />
        <ellipse cx="40" cy="158" rx="4" ry="6"  fill="#EF4444" opacity="0.6" />
      </svg>
      {!rocket && <div className="rd-placeholder">Configure your rocket to see it here</div>}
      {rocket && (
        <div className="rd-specs">
          <RdStat label="Class"   value={rocket.name} />
          <RdStat label="Fuel"    value={fuel?.label || '—'} />
          <RdStat label="Payload" value={payloadMass > 0 ? `${payloadMass}t` : '—'} />
        </div>
      )}
    </div>
  );
}

function RdStat({ label, value }) {
  return (
    <div className="rd-stat">
      <span className="rd-key">{label}</span>
      <span className="rd-val">{value}</span>
    </div>
  );
}

function ReadoutRow({ label, value, status }) {
  const color = { good: 'var(--teal)', warn: 'var(--amber)', bad: 'var(--red)', neutral: 'var(--text-primary)' }[status];
  return (
    <div className="readout-row">
      <span className="rr-label">{label}</span>
      <span className="rr-val" style={{ color }}>{value}</span>
    </div>
  );
}

function getFailureAdvice(physics, rocket, fuel, payloadMass, destination) {
  if (physics.twr < 1.0)
    return 'Your engines cannot overcome gravity — the rocket never left the pad. Try upgrading to a heavier rocket class with more thrust.';
  if (payloadMass > rocket.maxPayload * 0.9)
    return `Your payload is too heavy for a ${rocket.name}-class rocket. Try a heavier rocket class.`;
  if (fuel?.id === 'solid' && destination?.id !== 'leo')
    return 'Solid propellant burns out too quickly for deep space missions. Switch to Liquid Hydrogen.';
  return `Your engines ran out of fuel ${Math.abs(physics.margin).toFixed(2)} km/s short of ${destination.name}. Try LH2/LOX or add a staging layer.`;
}

function findOptimalMission(destination, selectedPayload, budget) {
  if (!destination || !selectedPayload || !budget) return null;
  const mass = selectedPayload.mass;
  let best = null;
  let bestCost = Infinity;

  for (const r of ROCKETS) {
    if (mass > r.maxPayload) continue;
    for (const f of FUELS) {
      for (const s of STAGES) {
        for (const n of NOZZLES) {
          for (const re of REUSABILITY) {
            const phys = calcPhysics(r, f, mass, destination, s, n, re);
            if (!phys || phys.margin < 0.1) continue;
            const c = calcCost(r, f, mass, s, n, re);
            if (!c || c.total > budget) continue;
            if (c.total < bestCost) {
              bestCost = c.total;
              best = { rocket: r, fuel: f, stages: s, nozzle: n, reusability: re, cost: c, physics: phys };
            }
          }
        }
      }
    }
  }
  return best;
}

function OptStat({ label, value }) {
  return (
    <div className="opt-stat">
      <span className="os-label">{label}</span>
      <span className="os-value">{value}</span>
    </div>
  );
}