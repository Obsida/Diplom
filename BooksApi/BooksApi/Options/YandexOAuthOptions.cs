namespace BookStoreApi.Options;

public class YandexOAuthOptions
{
    public string AuthorizeUrl { get; set; } = "https://oauth.yandex.ru/authorize";
    public string TokenUrl { get; set; } = "https://oauth.yandex.ru/token";
    public string UserInfoUrl { get; set; } = "https://login.yandex.ru/info";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string RedirectUri { get; set; } = "";
    public string FrontendBaseUrl { get; set; } = "http://localhost:5173";
    public string Scope { get; set; } = "login:info login:email";
}
