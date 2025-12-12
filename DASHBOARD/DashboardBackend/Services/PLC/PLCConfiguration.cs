using System;
using System.Collections.Generic;

namespace DashboardBackend.Services.PLC
{
    /// <summary>
    /// PLC konfigürasyon modeli
    /// </summary>
    public class PLCConfiguration
    {
        public List<PLCConnectionConfig> Connections { get; set; } = new List<PLCConnectionConfig>();
        public List<PLCDataDefinitionConfig> DataDefinitions { get; set; } = new List<PLCDataDefinitionConfig>();
        public List<SQLConnectionConfig> SQLConnections { get; set; } = new List<SQLConnectionConfig>();
        public List<APISettingConfig> APISettings { get; set; } = new List<APISettingConfig>();
    }

    public class PLCConnectionConfig
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string IpAddress { get; set; } = string.Empty;
        public int Port { get; set; } = 502;
        public int ReadIntervalMs { get; set; } = 200;
        public string SourceType { get; set; } = "ModbusTCP";
        public bool IsActive { get; set; } = true;
    }

    public class PLCDataDefinitionConfig
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string DataType { get; set; } = string.Empty;
        public int RegisterAddress { get; set; }
        public int RegisterCount { get; set; } = 1;
        public string? ByteOrder { get; set; } = "HighToLow";
        public bool WordSwap { get; set; } = false;
        public string OperationType { get; set; } = string.Empty;
        public int PLCConnectionId { get; set; }
        public bool IsActive { get; set; } = true;
        public string? ApiEndpoint { get; set; } = "/api/data";
    }

    public class SQLConnectionConfig
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Server { get; set; } = string.Empty;
        public string Database { get; set; } = string.Empty;
        public string? Username { get; set; }
        public string? Password { get; set; }
        public int ConnectionTimeout { get; set; } = 30;
        public bool IsActive { get; set; } = true;
    }

    public class APISettingConfig
    {
        public int Id { get; set; }
        public string SettingKey { get; set; } = string.Empty;
        public string SettingValue { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
