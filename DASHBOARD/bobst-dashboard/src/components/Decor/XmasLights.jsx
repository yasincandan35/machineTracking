import React from 'react';
import Lottie from 'lottie-react';
import xmasLightsAnimation from '../../assets/xmas-lights.json';

export default function XmasLights({ height = 40 }) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Lottie
        animationData={xmasLightsAnimation}
        loop
        autoplay
        style={{ height, width: '100%' }}
      />
    </div>
  );
}


