import React from 'react';
import Snowfall from 'react-snowfall';

export default function SnowfallOverlay({
  count = 80,
  color = '#ffffff',
  zIndex = 5000,
  speed = [0.5, 2.0],
}) {
  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex }}
    >
      <Snowfall
        snowflakeCount={count}
        color={color}
        speed={speed}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
    </div>
  );
}

