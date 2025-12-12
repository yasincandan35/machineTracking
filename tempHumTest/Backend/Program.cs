using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;
using TemperatureHumidityAPI.Data;
using TemperatureHumidityAPI.Services;
using tempHumTest.Backend.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
builder.Services.AddDbContext<TemperatureHumidityContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"), sqlOptions =>
    {
        sqlOptions.CommandTimeout(300); // 5 dakika timeout (300 saniye)
    }));

// Services
builder.Services.AddScoped<IDeviceService, DeviceService>();
builder.Services.AddScoped<ISensorDataService, SensorDataService>();
builder.Services.AddHttpClient("arduino", client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
});
// DevicePollingService devre dışı - Arduino POST atıyor, GET ile çekmeye gerek yok
// builder.Services.AddHostedService<DevicePollingService>();
builder.Services.AddSingleton<ILiveDataCache, LiveDataCache>();

// SignalR (keep-alive/timeouts for stability behind proxy)
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = false;
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.WithOrigins("https://track.bychome.xyz", "http://192.168.1.44:5173")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Logging - appsettings.json'da konfigüre edildi

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Forwarded headers (Cloudflare/Proxy)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseCors("AllowAll");

// Global exception handler
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        
        var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        if (error != null)
        {
            var ex = error.Error;
            await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(new
            {
                error = "Internal Server Error",
                message = ex.Message,
                type = ex.GetType().Name
            }));
        }
    });
});

app.UseAuthorization();
app.MapControllers();

// SignalR Hub
app.MapHub<SensorHub>("/sensorHub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets;
});

// Auto migrate database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TemperatureHumidityContext>();
    context.Database.EnsureCreated();
}

app.Run("http://0.0.0.0:5001");
