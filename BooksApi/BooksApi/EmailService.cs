using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace BooksApi
{
    public class EmailSettings
    {
        public string Host { get; set; } = null!;
        public int Port { get; set; }
        public string Username { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string FromName { get; set; } = null!;
    }

    public interface IEmailService
    {
        Task SendPurchaseReceiptAsync(string toEmail, string toName, ReceiptData receipt);
        Task SendDeliveryReceiptAsync(string toEmail, string toName, DeliveryReceiptData receipt);
        Task SendPasswordResetCodeAsync(string toEmail, string toName, string code);
    }

    // ── Чек цифровой покупки ──────────────────────────────────────────
    public class ReceiptData
    {
        public int PurchaseId { get; set; }
        public string BookTitle { get; set; } = null!;
        public string Author { get; set; } = null!;
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public DateTime PurchaseDate { get; set; }
    }

    // ── Чек заказа на доставку ────────────────────────────────────────
    public class DeliveryReceiptData
    {
        public int OrderId { get; set; }
        public string BookTitle { get; set; } = null!;
        public string Author { get; set; } = null!;
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = null!;
        public string DeliveryAddress { get; set; } = null!;
        public DateTime OrderDate { get; set; }
        public string? TrackingNumber { get; set; }
    }

    public class EmailService : IEmailService
    {
        private readonly EmailSettings _settings;

        public EmailService(EmailSettings settings)
        {
            _settings = settings;
        }

        // ── Отправка чека за цифровую покупку ────────────────────────
        public async Task SendPurchaseReceiptAsync(string toEmail, string toName, ReceiptData receipt)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName, _settings.Username));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"Чек №{receipt.PurchaseId} — {receipt.BookTitle}";

            var bodyBuilder = new BodyBuilder { HtmlBody = BuildPurchaseReceiptHtml(receipt) };
            message.Body = bodyBuilder.ToMessageBody();

            await SendAsync(message);
        }

        // ── Отправка чека за заказ доставки ──────────────────────────
        public async Task SendDeliveryReceiptAsync(string toEmail, string toName, DeliveryReceiptData receipt)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName, _settings.Username));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"Заказ №{receipt.OrderId} оформлен — {receipt.BookTitle}";

            var bodyBuilder = new BodyBuilder { HtmlBody = BuildDeliveryReceiptHtml(receipt) };
            message.Body = bodyBuilder.ToMessageBody();

            await SendAsync(message);
        }

        // ── Отправка кода восстановления пароля ──────────────────────
        public async Task SendPasswordResetCodeAsync(string toEmail, string toName, string code)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName, _settings.Username));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"Восстановление пароля — Код подтверждения";

            var bodyBuilder = new BodyBuilder { HtmlBody = BuildPasswordResetHtml(code) };
            message.Body = bodyBuilder.ToMessageBody();

            await SendAsync(message);
        }

        // ── Общая логика SMTP ─────────────────────────────────────────
        private async Task SendAsync(MimeMessage message)
        {
            using var client = new SmtpClient();
            await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.SslOnConnect);
            await client.AuthenticateAsync(_settings.Username, _settings.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }

        // ── HTML: чек цифровой покупки ────────────────────────────────
        private static string BuildPurchaseReceiptHtml(ReceiptData r)
        {
            var html = """
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8"/>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #e8f2ff; padding: 40px 20px; color: #234e70; }
            .wrapper { max-width: 560px; margin: 0 auto; }
            .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(35,78,112,0.12); }
            .header { background: #234e70; padding: 36px 40px; text-align: center; }
            .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; }
            .header p { color: rgba(255,255,255,0.75); font-size: 13px; margin-top: 6px; }
            .badge { display: inline-block; background: #ffffff; color: #234e70; font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 20px; margin-top: 14px; }
            .body { padding: 36px 40px; background: #ffffff; }
            .section-title { font-size: 11px; font-weight: 700; color: #234e70; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; opacity: 0.6; }
            .info-block { background: #e8f2ff; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(35,78,112,0.12); }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-size: 13px; color: #234e70; opacity: 0.65; }
            .info-value { font-size: 13px; color: #234e70; font-weight: 600; }
            .total-block { background: #234e70; border-radius: 10px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
            .total-label { color: rgba(255,255,255,0.8); font-size: 14px; }
            .total-amount { color: #ffffff; font-size: 26px; font-weight: 800; }
            .footer-note { text-align: center; font-size: 12px; color: #234e70; opacity: 0.5; line-height: 1.7; }
            .footer { background: #e8f2ff; padding: 20px 40px; text-align: center; font-size: 11px; color: #234e70; opacity: 0.55; border-top: 1px solid rgba(35,78,112,0.12); }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="card">
              <div class="header">
                <h1>📚 BookStore</h1>
                <p>Подтверждение покупки</p>
                <div class="badge">✓ ОПЛАЧЕНО</div>
              </div>
              <div class="body">
                <p class="section-title">Информация о заказе</p>
                <div class="info-block">
                  <div class="info-row">
                    <span class="info-label">Номер чека:</span>
                    <span class="info-value">{{PURCHASE_ID}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Дата и время:</span>
                    <span class="info-value">{{PURCHASE_DATE}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Способ оплаты:</span>
                    <span class="info-value">{{PAYMENT_METHOD}}</span>
                  </div>
                </div>
                <p class="section-title">Приобретённая книга</p>
                <div class="info-block">
                  <div class="info-row">
                    <span class="info-label">Название:</span>
                    <span class="info-value">{{BOOK_TITLE}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Автор:</span>
                    <span class="info-value">{{AUTHOR}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Тип:</span>
                    <span class="info-value">Цифровая копия</span>
                  </div>
                </div>
                <div class="total-block">
                  <span class="total-label">Итого оплачено:</span>
                  <span class="total-amount">{{AMOUNT}}Р</span>
                </div>
                <p class="footer-note">
                  Книга добавлена в вашу библиотеку.<br/>
                  Вы можете читать её в любое время в личном кабинете.
                </p>
              </div>
              <div class="footer">
                © {{YEAR}} BookStore · Это письмо сформировано автоматически
              </div>
            </div>
          </div>
        </body>
        </html>
        """;

            return html
                .Replace("{{PURCHASE_ID}}", $"#{r.PurchaseId:D6}")
                .Replace("{{PURCHASE_DATE}}", r.PurchaseDate.ToString("dd.MM.yyyy HH:mm"))
                .Replace("{{PAYMENT_METHOD}}", r.PaymentMethod)
                .Replace("{{BOOK_TITLE}}", System.Net.WebUtility.HtmlEncode(r.BookTitle))
                .Replace("{{AUTHOR}}", System.Net.WebUtility.HtmlEncode(r.Author))
                .Replace("{{AMOUNT}}", r.Amount.ToString("F2"))
                .Replace("{{YEAR}}", DateTime.UtcNow.Year.ToString());
        }

        // ── HTML: чек заказа доставки ─────────────────────────────────
        private static string BuildDeliveryReceiptHtml(DeliveryReceiptData r)
        {
            var trackingRow = string.IsNullOrWhiteSpace(r.TrackingNumber)
                ? ""
                : $"""
                  <div class="info-row">
                    <span class="info-label">Трек-номер:</span>
                    <span class="info-value">{System.Net.WebUtility.HtmlEncode(r.TrackingNumber)}</span>
                  </div>
                  """;

            return $$"""
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8"/>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #e8f2ff; padding: 40px 20px; color: #234e70; }
            .wrapper { max-width: 560px; margin: 0 auto; }
            .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(35,78,112,0.12); }
            .header { background: #234e70; padding: 36px 40px; text-align: center; }
            .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; }
            .header p { color: rgba(255,255,255,0.75); font-size: 13px; margin-top: 6px; }
            .badge { display: inline-block; background: #e8f2ff; color: #234e70; font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 20px; margin-top: 14px; }
            .body { padding: 36px 40px; background: #ffffff; }
            .section-title { font-size: 11px; font-weight: 700; color: #234e70; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; opacity: 0.6; }
            .info-block { background: #e8f2ff; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(35,78,112,0.12); }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-size: 13px; color: #234e70; opacity: 0.65; }
            .info-value { font-size: 13px; color: #234e70; font-weight: 600; }
            .address-value { font-size: 13px; color: #234e70; font-weight: 600; text-align: right; max-width: 60%; }
            .total-block { background: #234e70; border-radius: 10px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
            .total-label { color: rgba(255,255,255,0.8); font-size: 14px; }
            .total-amount { color: #ffffff; font-size: 26px; font-weight: 800; }
            .footer-note { text-align: center; font-size: 12px; color: #234e70; opacity: 0.5; line-height: 1.7; }
            .footer { background: #e8f2ff; padding: 20px 40px; text-align: center; font-size: 11px; color: #234e70; opacity: 0.55; border-top: 1px solid rgba(35,78,112,0.12); }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="card">
              <div class="header">
                <h1>📦 BookStore</h1>
                <p>Заказ на доставку оформлен</p>
                <div class="badge">⏳ В ОБРАБОТКЕ</div>
              </div>
              <div class="body">
                <p class="section-title">Информация о заказе</p>
                <div class="info-block">
                  <div class="info-row">
                    <span class="info-label">Номер заказа:</span>
                    <span class="info-value">#{{r.OrderId:D6}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Дата оформления:</span>
                    <span class="info-value">{{r.OrderDate.ToString("dd.MM.yyyy HH:mm")}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Способ оплаты:</span>
                    <span class="info-value">{{System.Net.WebUtility.HtmlEncode(r.PaymentMethod)}}</span>
                  </div>
                  {{trackingRow}}
                </div>
                <p class="section-title">Книга</p>
                <div class="info-block">
                  <div class="info-row">
                    <span class="info-label">Название:</span>
                    <span class="info-value">{{System.Net.WebUtility.HtmlEncode(r.BookTitle)}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Автор:</span>
                    <span class="info-value">{{System.Net.WebUtility.HtmlEncode(r.Author)}}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Тип:</span>
                    <span class="info-value">Печатная копия</span>
                  </div>
                </div>
                <p class="section-title">Доставка</p>
                <div class="info-block">
                  <div class="info-row">
                    <span class="info-label">Адрес доставки:</span>
                    <span class="address-value">{{System.Net.WebUtility.HtmlEncode(r.DeliveryAddress)}}</span>
                  </div>
                </div>
                <div class="total-block">
                  <span class="total-label">Итого к оплате:</span>
                  <span class="total-amount">{{r.Amount.ToString("F2")}}Р</span>
                </div>
                <p class="footer-note">
                  Мы уведомим вас, когда заказ будет отправлен.<br/>
                  Отслеживать статус можно в личном кабинете.
                </p>
              </div>
              <div class="footer">
                © {{DateTime.UtcNow.Year}} BookStore · Это письмо сформировано автоматически
              </div>
            </div>
          </div>
        </body>
        </html>
        """;
        }

        private static string BuildPasswordResetHtml(string code)
        {
            return $$"""
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8"/>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; padding: 40px 20px; color: #1a365d; }
            .wrapper { max-width: 500px; margin: 0 auto; }
            .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(26,54,93,0.08); border: 1px solid #e2e8f0; }
            .header { background: #2b6cb0; padding: 36px 40px; text-align: center; }
            .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; }
            .header p { color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 6px; }
            .body { padding: 36px 40px; background: #ffffff; text-align: center; }
            .intro { font-size: 15px; line-height: 1.6; color: #4a5568; margin-bottom: 24px; text-align: left; }
            .code-container { background: #ebf8ff; border: 2px dashed #4299e1; border-radius: 12px; padding: 20px; margin: 28px 0; display: inline-block; min-width: 200px; }
            .code-text { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2b6cb0; font-family: 'Courier New', Courier, monospace; }
            .warning-text { font-size: 12px; color: #718096; line-height: 1.6; margin-top: 24px; text-align: left; border-top: 1px solid #edf2f7; padding-top: 16px; }
            .footer { background: #f7fafc; padding: 20px 40px; text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="card">
              <div class="header">
                <h1>🔒 BookStore</h1>
                <p>Восстановление доступа к аккаунту</p>
              </div>
              <div class="body">
                <p class="intro">
                  Здравствуйте!<br/><br/>
                  Вы получили это письмо, так как был отправлен запрос на восстановление пароля для вашей учетной записи в BookStore.
                </p>
                <div class="code-container">
                  <div class="code-text">{{code}}</div>
                </div>
                <p class="intro" style="margin-bottom: 0;">
                  Этот код действителен в течение 15 минут. Введите его на странице сброса пароля, чтобы продолжить.
                </p>
                <div class="warning-text">
                  Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо. Ваш пароль останется в безопасности.
                </div>
              </div>
              <div class="footer">
                © {{DateTime.UtcNow.Year}} BookStore · Это письмо сформировано автоматически
              </div>
            </div>
          </div>
        </body>
        </html>
        """;
        }
    }
}