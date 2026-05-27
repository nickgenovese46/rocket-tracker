import React, { useState, useEffect } from 'react';
import './Countdown.css';

export default function Countdown({ launchTime }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(launchTime));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(launchTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [launchTime]);

  return (
    <div className="countdown">
      <CountBlock value={timeLeft.days}    label="DAYS" />
      <span className="colon">:</span>
      <CountBlock value={timeLeft.hours}   label="HRS"  />
      <span className="colon">:</span>
      <CountBlock value={timeLeft.minutes} label="MIN"  />
      <span className="colon">:</span>
      <CountBlock value={timeLeft.seconds} label="SEC"  />
    </div>
  );
}

function CountBlock({ value, label }) {
  return (
    <div className="count-block">
      <span className="count-num">{String(value).padStart(2, '0')}</span>
      <span className="count-label">{label}</span>
    </div>
  );
}

function getTimeLeft(launchTime) {
  const diff = Math.max(0, new Date(launchTime) - new Date());
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}