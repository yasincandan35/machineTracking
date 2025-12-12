using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using DashboardBackend.Data;
using DashboardBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Services
{
    public class TokenService
    {
        private readonly IConfiguration _configuration;
        private readonly DashboardDbContext _context;

        public TokenService(IConfiguration configuration, DashboardDbContext context)
        {
            _configuration = configuration;
            _context = context;
        }

        public async Task<TokenResult> GenerateTokenAsync(User user)
        {
            var utcNow = DateTime.UtcNow;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                _configuration["Jwt:Key"] ?? "yyc_ultimate_jwt_key_super_secure!"
            ));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim("userId", user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role)
            };

            if (user.AssignedMachineId.HasValue)
            {
                claims.Add(new Claim("assignedMachineId", user.AssignedMachineId.Value.ToString()));
            }

            if (!string.IsNullOrWhiteSpace(user.AssignedMachineTable))
            {
                claims.Add(new Claim("assignedMachineTable", user.AssignedMachineTable));
            }

            var roleName = user.Role?.Trim().ToLowerInvariant();
            var roleSetting = await _context.RoleSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Name == roleName);

            var defaultMinutes = _configuration.GetValue<int?>("Jwt:DefaultTokenMinutes") ?? 60;
            var lifetimeMinutes = roleSetting?.TokenLifetimeMinutes ?? defaultMinutes;

            DateTime expiresAtUtc;
            if (lifetimeMinutes <= 0)
            {
                // Süresiz gibi davranalım -> 10 yıl
                expiresAtUtc = utcNow.AddYears(10);
                lifetimeMinutes = 0;
            }
            else
            {
                expiresAtUtc = utcNow.AddMinutes(lifetimeMinutes);
            }

            claims.Add(new Claim("tokenLifetimeMinutes", lifetimeMinutes.ToString()));
            claims.Add(new Claim("tokenIssuedAtUtc", utcNow.ToString("o")));

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"] ?? "BobstDashboardAPI",
                audience: _configuration["Jwt:Audience"] ?? "BobstDashboardClient",
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: credentials
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
            return new TokenResult(tokenString, expiresAtUtc, lifetimeMinutes);
        }
    }

    public record TokenResult(string Token, DateTime ExpiresAtUtc, int LifetimeMinutes);
}
