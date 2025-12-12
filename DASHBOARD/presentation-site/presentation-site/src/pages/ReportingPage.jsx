import React from 'react'
import { motion } from 'framer-motion'
import { FileText, BarChart3, PieChart, Download, Calendar, TrendingUp, Sparkles, Report } from 'lucide-react'

const ReportingPage = () => {
  const reportTypes = [
    {
      title: 'Günlük Raporlar',
      icon: Calendar,
      color: 'from-blue-500 to-cyan-500',
      features: ['Üretim özeti', 'Makine durumu', 'Verimlilik metrikleri']
    },
    {
      title: 'Haftalık Analiz',
      icon: BarChart3,
      color: 'from-green-500 to-emerald-500',
      features: ['Trend analizi', 'Karşılaştırmalı veriler', 'Performans değerlendirme']
    },
    {
      title: 'Aylık Raporlar',
      icon: PieChart,
      color: 'from-purple-500 to-pink-500',
      features: ['Kapsamlı analiz', 'Hedef karşılaştırması', 'Maliyet analizi']
    },
    {
      title: 'Özel Raporlar',
      icon: FileText,
      color: 'from-orange-500 to-red-500',
      features: ['Özelleştirilebilir', 'Filtrelenebilir', 'Export edilebilir']
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
          Raporlama Sistemi
        </span>
      </motion.h2>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
          {reportTypes.map((report, index) => (
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
                  className={`w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 rounded-full bg-gradient-to-r ${report.color} flex items-center justify-center shadow-2xl`}
                >
                  <report.icon size={24} className="text-white drop-shadow-lg" />
                </motion.div>
                <h3 className="text-lg md:text-2xl font-bold text-white text-center mb-3 md:mb-4 group-hover:text-cyan-300 transition-colors">
                  {report.title}
                </h3>
                <ul className="space-y-2">
                  {report.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="text-gray-300 text-center text-xs md:text-sm flex items-center justify-center">
                      <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
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
            <Report className="w-6 h-6 mr-3 text-cyan-400" />
            Rapor İçerikleri
            <Report className="w-6 h-6 ml-3 text-cyan-400" />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/20"
            >
              <h4 className="text-lg md:text-xl font-bold text-cyan-300 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Temel Metrikler
              </h4>
              <ul className="space-y-2 text-gray-300 text-sm md:text-base">
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Toplam üretim miktarı
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Makine çalışma süresi
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Verimlilik oranı
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Duruş süreleri
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Hata oranları
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Enerji tüketimi
                </li>
              </ul>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20"
            >
              <h4 className="text-lg md:text-xl font-bold text-emerald-300 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Gelişmiş Analizler
              </h4>
              <ul className="space-y-2 text-gray-300 text-sm md:text-base">
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Trend analizi
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Karşılaştırmalı raporlar
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Tahminleme modelleri
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Anomali tespiti
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Optimizasyon önerileri
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                  Maliyet analizi
                </li>
              </ul>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default ReportingPage