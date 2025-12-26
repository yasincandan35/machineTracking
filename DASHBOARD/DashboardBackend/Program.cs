using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using DashboardBackend.Data;
using DashboardBackend.Services;
using DashboardBackend.Services.PLC;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;

var builder = WebApplication.CreateBuilder(args);

// Windows Service desteği
builder.Host.UseWindowsService();

// Firebase Admin SDK'yı başlat
var firebaseServiceAccountPath = builder.Configuration["Firebase:ServiceAccountPath"];
if (string.IsNullOrEmpty(firebaseServiceAccountPath))
{
    // Varsayılan yol
    firebaseServiceAccountPath = "dashboard-e8926-51e93b505f0d.json";
}

// Dosya yolunu mutlak yola çevir
var fullPath = Path.IsPathRooted(firebaseServiceAccountPath) 
    ? firebaseServiceAccountPath 
    : Path.Combine(builder.Environment.ContentRootPath, firebaseServiceAccountPath);

if (File.Exists(fullPath))
{
    try
    {
        FirebaseApp.Create(new AppOptions()
        {
            Credential = GoogleCredential.FromFile(fullPath)
        });
        Console.WriteLine("✅ Firebase Admin SDK başlatıldı. Service Account: " + fullPath);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"⚠️ Firebase Admin SDK başlatılamadı: {ex.Message}");
    }
}
else
{
    Console.WriteLine($"⚠️ Firebase Service Account dosyası bulunamadı: {fullPath}");
    Console.WriteLine("⚠️ Push notification'lar çalışmayabilir.");
}

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// HttpClient logging seviyesini azalt (sadece hataları göster)
builder.Logging.AddFilter("System.Net.Http.HttpClient", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http.HttpClient.Default", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http.HttpClient.Default.LogicalHandler", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http.HttpClient.Default.ClientHandler", LogLevel.Warning);

// Services
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<DashboardBackend.Services.EmailService>();
builder.Services.AddSingleton<DashboardBackend.Services.MachineDatabaseService>();
builder.Services.AddScoped<PrivacyService>();
builder.Services.AddScoped<DashboardBackend.Services.PushNotificationService>();
builder.Services.AddHttpClient(); // HttpClientFactory için

// SQL Server Connections - Dashboard ve SensorDB
builder.Services.AddDbContext<DashboardDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Maintenance ERP DB
builder.Services.AddDbContext<MaintenanceErpDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("MaintenanceErpConnection")));

// SensorDB Context - Artık makine bazlı dinamik olarak oluşturulacak
// Factory pattern ile MachineDatabaseService üzerinden oluşturuluyor

// PLC Data Collector Background Service
builder.Services.AddHostedService<PLCDataCollectorService>();

// Maintenance Reminder Background Service
builder.Services.AddHostedService<MaintenanceReminderService>();

// Custom Notification Background Service
builder.Services.AddHostedService<CustomNotificationService>();

// Job Order Retry Background Service
builder.Services.AddHostedService<JobOrderRetryService>();

// Periodic Snapshot Background Service
builder.Services.AddHostedService<PeriodicSnapshotService>();
builder.Services.AddHostedService<OperatorPerformanceSnapshotService>();

// Machine Idle Monitoring Background Service
builder.Services.AddHostedService<MachineIdleMonitoringService>();

// CORS - Local IP'ler + Production Domain'ler
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
            // Local Development
            "http://localhost:5173",
            "http://192.168.1.44:5173",
            "http://localhost:3000",
            "http://192.168.1.237:3000",
            // Production Domains
            "https://track.bychome.xyz",
            "https://yyc.bychome.xyz",
            "https://basedata.bychome.xyz",
            "https://livedata.bychome.xyz"
        )
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

// JWT Authentication - BobstDashboardAPI ile aynı ayarlar
var jwtKey = builder.Configuration["Jwt:Key"] ?? "yyc_ultimate_jwt_key_super_secure!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "BobstDashboardAPI",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "BobstDashboardClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Seed default role settings
using (var scope = app.Services.CreateScope())
{
    var scopedServices = scope.ServiceProvider;
    var dbContext = scopedServices.GetRequiredService<DashboardDbContext>();
    await DashboardBackend.Data.Seed.RoleSettingsSeeder.SeedAsync(dbContext);
}

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors();

// Static files for admin panel
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// Request logging middleware - Tüm istekleri logla (geliştirme için)
var logger = app.Services.GetRequiredService<ILogger<Program>>();
app.Use(async (context, next) =>
{
    // DELETE isteklerini özellikle logla
    if (context.Request.Method == "DELETE" && context.Request.Path.Value?.Contains("/maintenance/records") == true)
    {
        logger.LogInformation($"[MIDDLEWARE] DELETE isteği geldi: {context.Request.Method} {context.Request.Path}");
        logger.LogInformation($"[MIDDLEWARE] QueryString: {context.Request.QueryString}");
        logger.LogInformation($"[MIDDLEWARE] Headers: Authorization={context.Request.Headers.ContainsKey("Authorization")}");
    }
    await next();
});

app.MapControllers();

// Admin panel route
app.MapGet("/adminpanel", async (HttpContext context) =>
{
    var filePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "adminpanel.html");
    if (File.Exists(filePath))
    {
        context.Response.ContentType = "text/html";
        await context.Response.SendFileAsync(filePath);
    }
    else
    {
        context.Response.StatusCode = 404;
        await context.Response.WriteAsync("Admin panel not found");
    }
});

// Sunucu bilgisi
Console.WriteLine("🚀 Dashboard Backend Starting...");
Console.WriteLine($"📡 Listening on: http://0.0.0.0:5199");
Console.WriteLine($"📡 Local access: http://192.168.1.44:5199");
Console.WriteLine($"📡 Production: https://yyc.bychome.xyz");
Console.WriteLine($"📊 Database: Dashboard (SQL Server)");
Console.WriteLine($"📖 Swagger: http://192.168.1.44:5199/swagger");

app.Run("http://0.0.0.0:5199");



