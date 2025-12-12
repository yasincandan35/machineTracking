import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import { Loader2 } from "lucide-react";

export default function DatabaseAdmin() {
  const [machines, setMachines] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState([]);
  const [newColumn, setNewColumn] = useState({ name: "", type: "INT", required: false });
  const [columnList, setColumnList] = useState([]);
  const [newMachine, setNewMachine] = useState({ machineName: "", tableName: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/api/database/machines").then((res) => {
      if (Array.isArray(res.data)) {
        setMachines(res.data);
      } else {
        console.error("Makine listesi array değil:", res.data);
        setMachines([]);
      }
    }).catch((err) => {
      console.error("Makine listesi alınamadı:", err);
      setMachines([]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    setLoading(true);
    api.get(`/api/database/columns?tableName=${selectedTable}`)
      .then((res) => setColumns(res.data))
      .finally(() => setLoading(false));
  }, [selectedTable]);

  const handleDeleteColumn = (col) => {
    if (!window.confirm(`${col} kolonunu silmek istiyor musunuz?`)) return;
    setLoading(true);
    api
      .post("/api/database/drop-column", { tableName: selectedTable, columnName: col })
      .then(() => setColumns((prev) => prev.filter((c) => c !== col)))
      .finally(() => setLoading(false));
  };

  const handleDeleteTable = () => {
    if (!window.confirm(`${selectedTable} tablosunu ve ilişkili makineyi silmek istiyor musunuz?`)) return;
    setLoading(true);
    api
      .post("/api/database/drop-table", { tableName: selectedTable })
      .then(() => {
        setSelectedTable("");
        return api.get("/api/database/machines");
      })
      .then((res) => {
        if (Array.isArray(res.data)) setMachines(res.data);
      })
      .finally(() => setLoading(false));
  };

  const handleAddColumnToList = () => {
    if (!newColumn.name) return alert("Kolon adı boş olamaz");
    setColumnList((prev) => [...prev, newColumn]);
    setNewColumn({ name: "", type: "INT", required: false });
  };

  const handleAddColumnToExistingTable = () => {
    if (!newColumn.name || !selectedTable) return alert("Kolon adı ve tablo seçimi zorunludur");
    setLoading(true);
    api
      .post("/api/database/add-column", { tableName: selectedTable, column: newColumn })
      .then(() => {
        setColumns((prev) => [...prev, newColumn.name]);
        setNewColumn({ name: "", type: "INT", required: false });
      })
      .finally(() => setLoading(false));
  };

  const handleAddMachine = () => {
    if (!newMachine.machineName || !newMachine.tableName) return alert("Makine adı ve tablo adı zorunludur");
    if (columnList.length === 0) return alert("En az bir kolon eklemelisiniz.");
    setLoading(true);
    api.post("/api/database/create", {
      TableName: newMachine.tableName,
      MachineName: newMachine.machineName,
      Columns: columnList
    }).then(() => {
      setNewMachine({ machineName: "", tableName: "" });
      setColumnList([]);
      return api.get("/api/database/machines");
    }).then(res => {
      if (Array.isArray(res.data)) setMachines(res.data);
    }).catch(err => {
      console.error("Makine eklenemedi:", err);
      alert("Makine eklenemedi. Lütfen tablo adının benzersiz olduğuna emin olun.");
    }).finally(() => setLoading(false));
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Veritabanı Yönetimi</h2>

      {loading && (
        <div className="flex items-center gap-2 text-blue-600 font-semibold mb-4">
          <Loader2 className="animate-spin" />
          İşlem yapılıyor, lütfen bekleyin...
        </div>
      )}

      <div className="mb-4 bg-white p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2">Yeni Makine Ekle</h3>

        {columnList.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Eklenen Kolonlar</h4>
            <ul className="list-disc pl-5">
              {columnList.map((col, i) => (
                <li key={i}>{col.name} - {col.type} {col.required ? "(Zorunlu)" : ""}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Kolon adı"
            className="border p-2 flex-1"
            value={newColumn.name}
            onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
          />
          <select
            className="border p-2"
            value={newColumn.type}
            onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
          >
            <option value="INT">INT</option>
            <option value="FLOAT">FLOAT</option>
            <option value="BIT">BIT</option>
            <option value="NVARCHAR(100)">NVARCHAR(100)</option>
            <option value="DATETIME">DATETIME</option>
          </select>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={newColumn.required}
              onChange={(e) => setNewColumn({ ...newColumn, required: e.target.checked })}
            />
            Zorunlu
          </label>
          <button onClick={handleAddColumnToList} className="bg-blue-600 text-white px-4 py-2 rounded">
            Kolon Ekle
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          <input
            type="text"
            placeholder="Makine Adı"
            className="border p-2 flex-1"
            value={newMachine.machineName}
            onChange={(e) => setNewMachine({ ...newMachine, machineName: e.target.value })}
          />
          <input
            type="text"
            placeholder="Tablo Adı"
            className="border p-2 flex-1"
            value={newMachine.tableName}
            onChange={(e) => setNewMachine({ ...newMachine, tableName: e.target.value })}
          />
          <button onClick={handleAddMachine} className="bg-green-600 text-white px-4 py-2 rounded">
            Makine Ekle
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-1 font-semibold">Makine Seçin:</label>
        <select
          className="p-2 border rounded w-full max-w-md"
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
        >
          <option value="">-- Seçiniz --</option>
          {Array.isArray(machines) && machines.map((m) => (
            <option key={m.tableName} value={m.tableName}>
              {m.machineName} ({m.tableName})
            </option>
          ))}
        </select>

        {selectedTable && (
          <button
            onClick={handleDeleteTable}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Bu tabloyu sil
          </button>
        )}
      </div>

      {selectedTable && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-3">Kolonlar</h3>
          <ul className="mb-4">
            {columns.map((col, idx) => (
              <li key={`${col}-${idx}`} className="flex justify-between items-center border-b py-1">
                <span>{col}</span>
                <button onClick={() => handleDeleteColumn(col)} className="text-red-500 hover:underline">
                  Sil
                </button>
              </li>
            ))}
          </ul>

          <h4 className="font-semibold mb-2">Yeni Kolon Ekle</h4>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Kolon adı"
              className="border p-2 flex-1"
              value={newColumn.name}
              onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
            />
            <select
              className="border p-2"
              value={newColumn.type}
              onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
            >
              <option value="INT">INT</option>
              <option value="FLOAT">FLOAT</option>
              <option value="BIT">BIT</option>
              <option value="NVARCHAR(100)">NVARCHAR(100)</option>
              <option value="DATETIME">DATETIME</option>
            </select>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={newColumn.required}
                onChange={(e) => setNewColumn({ ...newColumn, required: e.target.checked })}
              />
              Zorunlu
            </label>
            <button onClick={handleAddColumnToExistingTable} className="bg-blue-600 text-white px-4 py-2 rounded">
              Kolon Ekle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
