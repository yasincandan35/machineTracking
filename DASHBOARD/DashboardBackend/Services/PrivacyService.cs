using System.Text.Json;
using System.Text.Json.Serialization;
using DashboardBackend.Models;

namespace DashboardBackend.Services
{
    public class PrivacyService
    {
        public class PrivacyConfig
        {
            [JsonPropertyName("maskJobCardSensitive")]
            public bool MaskJobCardSensitive { get; set; } = false;

            [JsonPropertyName("maskReportsJobFields")]
            public bool MaskReportsJobFields { get; set; } = false;

            [JsonPropertyName("hideFeedbackContent")]
            public bool HideFeedbackContent { get; set; } = false;
        }

        public PrivacyConfig GetPrivacy(User? user)
        {
            if (user == null)
            {
                return new PrivacyConfig();
            }

            if (!user.IsDemo)
            {
                return new PrivacyConfig();
            }

            if (string.IsNullOrWhiteSpace(user.PrivacySettings))
            {
                return new PrivacyConfig();
            }

            try
            {
                var cfg = JsonSerializer.Deserialize<PrivacyConfig>(user.PrivacySettings);
                return cfg ?? new PrivacyConfig();
            }
            catch
            {
                return new PrivacyConfig();
            }
        }

        public string MaskString(string? input, int visiblePrefix = 0)
        {
            if (string.IsNullOrEmpty(input))
            {
                return input ?? string.Empty;
            }

            if (visiblePrefix <= 0)
            {
                return new string('*', Math.Min(input.Length, 5));
            }

            var prefix = input.Length <= visiblePrefix ? input : input.Substring(0, visiblePrefix);
            var maskCount = Math.Max(3, input.Length - prefix.Length);
            return prefix + new string('*', maskCount);
        }
    }
}


