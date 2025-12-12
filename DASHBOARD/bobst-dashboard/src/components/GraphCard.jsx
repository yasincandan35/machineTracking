import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const colors = ['#0088FE', '#00C49F', '#FFBB28'];

export default function GraphCard({ title, data, type = "line" }) {
  return (
    <div className="rounded shadow p-4 bg-white">
      <h3 className="text-md font-semibold mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        {type === "pie" ? (
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : (
          <LineChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={colors[0]} dot />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
