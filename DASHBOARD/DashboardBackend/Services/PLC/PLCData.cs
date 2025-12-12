using System;

namespace DashboardBackend.Services.PLC
{
    /// <summary>
    /// PLC'den gelen veri modeli - Tamamen dinamik
    /// </summary>
    public class PLCData
    {
        public DateTime Timestamp { get; set; }
        
        // Dinamik veri dictionary'si - veritabanındaki isimlerle aynı
        public Dictionary<string, object> Data { get; set; } = new Dictionary<string, object>();
        
        // Eski property'ler için backward compatibility (deprecated)
        public int machineSpeed => GetValue<int>("machineSpeed");
        public int machineDieCounter => GetValue<int>("machineDieCounter");
        public float ethylAlcoholConsumption => GetValue<float>("ethylAlcoholConsumption");
        public float ethylAcetateConsumption => GetValue<float>("ethylAcetateConsumption");
        public float lastStopTime => GetValue<float>("lastStopTime");
        public float stoppageDuration => GetValue<float>("stoppageDuration");
        public float MTBFValue => GetValue<float>("MTBFValue");
        public int lastStopEpoch => GetValue<int>("lastStopEpoch");
        public int dieSpeed => GetValue<int>("dieSpeed");
        public float paperConsumption => GetValue<float>("paperConsumption");
        public int actualProduction => GetValue<int>("actualProduction");
        public int remainingWork => GetValue<int>("remainingWork");
        public int estimatedTime => GetValue<int>("estimatedTime");
        public int totalStops => GetValue<int>("totalStops");
        public int setupStops => GetValue<int>("setupStops");
        public int faultStops => GetValue<int>("faultStops");
        public int qualityStops => GetValue<int>("qualityStops");
        public bool machineStopped => GetMachineStoppedValue();
        public int machineStatus => GetMachineStatusValue();
        public float wastageBeforeDie => GetValue<float>("wastageBeforeDie");
        public int wastageAfterDie => GetValue<int>("wastageAfterDie");
        public float wastageRatio => GetValue<float>("wastageRatio");
        public float totalStoppageDuration => GetValue<float>("totalStoppageDuration");
        public int overProduction => GetValue<int>("overProduction");
        public float completionPercentage => GetValue<float>("completionPercentage");
        public float overallOEE => GetValue<float>("overallOEE");
        public float availability => GetValue<float>("availability");
        public float performance => GetValue<float>("performance");
        public float quality => GetValue<float>("quality");
        public float uretimHizAdetDakika => GetValue<float>("uretimHizAdetDakika");
        public float hedefUretimHizAdetDakika => GetValue<float>("hedefUretimHizAdetDakika");
        public float plannedTime => GetValue<float>("plannedTime");
        public float randomTestReal => GetValue<float>("randomTestReal");
        
        // Dinamik değer alma metodu
        private T GetValue<T>(string key)
        {
            if (Data.ContainsKey(key))
            {
                try
                {
                    return (T)Convert.ChangeType(Data[key], typeof(T));
                }
                catch
                {
                    return default(T);
                }
            }
            return default(T);
        }

        private bool GetMachineStoppedValue()
        {
            if (TryConvertToBool(GetRawValue("machineStopped"), out var stopped))
            {
                return stopped;
            }

            if (TryConvertToBool(GetRawValue("machineStatus"), out var statusAsBool))
            {
                return statusAsBool;
            }

            if (GetRawValue("machineStatus") is int statusInt)
            {
                return (statusInt & 0x0001) != 0;
            }

            return false;
        }

        private int GetMachineStatusValue()
        {
            var rawStatus = GetRawValue("machineStatus");
            if (TryConvertToInt(rawStatus, out var statusInt))
            {
                return statusInt;
            }

            var rawStopped = GetRawValue("machineStopped");
            if (TryConvertToBool(rawStopped, out var stoppedBool))
            {
                return stoppedBool ? 1 : 0;
            }

            if (TryConvertToInt(rawStopped, out var stoppedInt))
            {
                return stoppedInt;
            }

            return 0;
        }

        private object? GetRawValue(string key)
        {
            if (Data.TryGetValue(key, out var value))
            {
                return value;
            }

            return null;
        }

        private static bool TryConvertToBool(object? value, out bool result)
        {
            result = false;
            if (value == null)
            {
                return false;
            }

            switch (value)
            {
                case bool b:
                    result = b;
                    return true;
                case int i:
                    result = i != 0;
                    return true;
                case long l:
                    result = l != 0;
                    return true;
                case short s:
                    result = s != 0;
                    return true;
                case byte b8:
                    result = b8 != 0;
                    return true;
                case float f:
                    result = Math.Abs(f) > 0.0001f;
                    return true;
                case double d:
                    result = Math.Abs(d) > 0.0001d;
                    return true;
                case decimal m:
                    result = m != 0m;
                    return true;
                case string str:
                    if (bool.TryParse(str, out var parsedBool))
                    {
                        result = parsedBool;
                        return true;
                    }
                    if (int.TryParse(str, out var parsedInt))
                    {
                        result = parsedInt != 0;
                        return true;
                    }
                    break;
            }

            return false;
        }

        private static bool TryConvertToInt(object? value, out int result)
        {
            result = 0;
            if (value == null)
            {
                return false;
            }

            switch (value)
            {
                case int i:
                    result = i;
                    return true;
                case long l:
                    result = (int)l;
                    return true;
                case short s:
                    result = s;
                    return true;
                case byte b8:
                    result = b8;
                    return true;
                case bool b:
                    result = b ? 1 : 0;
                    return true;
                case float f:
                    result = (int)f;
                    return true;
                case double d:
                    result = (int)d;
                    return true;
                case decimal m:
                    result = (int)m;
                    return true;
                case string str when int.TryParse(str, out var parsedInt):
                    result = parsedInt;
                    return true;
            }

            return false;
        }
        
        // Dinamik değer set etme metodu
        public void SetValue(string key, object value)
        {
            Data[key] = value;
        }

        public PLCData()
        {
            Timestamp = DateTime.Now;
        }

        /// <summary>
        /// Veri değişiklik kontrolü (tekrarlanan veri çekmeleri önlemek için)
        /// </summary>
        public bool HasChanged(PLCData other)
        {
            if (other == null) return true;

            // Sadece grafik için gerekli veriler kontrol edilir
            return machineSpeed != other.machineSpeed ||
                   dieSpeed != other.dieSpeed;
        }

        /// <summary>
        /// Veriyi kopyala - Dinamik
        /// </summary>
        public PLCData Clone()
        {
            var cloned = new PLCData
            {
                Timestamp = this.Timestamp
            };
            
            // Dictionary'yi kopyala
            foreach (var kvp in this.Data)
            {
                cloned.Data[kvp.Key] = kvp.Value;
            }
            
            return cloned;
        }
    }
} 