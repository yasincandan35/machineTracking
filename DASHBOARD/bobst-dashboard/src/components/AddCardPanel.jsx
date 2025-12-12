import React, { useState } from 'react';

export default function AddCardPanel({ onAdd }) {
  const [type, setType] = useState("info");
  const [title, setTitle] = useState("");
  const [endpoint, setEndpoint] = useState("");

  const handleSubmit = () => {
    if (!title || !endpoint) return;
    onAdd({ type, title, endpoint });
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Yeni Kart Ekle</h2>

      <label className="block mb-2 font-medium">Kart Türü</label>
      <select className="border p-2 w-full mb-4" value={type} onChange={e => setType(e.target.value)}>
        <option value="info">Bilgi Kartı</option>
        <option value="graph">Grafik Kartı</option>
      </select>

      <label className="block mb-2 font-medium">Kart Başlığı</label>
      <input className="border p-2 w-full mb-4" value={title} onChange={e => setTitle(e.target.value)} />

      <label className="block mb-2 font-medium">API Endpoint</label>
      <input className="border p-2 w-full" value={endpoint} onChange={e => setEndpoint(e.target.value)} />
      <p className="text-sm text-gray-500 mt-1">
        Örnek: <code>/api/sensors/last24h-minutely</code> <br />
        JSON çıktısı <code>[{"{ name: '10:00', value: 27.5 }"}]</code> formatında olmalıdır.
      </p>

      <button onClick={handleSubmit} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Kartı Ekle</button>
    </div>
  );
}
