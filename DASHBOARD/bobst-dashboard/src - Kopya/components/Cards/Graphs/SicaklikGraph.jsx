import React, { useState, useEffect, useRef } from 'react';
import { getTranslation } from '../../../utils/translations';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Maximize2 } from 'lucide-react';

export default function SicaklikGraph({ data, isDark = false, style, lineColor = "#ff6b35", currentLanguage = 'tr' }) {
  const containerRef = useRef(null);
  const [yDomain, setYDomain] = useState([0, 50]);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = Math.sign(Math.round(e.deltaY));
    setYDomain(([min, max]) => {
	  const range = max - min;
      const factor = 1 * delta;
      const newMin = min + factor;
      const newMax = max - factor;
      if (newMax - newMin < 1) return [min, max];
      return [newMin, newMax];
    });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wheelHandler = (e) => handleWheel(e);
    el.addEventListener("wheel", wheelHandler, { passive: false });

    return () => {
      el.removeEventListener("wheel", wheelHandler);
    };
  }, []);

  const xAxisProps = {
    dataKey: "name",
    tickFormatter: (value) => {
      const date = new Date(value);
      return date.toLocaleString("tr-TR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    },
    tick: { angle: -45, textAnchor: "end", fontSize: 9 },
    stroke: isDark ? "#d1d5db" : "#374151"
  };

  const tooltipProps = {
    labelFormatter: (value, entry) => {
      const date = entry?.[0]?.payload?.kayitZamani;
      return date
        ? new Date(date).toLocaleString("tr-TR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          })
        : value;
    },
    contentStyle: {
      backgroundColor: isDark ? "#111827" : "#ffffff",
      borderColor: isDark ? "#374151" : "#ccc",
      color: isDark ? "#f9fafb" : "#000000"
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className="relative rounded shadow p-7 bg-white dark:bg-gray-800 dark:text-gray-100 hover:shadow-lg transition-all duration-200"
        style={style}
      >
        <button
          onClick={() => setIsZoomed(true)}
          className="absolute top-1 left-1 z-10 p-1 bg-white dark:bg-gray-700 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-110 cursor-pointer"
        >
          <Maximize2 size={12} />
        </button>
        <h3 className="text-md font-semibold mb-2">{getTranslation('temperature', currentLanguage)}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart 
            data={data} 
            margin={{ bottom: 50 }} 
            style={{ 
              backgroundColor: isDark ? "#1f2937" : (style?.backgroundColor || "#ffffff"),
              borderRadius: "8px"
            }}
            key={data.length} // Force re-render when data changes
          >
            <XAxis {...xAxisProps} />
            <YAxis domain={yDomain} stroke={isDark ? "#d1d5db" : "#374151"} />
            <CartesianGrid stroke={isDark ? "#4b5563" : "#e5e7eb"} strokeDasharray="3 3" />
            <Tooltip {...tooltipProps} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={lineColor} 
              dot={false} 
              isAnimationActive={true}
              animationDuration={2000}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
        >
          <div
            className="bg-white dark:bg-gray-800 dark:text-gray-100 rounded shadow-lg p-6 w-11/12 md:w-3/4 lg:w-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">{getTranslation('temperature', currentLanguage)} - {getTranslation('wideView', currentLanguage)}</h3>
            <ResponsiveContainer width="100%" height={600}>
              <LineChart 
                data={data} 
                margin={{ bottom: 60 }} 
                style={{ 
                  backgroundColor: isDark ? "#1f2937" : (style?.backgroundColor || "#ffffff"),
                  borderRadius: "8px"
                }}
                key={data.length} // Force re-render when data changes
              >
                <XAxis {...xAxisProps} />
                <YAxis domain={yDomain} stroke={isDark ? "#d1d5db" : "#374151"} />
                <CartesianGrid stroke={isDark ? "#4b5563" : "#e5e7eb"} strokeDasharray="3 3" />
                <Tooltip {...tooltipProps} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={lineColor} 
                  strokeWidth={2} 
                  dot={false} 
                  isAnimationActive={true}
                  animationDuration={2000}
                  animationEasing="ease-in-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
