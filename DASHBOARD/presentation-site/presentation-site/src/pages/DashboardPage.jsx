import React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Gauge, TrendingUp, Activity, Clock, Target, Sparkles, Monitor } from 'lucide-react'

const DashboardPage = () => {
  const features = [
    { icon: BarChart3, title: 'Gerçek Zamanlı Grafikler', desc: 'Canlı veri görselleştirme', color: 'from-blue-500 to-cyan-500' },
    { icon: Gauge, title: 'Performans Metrikleri', desc: 'Makine verimlilik analizi', color: 'from-green-500 to-emerald-500' },
    { icon: TrendingUp, title: 'Trend Analizi', desc: 'Geçmiş veri analizi', color: 'from-purple-500 to-pink-500' },
    { icon: Activity, title: 'Sistem Durumu', desc: 'Anlık sistem sağlığı', color: 'from-orange-500 to-red-500' },
    { icon: Clock, title: 'Zaman Bazlı Raporlar', desc: 'Günlük/haftalık raporlar', color: 'from-teal-500 to-blue-500' },
    { icon: Target, title: 'Hedef Takibi', desc: 'Üretim hedefleri', color: 'from-yellow-500 to-orange-500' }
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
          className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
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
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
        />
      </div>

      <motion.h2
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-6xl font-bold text-center mb-8 md:mb-12 text-white relative z-10"
      >
        <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          Dashboard Özellikleri
        </span>
      </motion.h2>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
          {features.map((feature, index) => (
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
              <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20 group-hover:border-white/40 transition-all duration-300">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.8 }}
                  className={`w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 rounded-full bg-gradient-to-r ${feature.color} flex items-center justify-center shadow-2xl`}
                >
                  <feature.icon size={24} className="text-white drop-shadow-lg" />
                </motion.div>
                <h3 className="text-lg md:text-2xl font-bold text-white text-center mb-2 md:mb-4 group-hover:text-cyan-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-300 text-center text-sm md:text-base group-hover:text-gray-200 transition-colors">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8 text-center flex items-center justify-center">
            <Monitor className="w-6 h-6 mr-3 text-cyan-400" />
            Dashboard Bileşenleri
            <Monitor className="w-6 h-6 ml-3 text-cyan-400" />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/20"
            >
              <h4 className="text-lg md:text-xl font-bold text-cyan-300 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Bilgi Kartları
              </h4>
              <ul className="space-y-2 text-gray-300 text-sm md:text-base">
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Die Speed (Kalıp Hızı)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Die Counter (Kalıp Sayacı)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Ethyl Consumption (Etil Tüketimi)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Temperature (Sıcaklık)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Humidity (Nem)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Production Count (Üretim Sayısı)
                </li>
              </ul>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20"
            >
              <h4 className="text-lg md:text-xl font-bold text-emerald-300 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Grafik Bileşenleri
              </h4>
              <ul className="space-y-2 text-gray-300 text-sm md:text-base">
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Line Chart (Çizgi Grafik)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Bar Chart (Sütun Grafik)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Pie Chart (Pasta Grafik)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Donut Chart (Halka Grafik)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Real-time Updates (Gerçek Zamanlı)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Interactive Controls (Etkileşimli)
                </li>
              </ul>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default DashboardPage