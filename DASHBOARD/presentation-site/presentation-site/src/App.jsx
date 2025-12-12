import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Play, Pause, Maximize2, Minimize2 } from 'lucide-react'
import './App.css'

// Pages
import IntroPage from './pages/IntroPage'
import TechStackPage from './pages/TechStackPage'
import DataFlowPage from './pages/DataFlowPage'
import DashboardPage from './pages/DashboardPage'
import FuturePlansPage from './pages/FuturePlansPage'
import ReportingPage from './pages/ReportingPage'

const slides = [
  { id: 'intro', component: IntroPage, title: 'Giriş' },
  { id: 'tech-stack', component: TechStackPage, title: 'Teknoloji' },
  { id: 'data-flow', component: DataFlowPage, title: 'Veri Akışı' },
  { id: 'dashboard', component: DashboardPage, title: 'Dashboard' },
  { id: 'future-plans', component: FuturePlansPage, title: 'Gelecek Planları' },
  { id: 'reporting', component: ReportingPage, title: 'Raporlama' }
]

function App() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length)
      }, 8000) // 8 saniye per slide
      return () => clearInterval(interval)
    }
  }, [isPlaying])

  // Mouse wheel navigation
  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault()
      if (e.deltaY > 0) {
        nextSlide()
      } else {
        prevSlide()
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          nextSlide()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prevSlide()
          break
        case 'Escape':
          setIsFullscreen(false)
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'p':
        case 'P':
          setIsPlaying(!isPlaying)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const toggleControls = () => {
    setShowControls(!showControls)
  }

  const CurrentComponent = slides[currentSlide].component

  return (
    <div className={`${isFullscreen ? 'h-screen' : 'h-screen'} overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative`}>
      {/* Slide counter */}
      <div className="absolute top-4 left-4 z-50">
        <div className="bg-black/50 backdrop-blur-lg rounded-full px-4 py-2 text-white text-sm font-medium">
          {currentSlide + 1} / {slides.length}
        </div>
      </div>

      {/* Slide title */}
      <div className="absolute top-4 right-4 z-50">
        <div className="bg-black/50 backdrop-blur-lg rounded-full px-4 py-2 text-white text-sm font-medium">
          {slides[currentSlide].title}
        </div>
      </div>

      {/* Main content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 300, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -300, scale: 0.95 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="h-full"
        >
          <CurrentComponent />
        </motion.div>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
          initial={{ width: "0%" }}
          animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Navigation controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 z-50"
          >
            <button
              onClick={prevSlide}
              className="p-3 bg-white/20 backdrop-blur-lg rounded-full text-white hover:bg-white/30 transition-all hover:scale-110"
              title="Önceki slide (←)"
            >
              <ChevronLeft size={24} />
            </button>
            
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 bg-white/20 backdrop-blur-lg rounded-full text-white hover:bg-white/30 transition-all hover:scale-110"
              title="Otomatik oynat (P)"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <div className="flex space-x-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all hover:scale-125 ${
                    index === currentSlide ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextSlide}
              className="p-3 bg-white/20 backdrop-blur-lg rounded-full text-white hover:bg-white/30 transition-all hover:scale-110"
              title="Sonraki slide (→)"
            >
              <ChevronRight size={24} />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-3 bg-white/20 backdrop-blur-lg rounded-full text-white hover:bg-white/30 transition-all hover:scale-110"
              title="Tam ekran (F)"
            >
              {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hide controls button */}
      <button
        onClick={toggleControls}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 p-2 bg-black/50 backdrop-blur-lg rounded-full text-white hover:bg-black/70 transition-all"
        title="Kontrolleri gizle/göster"
      >
        <div className={`w-6 h-1 bg-white rounded transition-all ${showControls ? 'rotate-45' : ''}`} />
        <div className={`w-6 h-1 bg-white rounded transition-all mt-1 ${showControls ? '-rotate-45 -mt-2' : ''}`} />
      </button>

      {/* Instructions */}
      <AnimatePresence>
        {currentSlide === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 text-center"
          >
            <div className="bg-black/50 backdrop-blur-lg rounded-lg px-6 py-4 text-white text-sm">
              <p>🖱️ Mouse tekeri ile gezin • ⌨️ Ok tuşları ile gezin • 🎮 Space ile ilerle</p>
              <p>🎬 P ile otomatik oynat • 🔍 F ile tam ekran • ⏸️ Escape ile çık</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App