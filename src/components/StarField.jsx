import React, { useMemo } from 'react';
import './StarField.css';

export default function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: 120 }, (_, i) => ({
      id: i,
      top:      `${Math.random() * 100}%`,
      left:     `${Math.random() * 100}%`,
      size:     Math.random() * 1.5 + 0.5,
      delay:    Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity:  Math.random() * 0.3 + 0.1,
    })), []
  );

  return (
    <div className="starfield">
      {stars.map(s => (
        <div
          key={s.id}
          className="star"
          style={{
            top:                s.top,
            left:               s.left,
            width:              s.size,
            height:             s.size,
            opacity:            s.opacity,
            animationDelay:     `${s.delay}s`,
            animationDuration:  `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}