import React from 'react';

export default function FluidBackground() {
  return (
    <iframe
      src="/WebGL-Fluid-Simulation-master/index.html"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        border: 'none',
        pointerEvents: 'auto'
      }}
      title="Fluid Background"
    />
  );
}

