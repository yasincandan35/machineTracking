import React from 'react'
import { motion } from 'framer-motion'
import { Code, Zap, Layers, Activity, Database, Server, Globe, Sparkles } from 'lucide-react'

const TechStackPage = () => {
  const frontend = [
    { name: 'React 18', icon: Code, color: 'from-blue-500 to-cyan-500', desc: 'Modern UI Framework' },
    { name: 'Vite', icon: Zap, color: 'from-yellow-500 to-orange-500', desc: 'Hızlı Build Tool' },
    { name: 'Tailwind CSS', icon: Layers, color: 'from-teal-500 to-blue-500', desc: 'Utility-First CSS' },
    { name: 'Framer Motion', icon: Activity, color: 'from-purple-500 to-pink-500', desc: 'Animasyon Kütüphanesi' }
  ]

  const backend = [
    { name: '.NET 8', icon: Server, color: 'from-green-500 to-emerald-500', desc: 'Backend API' },
    { name: 'Entity Framework', icon: Database, color: 'from-blue-500 to-indigo-500', desc: 'ORM Framework' },
    { name: 'SQL Server', icon: Database, color: 'from-red-500 to-pink-500', desc: 'Veritabanı' },
    { name: 'RESTful API', icon: Globe, color: 'from-orange-500 to-yellow-500', desc: 'API Mimarisi' }
  ]

  const hardware = [
    { name: 'PLC Lemanic3', icon: Code, color: 'from-gray-500 to-slate-500', desc: 'Endüstriyel Kontrol' },
    { name: 'OPC UA', icon: Globe, color: 'from-cyan-500 to-blue-500', desc: 'Veri İletişimi' },
    { name: 'Ethernet/IP', icon: Activity, color: 'from-green-500 to-teal-500', desc: 'Ağ Protokolü' }
  ]

  return (
    <div className="h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            rotate: -360,
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-r from-green-500/20 to-cyan-500/20 rounded-full blur-3xl"
        />
      </div>

      <motion.h2
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl md:text-6xl font-bold text-center mb-8 md:mb-12 text-white relative z-10"
      >
        <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          Teknoloji Yığını
        </span>
      </motion.h2>

      <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 relative z-10">
        <div>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center flex items-center justify-center">
            <Sparkles className="w-6 h-6 mr-3 text-yellow-400" />
            Frontend Teknolojileri
            <Sparkles className="w-6 h-6 ml-3 text-yellow-400" />
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {frontend.map((tech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ 
                  scale: 1.1, 
                  rotateY: 10,
                  z: 50
                }}
                className="relative group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300" />
                <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 group-hover:border-white/40 transition-all duration-300">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.8 }}
                    className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r ${tech.color} flex items-center justify-center shadow-2xl`}
                  >
                    <tech.icon size={24} className="text-white drop-shadow-lg" />
                  </motion.div>
                  <h4 className="text-lg font-bold text-white text-center mb-2 group-hover:text-cyan-300 transition-colors">
                    {tech.name}
                  </h4>
                  <p className="text-gray-300 text-center text-sm group-hover:text-gray-200 transition-colors">
                    {tech.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center flex items-center justify-center">
            <Sparkles className="w-6 h-6 mr-3 text-emerald-400" />
            Backend Teknolojileri
            <Sparkles className="w-6 h-6 ml-3 text-emerald-400" />
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {backend.map((tech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ 
                  scale: 1.1, 
                  rotateY: 10,
                  z: 50
                }}
                className="relative group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300" />
                <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 group-hover:border-white/40 transition-all duration-300">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.8 }}
                    className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r ${tech.color} flex items-center justify-center shadow-2xl`}
                  >
                    <tech.icon size={24} className="text-white drop-shadow-lg" />
                  </motion.div>
                  <h4 className="text-lg font-bold text-white text-center mb-2 group-hover:text-emerald-300 transition-colors">
                    {tech.name}
                  </h4>
                  <p className="text-gray-300 text-center text-sm group-hover:text-gray-200 transition-colors">
                    {tech.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center flex items-center justify-center">
            <Sparkles className="w-6 h-6 mr-3 text-purple-400" />
            Donanım & Protokoller
            <Sparkles className="w-6 h-6 ml-3 text-purple-400" />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hardware.map((tech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ 
                  scale: 1.1, 
                  rotateY: 10,
                  z: 50
                }}
                className="relative group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300" />
                <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 group-hover:border-white/40 transition-all duration-300">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.8 }}
                    className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r ${tech.color} flex items-center justify-center shadow-2xl`}
                  >
                    <tech.icon size={24} className="text-white drop-shadow-lg" />
                  </motion.div>
                  <h4 className="text-lg font-bold text-white text-center mb-2 group-hover:text-purple-300 transition-colors">
                    {tech.name}
                  </h4>
                  <p className="text-gray-300 text-center text-sm group-hover:text-gray-200 transition-colors">
                    {tech.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechStackPage