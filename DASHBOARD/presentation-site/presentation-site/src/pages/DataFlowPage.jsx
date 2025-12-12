import React from 'react'
import { motion } from 'framer-motion'
import { Cpu, Database, Server, BarChart3, ArrowRight, Wifi, Sparkles } from 'lucide-react'

const DataFlowPage = () => {
  const dataFlow = [
    { 
      step: 1, 
      title: 'PLC Veri Toplama', 
      description: 'Lemanic3 PLC\'den gerçek zamanlı veri okuma',
      icon: Cpu,
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      step: 2, 
      title: 'Veri İletişimi', 
      description: 'OPC UA protokolü ile güvenli veri transferi',
      icon: Wifi,
      color: 'from-green-500 to-emerald-500'
    },
    { 
      step: 3, 
      title: 'Veri İşleme', 
      description: '.NET API ile veri işleme ve doğrulama',
      icon: Server,
      color: 'from-purple-500 to-pink-500'
    },
    { 
      step: 4, 
      title: 'Veritabanı Kayıt', 
      description: 'SQL Server\'a güvenli veri saklama',
      icon: Database,
      color: 'from-orange-500 to-red-500'
    },
    { 
      step: 5, 
      title: 'Dashboard Görüntüleme', 
      description: 'React ile gerçek zamanlı veri görselleştirme',
      icon: BarChart3,
      color: 'from-teal-500 to-blue-500'
    }
  ]

  return (
    <div className="h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Animated background */}
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
          className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl"
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
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
        />
      </div>

      <motion.h2
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-6xl font-bold text-center mb-8 md:mb-12 text-white relative z-10"
      >
        <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          Veri Akışı ve İşleme Süreci
        </span>
      </motion.h2>

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="relative">
          {dataFlow.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: index * 0.2, duration: 0.8 }}
              className="flex items-center mb-6 md:mb-8"
            >
              <div className="flex-shrink-0">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center relative z-10 shadow-2xl`}
                >
                  <item.icon size={28} className="text-white drop-shadow-lg" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-black font-bold text-xs md:text-sm">{item.step}</span>
                  </div>
                </motion.div>
              </div>
              
              <div className="ml-4 md:ml-8 flex-1">
                <h3 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2 group-hover:text-cyan-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm md:text-xl text-gray-300 group-hover:text-gray-200 transition-colors">
                  {item.description}
                </p>
              </div>

              {index < dataFlow.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.2 + 0.3 }}
                  className="absolute left-8 md:left-10 top-16 md:top-20 z-0"
                >
                  <ArrowRight size={24} className="text-white/50" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-8 md:mt-12 bg-white/10 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-white/20"
        >
          <h3 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 text-center flex items-center justify-center">
            <Sparkles className="w-5 h-5 mr-2 text-yellow-400" />
            Toplanan Veriler
            <Sparkles className="w-5 h-5 ml-2 text-yellow-400" />
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              'Die Speed (Kalıp Hızı)',
              'Die Counter (Kalıp Sayacı)', 
              'Ethyl Consumption (Etil Tüketimi)',
              'Temperature (Sıcaklık)',
              'Humidity (Nem)',
              'Production Count (Üretim Sayısı)',
              'Machine Status (Makine Durumu)',
              'Error Codes (Hata Kodları)'
            ].map((data, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.4 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="bg-white/5 rounded-lg p-3 text-center border border-white/10 hover:border-white/20 transition-all duration-300"
              >
                <p className="text-white font-medium text-xs md:text-sm">{data}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default DataFlowPage