import React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Cpu, Database, TrendingUp, Activity, Zap, Sparkles, Star } from 'lucide-react'

const IntroPage = () => {
  const features = [
    { 
      title: 'Gerçek Zamanlı İzleme', 
      description: 'PLC\'den anlık veri toplama ve görselleştirme',
      icon: Activity,
      color: 'from-cyan-400 via-blue-500 to-purple-600',
      bgColor: 'from-cyan-500/20 to-blue-600/20'
    },
    { 
      title: 'Performans Analizi', 
      description: 'Makine verimliliği ve trend analizi',
      icon: TrendingUp,
      color: 'from-emerald-400 via-green-500 to-teal-600',
      bgColor: 'from-emerald-500/20 to-green-600/20'
    },
    { 
      title: 'Veri Yönetimi', 
      description: 'Güvenli veri saklama ve işleme',
      icon: Database,
      color: 'from-pink-400 via-purple-500 to-indigo-600',
      bgColor: 'from-pink-500/20 to-purple-600/20'
    },
    { 
      title: 'Raporlama', 
      description: 'Detaylı üretim ve performans raporları',
      icon: BarChart3,
      color: 'from-orange-400 via-red-500 to-pink-600',
      bgColor: 'from-orange-500/20 to-red-600/20'
    }
  ]

  return (
    <div className="h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            rotate: -360,
            scale: [1, 1.3, 1],
          }}
          transition={{ 
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative z-10"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: [0, 1, -1, 0]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="inline-block"
        >
          <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-4 drop-shadow-2xl">
            BOBST Machine Tracking System
          </h1>
        </motion.div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xl md:text-2xl text-gray-200 max-w-4xl font-medium"
        >
          Endüstriyel makine izleme ve analiz platformu ile üretim verimliliğini artırın
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 }}
          className="flex justify-center mt-4"
        >
          <div className="flex space-x-2">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              >
                <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-400 fill-current" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {features.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50, rotateY: -15 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              transition={{ delay: index * 0.2, duration: 0.8 }}
              whileHover={{ 
                scale: 1.08, 
                rotateY: 5,
                z: 50
              }}
              className="relative group cursor-pointer"
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${item.bgColor} rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300`} />
              <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20 group-hover:border-white/40 transition-all duration-300">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className={`w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center shadow-2xl`}
                >
                  <item.icon size={24} className="text-white drop-shadow-lg" />
                </motion.div>
                <h3 className="text-lg md:text-xl font-bold text-white text-center mb-2 group-hover:text-cyan-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-gray-300 text-xs md:text-sm text-center group-hover:text-gray-200 transition-colors">
                  {item.description}
                </p>
                <motion.div
                  initial={{ width: 0 }}
                  whileHover={{ width: "100%" }}
                  className="h-1 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full mt-3"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="mt-6 md:mt-8 text-center relative z-10"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-cyan-500/20 rounded-2xl blur-xl" />
          <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20 max-w-4xl">
            <motion.div
              animate={{ 
                scale: [1, 1.02, 1],
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-4">
                Sistem Özellikleri
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-3 border border-blue-500/20"
              >
                <h4 className="text-base md:text-lg font-bold text-cyan-300 mb-2 flex items-center">
                  <Cpu className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Veri Toplama
                </h4>
                <ul className="text-gray-300 text-xs md:text-sm space-y-1">
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    PLC Lemanic3 entegrasyonu
                  </li>
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    OPC UA protokolü
                  </li>
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    Gerçek zamanlı veri akışı
                  </li>
                </ul>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-3 border border-green-500/20"
              >
                <h4 className="text-base md:text-lg font-bold text-emerald-300 mb-2 flex items-center">
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Analiz
                </h4>
                <ul className="text-gray-300 text-xs md:text-sm space-y-1">
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    Trend analizi
                  </li>
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    Performans metrikleri
                  </li>
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    Grafik görselleştirme
                  </li>
                </ul>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-3 border border-purple-500/20"
              >
                <h4 className="text-base md:text-lg font-bold text-purple-300 mb-2 flex items-center">
                  <BarChart3 className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Raporlama
                </h4>
                <ul className="text-gray-300 text-xs md:text-sm space-y-1">
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    Özelleştirilebilir raporlar
                  </li>
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    PDF export
                  </li>
                  <li className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                    Zaman bazlı analiz
                  </li>
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default IntroPage