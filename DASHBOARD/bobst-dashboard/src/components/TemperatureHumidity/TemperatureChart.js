import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TemperatureChart = ({ data }) => {
  const chartData = data.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    temperature: item.temperature,
    device: item.deviceName
  }));

  return (
    <div className="chart-container">
      <h3 className="chart-title">🌡️ Sıcaklık Trendi</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis label={{ value: 'Sıcaklık (°C)', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            labelFormatter={(value, name, props) => {
              if (!props || !props.payload) return value;
              return [
                `Cihaz: ${props.payload.device || 'Bilinmiyor'}`,
                `Saat: ${value}`
              ];
            }}
            formatter={(value) => [`${value}°C`, 'Sıcaklık']}
          />
          <Line 
            type="monotone" 
            dataKey="temperature" 
            stroke="#ff6b6b" 
            strokeWidth={2}
            dot={{ fill: '#ff6b6b', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#ff6b6b', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TemperatureChart;
