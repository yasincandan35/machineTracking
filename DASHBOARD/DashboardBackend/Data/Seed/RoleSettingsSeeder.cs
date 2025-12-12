using System;
using System.Collections.Generic;
using System.Linq;
using DashboardBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Data.Seed
{
    public static class RoleSettingsSeeder
    {
        private static readonly List<string> AllSections = new()
        {
            "home",
            "analysis",
            "reports",
            "feedback",
            "projectTimeline",
            "temperatureHumidity",
            "settings",
            "add",
            "profile",
            "jobPassport",
            "maintenance",
            "admin",
            "database",
            "shifts",
            "machineScreen"
        };

        private static readonly List<string> BaseSections = new()
        {
            "home",
            "analysis",
            "reports",
            "feedback",
            "projectTimeline",
            "settings",
            "add",
            "profile"
        };

        private static List<string> Sections(params string[] extra) =>
            BaseSections.Union(extra).Distinct().ToList();

        private static readonly RoleSetting[] DefaultRoles = new[]
        {
            new RoleSetting
            {
                Name = "admin",
                DisplayName = "Admin",
                TokenLifetimeMinutes = 60 * 24,
                CanCreateUsers = true,
                CanDeleteUsers = true,
                CanManageRoles = true,
                AllowedSections = AllSections.ToList()
            },
            new RoleSetting
            {
                Name = "manager",
                DisplayName = "Manager",
                TokenLifetimeMinutes = 60 * 12,
                CanCreateUsers = true,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections()
            },
            new RoleSetting
            {
                Name = "engineer",
                DisplayName = "Engineer",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("jobPassport", "database", "shifts", "maintenance")
            },
            new RoleSetting
            {
                Name = "technical",
                DisplayName = "Technical",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("database", "shifts", "maintenance")
            },
            new RoleSetting
            {
                Name = "shiftengineer",
                DisplayName = "Vardiya Mühendisi",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("shifts")
            },
            new RoleSetting
            {
                Name = "qualityengineer",
                DisplayName = "Kalite Mühendisi",
                TokenLifetimeMinutes = 60 * 12,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("temperatureHumidity")
            },
            new RoleSetting
            {
                Name = "user",
                DisplayName = "User",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections()
            },
            new RoleSetting
            {
                Name = "machine",
                DisplayName = "Machine",
                TokenLifetimeMinutes = 0, // Süresiz (10 yıl)
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = new List<string>
                {
                    "machineScreen"
                }
            }
        };

        public static async Task SeedAsync(DashboardDbContext context)
        {
            await context.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'[dbo].[RoleSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RoleSettings]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Name] NVARCHAR(100) NOT NULL UNIQUE,
        [DisplayName] NVARCHAR(150) NULL,
        [TokenLifetimeMinutes] INT NOT NULL CONSTRAINT [DF_RoleSettings_TokenLifetimeMinutes] DEFAULT (1440),
        [CanCreateUsers] BIT NOT NULL CONSTRAINT [DF_RoleSettings_CanCreateUsers] DEFAULT (0),
        [CanDeleteUsers] BIT NOT NULL CONSTRAINT [DF_RoleSettings_CanDeleteUsers] DEFAULT (0),
        [CanManageRoles] BIT NOT NULL CONSTRAINT [DF_RoleSettings_CanManageRoles] DEFAULT (0),
        [AllowedSections] NVARCHAR(MAX) NULL
    );
END
ELSE
BEGIN
    IF COL_LENGTH('RoleSettings', 'AllowedSections') IS NULL
    BEGIN
        ALTER TABLE [dbo].[RoleSettings] ADD [AllowedSections] NVARCHAR(MAX) NULL;
    END
END
");

            var rolesInDb = await context.RoleSettings.ToListAsync();
            var existingNames = rolesInDb.Select(r => r.Name.ToLower()).ToList();
            var missingRoles = DefaultRoles
                .Where(r => !existingNames.Contains(r.Name.ToLower()))
                .ToList();

            if (missingRoles.Count > 0)
            {
                var newRoles = missingRoles.Select(r => new RoleSetting
                {
                    Name = r.Name,
                    DisplayName = r.DisplayName,
                    TokenLifetimeMinutes = r.TokenLifetimeMinutes,
                    CanCreateUsers = r.CanCreateUsers,
                    CanDeleteUsers = r.CanDeleteUsers,
                    CanManageRoles = r.CanManageRoles,
                    AllowedSections = r.AllowedSections
                }).ToList();

                context.RoleSettings.AddRange(newRoles);
                rolesInDb.AddRange(newRoles);
                await context.SaveChangesAsync();
            }

            var hasUpdates = false;
            foreach (var defaultRole in DefaultRoles)
            {
                var existing = rolesInDb.FirstOrDefault(r => r.Name.Equals(defaultRole.Name, System.StringComparison.OrdinalIgnoreCase));
                if (existing == null)
                {
                    continue;
                }

                if (string.IsNullOrWhiteSpace(existing.DisplayName) && !string.IsNullOrWhiteSpace(defaultRole.DisplayName))
                {
                    existing.DisplayName = defaultRole.DisplayName;
                    hasUpdates = true;
                }

                // AllowedSections güncellemesi: Eğer boşsa default'u kullan, değilse eksik olanları ekle
                if (existing.AllowedSections == null || existing.AllowedSections.Count == 0)
                {
                    if (defaultRole.AllowedSections != null)
                    {
                        existing.AllowedSections = defaultRole.AllowedSections;
                        hasUpdates = true;
                    }
                }
                else if (defaultRole.AllowedSections != null)
                {
                    // Mevcut listeye eksik olanları ekle (mevcut olanları koru)
                    var existingSections = existing.AllowedSections.ToHashSet(StringComparer.OrdinalIgnoreCase);
                    var defaultSections = defaultRole.AllowedSections.ToHashSet(StringComparer.OrdinalIgnoreCase);
                    var missingSections = defaultSections.Except(existingSections).ToList();
                    
                    if (missingSections.Count > 0)
                    {
                        existing.AllowedSections = existing.AllowedSections.Union(missingSections).ToList();
                        hasUpdates = true;
                    }
                }
            }

            if (hasUpdates)
            {
                await context.SaveChangesAsync();
            }
        }
    }
}


