import React from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Droplet } from "lucide-react";

export default function DonutNemCard({ value, style }) {
  const nemValue = parseFloat(value);
  const data = [
    { name: "Nem", value: nemValue },
    { name: "Kalan", value: 100 - nemValue },
  ];
  const COLORS = ["#3B82F6", "#E5E7EB"]; // mavi ve açık gri

  return (
    <div 
      className="relative rounded shadow p-4 bg-white dark:bg-gray-800 dark:text-gray-100 min-h-[200px] mt-4 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* İkon */}
      <div className="absolute right-4 top-4 text-blue-500">
        <Droplet size={32} />
      </div>

      {/* Başlık */}
      <h2 className="text-lg font-semibold mb-2">Canlı Nem (%)</h2>

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
          <Tooltip formatter={(val) => `${val.toFixed(1)}%`} />
        </PieChart>

        {/* Ortadaki Yüzde */}
        <div className="absolute text-2xl font-bold text-blue-500">
          {nemValue.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
