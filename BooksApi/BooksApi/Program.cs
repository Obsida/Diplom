using System.Text;
using BooksApi;
using BookStoreApi.Data;
using BookStoreApi.Options;
using BookStoreApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// ─── DATABASE ────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ─── SERVICES ────────────────────────────────────────────────
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.Configure<YandexOAuthOptions>(builder.Configuration.GetSection("YandexOAuth"));
builder.Services.AddHttpClient();

// ─── AUTHENTICATION / JWT ────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// ─── CONTROLLERS ─────────────────────────────────────────────
builder.Services.AddControllers();

// ─── CORS ────────────────────────────────────────────────────
builder.Services.AddCors(opt =>
    opt.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// ─── SWAGGER ─────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "BookStore API",
        Version = "v1",
        Description = "API для онлайн-магазина книг с ролями: Client, moderator, admin"
    });

    // JWT в Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Введите JWT токен в формате: Bearer {token}"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var emailSettings = builder.Configuration
    .GetSection("EmailSettings")
    .Get<EmailSettings>()!;

builder.Services.AddSingleton(emailSettings);
builder.Services.AddScoped<IEmailService, EmailService>();

var app = builder.Build();

app.UseCors("AllowAll");

// Swagger всегда доступен (не только в Development)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "BookStore API v1");
    c.RoutePrefix = "swagger"; // открывается на /swagger
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();



app.Run();
