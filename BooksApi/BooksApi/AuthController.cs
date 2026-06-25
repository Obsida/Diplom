using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using BookStoreApi.Options;
using BookStoreApi.Services;
using BooksApi;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly AppDbContext _db;
    private readonly IJwtService _jwt;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly YandexOAuthOptions _yandexOAuth;
    private readonly IEmailService _emailService;

    public AuthController(
        AppDbContext db,
        IJwtService jwt,
        IHttpClientFactory httpClientFactory,
        IOptions<YandexOAuthOptions> yandexOAuth,
        IEmailService emailService)
    {
        _db = db;
        _jwt = jwt;
        _httpClientFactory = httpClientFactory;
        _yandexOAuth = yandexOAuth.Value;
        _emailService = emailService;
    }

    [HttpPost("register", Name = "Auth_Register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict("Email уже занят");

        var clientRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "client");
        if (clientRole == null)
            return StatusCode(500, "Роль client не найдена. Убедитесь, что справочник ролей заполнен.");

        var user = new User
        {
            Email = req.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            FirstName = req.FirstName,
            LastName = req.LastName,
            MiddleName = req.MiddleName,
            Phone = req.Phone,
            RoleId = clientRole.RoleId
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        await _db.Entry(user).Reference(u => u.Role).LoadAsync();
        var token = _jwt.GenerateToken(user);

        return Ok(new AuthResponse(token, user.Role.Name, user.UserId, user.Email));
    }

    [HttpPost("login", Name = "Auth_Login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        var user = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == req.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized("Неверный email или пароль");

        var token = _jwt.GenerateToken(user);
        return Ok(new AuthResponse(token, user.Role.Name, user.UserId, user.Email));
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null)
            return NotFound("Пользователь с таким email не найден");

        var random = new Random();
        var code = random.Next(100000, 999999).ToString();

        user.PasswordResetCode = code;
        user.PasswordResetExpiry = DateTime.UtcNow.AddMinutes(15);

        await _db.SaveChangesAsync();

        var fullName = $"{user.FirstName} {user.LastName}".Trim();
        if (string.IsNullOrWhiteSpace(fullName))
        {
            fullName = user.Email;
        }

        try
        {
            await _emailService.SendPasswordResetCodeAsync(user.Email, fullName, code);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Не удалось отправить письмо с кодом восстановления: {ex.Message}");
        }

        return Ok(new { message = "Код подтверждения отправлен на почту" });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null)
            return NotFound("Пользователь с таким email не найден");

        if (string.IsNullOrEmpty(user.PasswordResetCode) || user.PasswordResetCode != req.Code)
            return BadRequest("Неверный код подтверждения");

        if (!user.PasswordResetExpiry.HasValue || user.PasswordResetExpiry.Value < DateTime.UtcNow)
            return BadRequest("Срок действия кода подтверждения истек");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        user.PasswordResetCode = null;
        user.PasswordResetExpiry = null;

        await _db.SaveChangesAsync();

        return Ok(new { message = "Пароль успешно изменен" });
    }

    [HttpGet("yandex/start")]
    public IActionResult StartYandexOAuth([FromQuery] string? returnUrl = "/")
    {
        if (!IsYandexOAuthConfigured())
            return BadRequest("Yandex OAuth не настроен. Заполните appsettings.Local.json.");

        var state = EncodeState(NormalizeReturnUrl(returnUrl));
        var query = new Dictionary<string, string?>
        {
            ["response_type"] = "code",
            ["client_id"] = _yandexOAuth.ClientId,
            ["redirect_uri"] = _yandexOAuth.RedirectUri,
            ["state"] = state
        };

        if (!string.IsNullOrWhiteSpace(_yandexOAuth.Scope))
            query["scope"] = _yandexOAuth.Scope;

        var authorizeUrl = QueryHelpers.AddQueryString(_yandexOAuth.AuthorizeUrl, query);
        return Redirect(authorizeUrl);
    }

    [HttpGet("yandex/callback")]
    public async Task<IActionResult> YandexCallback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        [FromQuery(Name = "error_description")] string? errorDescription)
    {
        var returnUrl = DecodeState(state);

        if (!string.IsNullOrWhiteSpace(error))
            return Redirect(BuildFrontendRedirect(returnUrl, authError: errorDescription ?? error));

        if (string.IsNullOrWhiteSpace(code))
            return Redirect(BuildFrontendRedirect(returnUrl, authError: "Яндекс не вернул код авторизации."));

        if (!IsYandexOAuthConfigured())
            return Redirect(BuildFrontendRedirect(returnUrl, authError: "Yandex OAuth не настроен на сервере."));

        try
        {
            var yandexAccessToken = await ExchangeYandexCodeAsync(code);
            var yandexUser = await FetchYandexUserAsync(yandexAccessToken);
            var user = await GetOrCreateYandexUserAsync(yandexUser);

            if (user.Role == null)
                await _db.Entry(user).Reference(u => u.Role).LoadAsync();

            var token = _jwt.GenerateToken(user);
            return Redirect(BuildFrontendRedirect(returnUrl, authToken: token));
        }
        catch (Exception ex)
        {
            return Redirect(BuildFrontendRedirect(returnUrl, authError: ex.Message));
        }
    }

    private bool IsYandexOAuthConfigured() =>
        !string.IsNullOrWhiteSpace(_yandexOAuth.ClientId) &&
        !string.IsNullOrWhiteSpace(_yandexOAuth.ClientSecret) &&
        !string.IsNullOrWhiteSpace(_yandexOAuth.RedirectUri);

    private static string NormalizeReturnUrl(string? returnUrl)
    {
        if (string.IsNullOrWhiteSpace(returnUrl))
            return "/";

        var normalized = returnUrl.Trim();

        if (Uri.TryCreate(normalized, UriKind.Absolute, out _))
            return "/";

        return normalized.StartsWith('/') ? normalized : "/";
    }

    private static string EncodeState(string returnUrl) =>
        WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(returnUrl));

    private static string DecodeState(string? state)
    {
        if (string.IsNullOrWhiteSpace(state))
            return "/";

        try
        {
            var bytes = WebEncoders.Base64UrlDecode(state);
            var returnUrl = Encoding.UTF8.GetString(bytes);
            return NormalizeReturnUrl(returnUrl);
        }
        catch
        {
            return "/";
        }
    }

    private string BuildFrontendRedirect(string returnUrl, string? authToken = null, string? authError = null)
    {
        var frontendBase = string.IsNullOrWhiteSpace(_yandexOAuth.FrontendBaseUrl)
            ? $"{Request.Scheme}://{Request.Host}"
            : _yandexOAuth.FrontendBaseUrl.TrimEnd('/');

        var target = new Uri(new Uri($"{frontendBase}/"), NormalizeReturnUrl(returnUrl).TrimStart('/'));
        var fragment = authToken != null
            ? $"authToken={Uri.EscapeDataString(authToken)}"
            : $"authError={Uri.EscapeDataString(authError ?? "Ошибка авторизации через Яндекс.")}";

        var builder = new UriBuilder(target)
        {
            Fragment = fragment
        };

        return builder.Uri.ToString();
    }

    private async Task<string> ExchangeYandexCodeAsync(string code)
    {
        var client = _httpClientFactory.CreateClient();
        using var response = await client.PostAsync(
            _yandexOAuth.TokenUrl,
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["client_id"] = _yandexOAuth.ClientId,
                ["client_secret"] = _yandexOAuth.ClientSecret,
                ["redirect_uri"] = _yandexOAuth.RedirectUri
            }));

        var payload = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(payload.Length > 0 ? payload : "Не удалось получить OAuth токен Яндекса.");

        var tokenResponse = JsonSerializer.Deserialize<YandexTokenResponse>(payload, JsonOptions);
        if (string.IsNullOrWhiteSpace(tokenResponse?.AccessToken))
            throw new InvalidOperationException("Яндекс не вернул access_token.");

        return tokenResponse.AccessToken;
    }

    private async Task<YandexUserInfoResponse> FetchYandexUserAsync(string accessToken)
    {
        var client = _httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{_yandexOAuth.UserInfoUrl}?format=json");
        request.Headers.Authorization = new AuthenticationHeaderValue("OAuth", accessToken);

        using var response = await client.SendAsync(request);
        var payload = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(payload.Length > 0 ? payload : "Не удалось получить профиль Яндекса.");

        var profile = JsonSerializer.Deserialize<YandexUserInfoResponse>(payload, JsonOptions);
        if (profile == null)
            throw new InvalidOperationException("Яндекс вернул пустой профиль.");

        return profile;
    }

    private async Task<User> GetOrCreateYandexUserAsync(YandexUserInfoResponse profile)
    {
        var email = (profile.DefaultEmail ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(email))
            throw new InvalidOperationException("Яндекс не вернул email пользователя.");

        var user = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user != null)
        {
            if (string.IsNullOrWhiteSpace(user.FirstName) && !string.IsNullOrWhiteSpace(profile.FirstName))
                user.FirstName = profile.FirstName;

            if (string.IsNullOrWhiteSpace(user.LastName) && !string.IsNullOrWhiteSpace(profile.LastName))
                user.LastName = profile.LastName;

            await _db.SaveChangesAsync();
            return user;
        }

        var clientRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "client");
        if (clientRole == null)
            throw new InvalidOperationException("Роль client не найдена.");

        user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
            FirstName = !string.IsNullOrWhiteSpace(profile.FirstName) ? profile.FirstName : profile.DisplayName ?? "Яндекс",
            LastName = profile.LastName ?? "",
            RoleId = clientRole.RoleId
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await _db.Entry(user).Reference(u => u.Role).LoadAsync();
        return user;
    }

    private sealed class YandexTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }
    }

    private sealed class YandexUserInfoResponse
    {
        [JsonPropertyName("default_email")]
        public string? DefaultEmail { get; set; }

        [JsonPropertyName("first_name")]
        public string? FirstName { get; set; }

        [JsonPropertyName("last_name")]
        public string? LastName { get; set; }

        [JsonPropertyName("display_name")]
        public string? DisplayName { get; set; }
    }
}
