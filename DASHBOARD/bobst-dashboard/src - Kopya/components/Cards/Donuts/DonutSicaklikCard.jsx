import React from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Thermometer } from "lucide-react";

export default function DonutSicaklikCard({ value, style }) {
  const sicaklikValue = parseFloat(value);
  const data = [
    { name: "Sıcaklık", value: sicaklikValue },
    { name: "Kalan", value: 50 - sicaklikValue },
  ];
  const COLORS = ["#EF4444", "#E5E7EB"]; // kırmızı ve açık gri

  return (
    <div 
      className="relative rounded shadow p-4 bg-white dark:bg-gray-800 dark:text-gray-100 min-h-[200px] mt-4 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* İkon */}
      <div className="absolute right-4 top-4 text-red-500">
        <Thermometer size={32} />
      </div>

      {/* Başlık */}
      <h2 className="text-lg font-semibold mb-2">Canlı Sıcaklık (°C)</h2>

      <div className="flex items-center justify-center relative">
        <PieChart width={160} height={160}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val) => `${val.toFixed(1)}°C`} />
        </PieChart>

        {/* Ortadaki Yüzde */}
        <div className="absolute text-2xl font-bold text-red-500">
          {sicaklikValue.toFixed(1)}°C
        </div>
      </div>
    </div>
  );
}
