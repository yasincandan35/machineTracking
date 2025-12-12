import React, { useRef, useEffect } from 'react';

const FluidBackground = ({ machineStatus }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas boyutunu ayarla
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Script'i sadece bir kez yükle
    const loadFluidSimulation = () => {
      console.log('Loading fluid simulation...');
      
      if (!window.fluidScriptLoaded) {
        // fluid-simulation.js'i yükle (dat.gui zaten index.html'de var)
        const script = document.createElement('script');
        script.src = '/fluid-simulation.js';
        script.onload = () => {
          window.fluidScriptLoaded = true;
          console.log('✅ Fluid simulation script loaded successfully');
          console.log('🔍 window.init available:', typeof window.init);
          console.log('🔍 window.update available:', typeof window.update);
        };
        script.onerror = (error) => {
          console.error('❌ Failed to load fluid simulation script:', error);
          console.error('Script path:', script.src);
        };
        document.head.appendChild(script);
      }
    };

    // Script yükleme işlemini başlat
    loadFluidSimulation();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Makine durumuna göre simülasyonu kontrol et
  useEffect(() => {
    if (machineStatus === 'running') {
      // Makine çalışıyorsa simülasyonu başlat
      const startSimulation = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          console.warn('⚠️ Canvas not found for WebGL');
          return;
        }

        console.log('🔍 Canvas found:', canvas);
        console.log('🔍 Canvas dimensions:', canvas.width, 'x', canvas.height);
        console.log('🔍 Canvas client dimensions:', canvas.clientWidth, 'x', canvas.clientHeight);
        console.log('🔍 Canvas style:', {
          visibility: window.getComputedStyle(canvas).visibility,
          opacity: window.getComputedStyle(canvas).opacity,
          display: window.getComputedStyle(canvas).display
        });
        
        // Canvas boyutu 0 ise, biraz bekle ve tekrar dene
        if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
          console.warn('⚠️ Canvas has zero dimensions, waiting 100ms...');
          setTimeout(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            console.log('🔍 Canvas resized to:', canvas.width, 'x', canvas.height);
            startSimulation();
          }, 100);
          return;
        }

        // WebGL bağlamını kontrol et
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          console.error('❌ WebGL not supported or context failed');
          console.error('Browser WebGL support:', {
            webgl2: !!canvas.getContext('webgl2'),
            webgl: !!canvas.getContext('webgl'),
            experimental: !!canvas.getContext('experimental-webgl')
          });
          return;
        }

        console.log('✅ WebGL context created:', gl.getParameter(gl.VERSION));

        if (window.init && typeof window.init === 'function') {
          // Simülasyon durumunu true yap
          window.fluidSimulationRunning = true;
          try {
            console.log('🎯 Calling window.init()...');
            window.init();
            console.log('✅ WebGL fluid simulation started');
          } catch (error) {
            console.error('❌ WebGL simulation init error:', error);
            console.error('Error stack:', error.stack);
          }
        } else {
          // Script yüklenmiş ama init fonksiyonu henüz hazır değilse bekle
          const checkInit = setInterval(() => {
            if (window.init && typeof window.init === 'function') {
              window.fluidSimulationRunning = true;
              try {
                window.init();
                console.log('✅ WebGL fluid simulation started (delayed)');
              } catch (error) {
                console.error('❌ WebGL simulation init error:', error);
              }
              clearInterval(checkInit);
            }
          }, 100);
          
          // 5 saniye sonra timeout
          setTimeout(() => {
            clearInterval(checkInit);
          }, 5000);
        }
      };

      // Script yüklenmişse direkt başlat, değilse bekle
      if (window.fluidScriptLoaded) {
        startSimulation();
      } else {
        // Script henüz yüklenmemişse bekle
        const checkScript = setInterval(() => {
          if (window.fluidScriptLoaded) {
            clearInterval(checkScript);
            startSimulation();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkScript);
        }, 10000);
      }
    } else {
      // Makine durmuşsa simülasyonu sadece duraklat
      // Simülasyon durumunu false yap
      window.fluidSimulationRunning = false;
      
      // Canvas'ı temizle
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      }
    }
  }, [machineStatus]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2, // Arka planda ama görünür (background: 0, fluid: 2, top-bar: 100)
        pointerEvents: 'none', // Wrapper alt elementlere geçmesin
        overflow: 'hidden' // Taşmaları engelle
      }}
    >
      <canvas
        ref={canvasRef}
        id="canvas"
        className="fluid-canvas"
        style={{
          width: '100%',
          height: '100%',
          opacity: machineStatus === 'running' ? 0.8 : 0, // Daha görünür yap
          background: 'transparent',
          pointerEvents: machineStatus === 'running' ? 'auto' : 'none', // Canvas mouse ve dokunmatik event'leri alsın (sadece running'de)
          touchAction: 'none', // Dokunmatik kaydırmayı engelle
          cursor: machineStatus === 'running' ? 'crosshair' : 'default', // Mouse ile etkileşim göstergesi
          visibility: machineStatus === 'running' ? 'visible' : 'hidden',
          position: 'absolute', // Parent'a göre konumlan
          top: 0,
          left: 0,
          zIndex: 1 // Canvas wrapper içinde en üstte
        }}
      />
    </div>
  );
};

export default FluidBackground;
