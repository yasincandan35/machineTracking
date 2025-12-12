import React from 'react'
import { motion } from 'framer-motion'
import { Clock, AlertTriangle, FileText, BarChart3, Target, TrendingUp, Sparkles, Calendar } from 'lucide-react'

const FuturePlansPage = () => {
  const plans = [
    {
      title: 'Duruş Süreleri Takibi',
      icon: Clock,
      color: 'from-blue-500 to-cyan-500',
      features: [
        'Makine duruş nedenleri',
        'Duruş süre analizi',
        'Verimlilik hesaplama',
        'Otomatik uyarılar'
      ]
    },
    {
      title: 'İş Bazlı Raporlama',
      icon: FileText,
      color: 'from-green-500 to-emerald-500',
      features: [
        'İş emri takibi',
        'Üretim raporları',
        'Kalite metrikleri',
        'Maliyet analizi'
      ]
    },
    {
      title: 'Gelişmiş Analitik',
      icon: BarChart3,
      color: 'from-purple-500 to-pink-500',
      features: [
        'Makine öğrenmesi',
        'Tahminleme modelleri',
        'Anomali tespiti',
        'Optimizasyon önerileri'
      ]
    }
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
          className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full blur-3xl"
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
        <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 bg-clip-text text-transparent">
          Gelecek Planları
        </span>
      </motion.h2>

      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 relative z-10">
        {plans.map((plan, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.3, duration: 0.8 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20"
          >
            <div className="flex items-center mb-4 md:mb-6">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.8 }}
                className={`w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center mr-4 md:mr-6 shadow-2xl`}
              >
                <plan.icon size={24} className="text-white drop-shadow-lg" />
              </motion.div>
              <h3 className="text-2xl md:text-4xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                {plan.title}
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {plan.features.map((feature, featureIndex) => (
                <motion.div
                  key={featureIndex}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.3 + featureIndex * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white/5 rounded-lg p-3 text-center border border-white/10 hover:border-white/20 transition-all duration-300"
                >
                  <p className="text-white font-medium text-xs md:text-sm">{feature}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-yellow-500/30"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 md:mb-6 text-center flex items-center justify-center">
            <Calendar className="w-6 h-6 mr-3 text-yellow-400" />
            Uygulama Zaman Çizelgesi
            <Calendar className="w-6 h-6 ml-3 text-yellow-400" />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-black font-bold text-xl">1</span>
              </div>
              <h4 className="text-lg md:text-xl font-bold text-white mb-2">Q1 2025</h4>
              <p className="text-gray-300 text-sm md:text-base">Duruş süreleri modülü</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h4 className="text-lg md:text-xl font-bold text-white mb-2">Q2 2025</h4>
              <p className="text-gray-300 text-sm md:text-base">İş bazlı raporlama</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h4 className="text-lg md:text-xl font-bold text-white mb-2">Q3 2025</h4>
              <p className="text-gray-300 text-sm md:text-base">AI destekli analitik</p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default FuturePlansPage