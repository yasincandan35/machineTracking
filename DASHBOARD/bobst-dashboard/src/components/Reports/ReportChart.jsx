import React, { useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';

export default function ReportChart({ data, title, dataKey, onCapture }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      // Canvas renderının tamamlanmasını bekleyip görüntüyü yakala
      setTimeout(() => {
        html2canvas(chartRef.current, { scale: 2 }).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          if (onCapture) onCapture(title, imgData);
        });
      }, 500);
    }
  }, [data]);

  const chartData = data.map(entry => ({
    name: new Date(entry.kayitZamani).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: Number(entry[dataKey]?.toFixed(2)) || 0,
  }));

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <div ref={chartRef} style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0088FE" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
