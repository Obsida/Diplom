using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using BookStoreApi.Data;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiAssistantController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public AiAssistantController(AppDbContext db, IConfiguration config, HttpClient httpClient)
    {
        _db = db;
        _config = config;
        _httpClient = httpClient;
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string FileName, byte[] Data)> TempFiles = new();

    [HttpPost("upload-temp")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UploadTempFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("Файл не выбран или пуст");
        }

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var bytes = ms.ToArray();

        var ext = Path.GetExtension(file.FileName);
        var fileId = Guid.NewGuid().ToString("N") + ext;

        TempFiles[fileId] = (file.FileName, bytes);

        return Ok(new { fileId = fileId, originalName = file.FileName });
    }

    public record ChatRequest(string Message);
    public record ChatResponse(string Response, bool HasChanges = false);

    [HttpPost("chat")]
    public async Task<ActionResult<ChatResponse>> Chat([FromBody] ChatRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message))
        {
            return BadRequest("Сообщение не может быть пустым");
        }

        // Выполняем ручную аутентификацию токена Jwt, так как роут доступен анонимно для клиентов
        var authResult = await HttpContext.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
        var isStaff = false;
        var isAdmin = false;
        System.Security.Claims.ClaimsPrincipal userPrincipal = null;

        if (authResult.Succeeded)
        {
            userPrincipal = authResult.Principal;
            isAdmin = userPrincipal.IsInRole("admin");
            isStaff = isAdmin || userPrincipal.IsInRole("meneger");
        }

        string systemInstruction;
        JsonArray toolsJsonArray = null;

        if (isAdmin)
        {
            // Для администраторов загружаем списки авторов, категорий, подкатегорий и книг для контекста
            var authors = await _db.Authors.Select(a => new { a.AuthorId, a.FullName, a.BirthYear, a.DeathYear }).ToListAsync();
            var categories = await _db.Categories.Select(c => new { c.CategoryId, c.Name }).ToListAsync();
            var subcategories = await _db.Subcategories.Select(s => new { s.SubcategoryId, s.CategoryId, s.Name }).ToListAsync();
            var books = await _db.Books.Select(b => new { b.BookId, b.Title, b.AuthorId, b.IsActive }).ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("Ты — умный ИИ-помощник администратора книжного магазина. У тебя есть доступ к инструментам управления каталогом: создание и редактирование авторов, создание категорий, подкатегорий и книг, архивация/разархивация книг, а также изменение статусов заказов.");
            sb.AppendLine("Используй вызовы функций для выполнения действий, когда администратор просит тебя добавить/создать или изменить сущность.");
            sb.AppendLine("При добавлении книги, если указанные автор/категория/подкатегория еще не существуют, сначала создай их с помощью соответствующих вызовов функций (если у тебя есть достаточная информация), либо попроси администратора сначала создать их.");
            sb.AppendLine("Если администратор просит добавить автора (например, 'добавь Пушкина'), но не указывает даты рождения/смерти или биографию, ты ОБЯЗАТЕЛЬНО должен использовать инструмент `search_web`, чтобы найти о нем информацию (даты рождения, смерти и описание/биографию), а затем вызвать `create_author` с заполненными полями.");
            sb.AppendLine("Если администратор просит тебя отредактировать авторов, у которых нет дат жизни, ты должен сначала найти недостающие даты через `search_web` (если они тебе неизвестны), а затем вызвать `update_author` для каждого такого автора.");
            sb.AppendLine("Если администратор просит заархивировать книги определенного автора/категории или конкретные книги, вызови инструмент `archive_books` с соответствующими параметрами.");
            sb.AppendLine("При создании категорий (инструмент `create_category`) и подкатегорий (инструмент `create_subcategory`), если администратор не предоставил описание (description) сам, ты должен обязательно сам сформулировать подходящее, емкое и привлекательное описание для этой категории или подкатегории на русском языке (без использования эмодзи) и передать его в соответствующий параметр функции.");
            sb.AppendLine("Если администратор прикрепил файлы (обложка, PDF, аудио), в конце сообщения пользователя будет указан блок в формате: [Uploaded Files: Cover = fileId, PDF = fileId, Audio = fileId]. Сопоставь эти fileId и передай их в параметры `coverFileName`, `pdfFileName`, `audioFileName` функции `create_book`.");
            sb.AppendLine("Если администратор просит добавить книги определенного автора (например, 'Добавь книгу такого автора {Имя автора}' или 'найди новые книги автора...'):");
            sb.AppendLine("  1. Проверь по имени, есть ли этот автор в нашей системе. Если его нет, найди информацию о нем через `search_web` и сначала создай автора с помощью `create_author`. Если автор уже есть, используй его ID.");
            sb.AppendLine("  2. Используй `search_web` для поиска списка книг (библиографии) этого автора.");
            sb.AppendLine("  3. Сравни этот список с книгами этого автора, которые уже есть в системе (они перечислены в списке ниже). Определи, какие из его книг отсутствуют в нашей системе.");
            sb.AppendLine("  4. Предложи администратору список отсутствующих книг (выведи их списком) и попроси его выбрать ОДНУ из них для добавления.");
            sb.AppendLine("  5. Когда администратор выберет конкретную книгу (укажет название или номер), добавь её с помощью `create_book`. При этом:");
            sb.AppendLine("     - Передай `isActive = false`, чтобы книга автоматически архивировалась.");
            sb.AppendLine("     - Не передавай `coverFileName`, `pdfFileName` или `audioFileName` (книга добавляется без обложки, PDF и аудио).");
            sb.AppendLine("     - Найди год публикации, синопсис и издателя через `search_web` или сгенерируй/подбери подходящие значения, укажи цену 0 или 299 рублей, количество на складе 0.");
            sb.AppendLine("     - Выбери наиболее подходящую категорию и подкатегорию из существующих (или создай новые через `create_category`/`create_subcategory`, если ни одна не подходит).");

            sb.AppendLine("\nТекущие авторы в системе:");
            foreach (var a in authors)
            {
                var dates = (a.BirthYear != null || a.DeathYear != null)
                    ? $" ({a.BirthYear?.Year.ToString() ?? "?"} - {a.DeathYear?.Year.ToString() ?? "?"})"
                    : " (нет дат)";
                sb.AppendLine($"- ID: {a.AuthorId}, Имя: \"{a.FullName}\"{dates}");
            }

            sb.AppendLine("\nТекущие категории в системе:");
            foreach (var c in categories) sb.AppendLine($"- ID: {c.CategoryId}, Название: \"{c.Name}\"");

            sb.AppendLine("\nТекущие подкатегории в системе:");
            foreach (var s in subcategories) sb.AppendLine($"- ID: {s.SubcategoryId}, Категория ID: {s.CategoryId}, Название: \"{s.Name}\"");

            sb.AppendLine("\nТекущие книги в системе:");
            foreach (var b in books)
            {
                var status = b.IsActive ? "активна" : "в архиве";
                sb.AppendLine($"- ID: {b.BookId}, Название: \"{b.Title}\", Автор ID: {b.AuthorId}, Статус: {status}");
            }

            sb.AppendLine("\nИнструкции по ответам:");
            sb.AppendLine("1. Отвечай кратко на русском языке.");
            sb.AppendLine("2. После успешного создания сущности выведи подтверждение с указанием присвоенного ID.");

            systemInstruction = sb.ToString();

            // Создаем JSON-декларацию инструментов для Gemini (Admin)
            var functionDeclarations = new JsonArray
            {
                new JsonObject
                {
                    ["name"] = "search_web",
                    ["description"] = "Ищет информацию в Википедии по указанному запросу. Используйте для поиска дат жизни и биографии авторов, если они не предоставлены.",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["query"] = new JsonObject { ["type"] = "STRING", ["description"] = "Поисковый запрос на русском языке (например, 'Александр Пушкин')." }
                        },
                        ["required"] = new JsonArray { "query" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "create_author",
                    ["description"] = "Добавляет нового автора в базу данных.",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["fullName"] = new JsonObject { ["type"] = "STRING", ["description"] = "Полное имя автора (обязательно)." },
                            ["birthYear"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Год рождения автора (число)." },
                            ["deathYear"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Год смерти автора (число)." },
                            ["biography"] = new JsonObject { ["type"] = "STRING", ["description"] = "Биография/краткое описание автора." }
                        },
                        ["required"] = new JsonArray { "fullName" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "create_category",
                    ["description"] = "Добавляет новую категорию книг в базу данных.",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["name"] = new JsonObject { ["type"] = "STRING", ["description"] = "Название категории." },
                            ["description"] = new JsonObject { ["type"] = "STRING", ["description"] = "Описание категории. Сгенерируй его сам на русском языке, если администратор не предоставил его." }
                        },
                        ["required"] = new JsonArray { "name" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "create_subcategory",
                    ["description"] = "Добавляет новую подкатегорию, привязанную к существующей категории.",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["name"] = new JsonObject { ["type"] = "STRING", ["description"] = "Название подкатегории." },
                            ["categoryId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID родительской категории." },
                            ["description"] = new JsonObject { ["type"] = "STRING", ["description"] = "Описание подкатегории. Сгенерируй его сам на русском языке, если администратор не предоставил его." }
                        },
                        ["required"] = new JsonArray { "name", "categoryId" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "create_book",
                    ["description"] = "Добавляет новую книгу в базу данных.",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["title"] = new JsonObject { ["type"] = "STRING", ["description"] = "Название книги." },
                            ["authorId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID автора." },
                            ["categoryId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID категории." },
                            ["subcategoryId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID подкатегории." },
                            ["publicationYear"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Год публикации (число)." },
                            ["publisher"] = new JsonObject { ["type"] = "STRING", ["description"] = "Издательство." },
                            ["synopsis"] = new JsonObject { ["type"] = "STRING", ["description"] = "Синопсис/описание книги." },
                            ["price"] = new JsonObject { ["type"] = "NUMBER", ["description"] = "Цена книги (число, рубли)." },
                            ["stockQuantity"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Количество на складе." },
                            ["coverFileName"] = new JsonObject { ["type"] = "STRING", ["description"] = "ID временного файла обложки (если загружен)." },
                            ["pdfFileName"] = new JsonObject { ["type"] = "STRING", ["description"] = "ID временного файла PDF (если загружен)." },
                            ["audioFileName"] = new JsonObject { ["type"] = "STRING", ["description"] = "ID временного файла аудиокниги (если загружен)." },
                            ["isActive"] = new JsonObject { ["type"] = "BOOLEAN", ["description"] = "Статус активности книги. Передайте false для автоматической архивации (по умолчанию true)." }
                        },
                        ["required"] = new JsonArray { "title", "authorId", "categoryId", "subcategoryId", "publicationYear", "publisher", "synopsis", "price", "stockQuantity" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "update_delivery_order_status",
                    ["description"] = "Обновляет статус одного или нескольких заказов доставки на 'created', 'shipped', 'delivered', или 'cancelled'.",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["orderIds"] = new JsonObject
                            {
                                ["type"] = "ARRAY",
                                ["items"] = new JsonObject { ["type"] = "INTEGER" },
                                ["description"] = "Массив ID заказов (например, [1, 2, 3]) для которых нужно обновить статус."
                            },
                            ["status"] = new JsonObject
                            {
                                ["type"] = "STRING",
                                ["enum"] = new JsonArray { "created", "shipped", "delivered", "cancelled" },
                                ["description"] = "Новый статус для указанных заказов."
                            }
                        },
                        ["required"] = new JsonArray { "orderIds", "status" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "update_author",
                    ["description"] = "Обновляет существующего автора в базе данных (например, добавляет даты жизни или редактирует имя/биографию).",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["authorId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID автора для редактирования (обязательно)." },
                            ["fullName"] = new JsonObject { ["type"] = "STRING", ["description"] = "Новое полное имя автора." },
                            ["birthYear"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Новый год рождения автора (число)." },
                            ["deathYear"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Новый год смерти автора (число)." },
                            ["biography"] = new JsonObject { ["type"] = "STRING", ["description"] = "Новая биография/описание автора." }
                        },
                        ["required"] = new JsonArray { "authorId" }
                    }
                },
                new JsonObject
                {
                    ["name"] = "archive_books",
                    ["description"] = "Архивирует или разархивирует книги в зависимости от фильтров (по автору, категории, подкатегории или списку ID книг).",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["archive"] = new JsonObject { ["type"] = "BOOLEAN", ["description"] = "true для архивации (IsActive = false), false для восстановления/разархивации (IsActive = true) (обязательно)." },
                            ["authorId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID автора для архивации/разархивации всех его книг." },
                            ["bookIds"] = new JsonObject
                            {
                                ["type"] = "ARRAY",
                                ["items"] = new JsonObject { ["type"] = "INTEGER" },
                                ["description"] = "Массив ID конкретных книг для архивации/разархивации."
                            },
                            ["categoryId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID категории для архивации/разархивации всех книг в ней." },
                            ["subcategoryId"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "ID подкатегории для архивации/разархивации всех книг в ней." }
                        },
                        ["required"] = new JsonArray { "archive" }
                    }
                }
            };

            toolsJsonArray = new JsonArray { new JsonObject { ["functionDeclarations"] = functionDeclarations } };
        }
        else if (isStaff)
        {
            // Для менеджеров загружаем список заказов доставки
            var orders = await _db.DeliveryOrders
                .Include(o => o.Book)
                .OrderByDescending(o => o.OrderDate)
                .Take(100)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("Ты — умный ИИ-помощник менеджера книжного магазина. У тебя есть доступ к инструменту для изменения статусов заказов доставки.");
            sb.AppendLine("Список текущих заказов в системе:");
            foreach (var order in orders)
            {
                sb.AppendLine($"- ID: {order.OrderId}, Книга: \"{order.Book.Title}\", Текущий статус: \"{order.Status}\", Адрес: \"{order.DeliveryAddress}\", Дата: {order.OrderDate:dd.MM.yyyy}");
            }
            sb.AppendLine();
            sb.AppendLine("Инструкции:");
            sb.AppendLine("1. Если менеджер просит изменить статус заказа или группы заказов, обязательно вызови функцию `update_delivery_order_status` с указанием массива ID заказов и нового статуса.");
            sb.AppendLine("2. Допустимые статусы: created, shipped, delivered, cancelled.");
            sb.AppendLine("3. После успешного изменения статуса система автоматически выполнит действия. Отвечай кратко на русском языке.");

            systemInstruction = sb.ToString();

            // Менеджер может ТОЛЬКО обновлять статусы заказов
            var functionDeclarations = new JsonArray
            {
                new JsonObject
                {
                    ["name"] = "update_delivery_order_status",
                    ["description"] = "Обновляет статус одного или нескольких заказов доставки на 'created', 'shipped', 'delivered', или 'cancelled'.",
                    ["parameters"] = new JsonObject
                    {
                        ["type"] = "OBJECT",
                        ["properties"] = new JsonObject
                        {
                            ["orderIds"] = new JsonObject
                            {
                                ["type"] = "ARRAY",
                                ["items"] = new JsonObject { ["type"] = "INTEGER" },
                                ["description"] = "Массив ID заказов (например, [1, 2, 3]) для которых нужно обновить статус."
                            },
                            ["status"] = new JsonObject
                            {
                                ["type"] = "STRING",
                                ["enum"] = new JsonArray { "created", "shipped", "delivered", "cancelled" },
                                ["description"] = "Новый статус для указанных заказов."
                            }
                        },
                        ["required"] = new JsonArray { "orderIds", "status" }
                    }
                }
            };

            toolsJsonArray = new JsonArray { new JsonObject { ["functionDeclarations"] = functionDeclarations } };
        }
        else
        {
            // Для обычных пользователей строим стандартный промпт с рекомендациями книг
            var books = await _db.Books
                .Include(b => b.Author)
                .Where(b => b.IsActive)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("Список доступных книг на нашем сайте:");
            foreach (var book in books)
            {
                sb.AppendLine($"- ID: {book.BookId}, Название: \"{book.Title}\", Автор: \"{book.Author.FullName}\"");
            }

            var booksList = sb.ToString();

            systemInstruction = $@"Ты — умный и вежливый ИИ-помощник книжного интернет-магазина. Твоя цель — помочь пользователю найти и выбрать книги.
Отвечай всегда строго на русском языке, будь дружелюбен и краток.

{booksList}

Правила ответа:
1. Если пользователь ищет конкретную книгу и она есть в списке выше (совпадает по названию, автору или схожа по смыслу):
   - Обязательно дай на нее кликабельную markdown-ссылку строго в формате: `[Название книги](/book/ID)` (например, [Мастер и Маргарита](/book/5)).
   - Ссылка должна вести именно на `/book/ID`. Никаких других доменов или путей.
2. Если пользователь ищет книгу, которой НЕТ в списке выше:
   - Сообщи вежливо, что этой книги сейчас нет на нашем сайте.
   - Посоветуй другие книги из списка выше, которые могут его заинтересовать (похожие по жанру, стилю или автора).
   - Если подходящих похожих книг у нас на сайте нет, ты можешь порекомендовать какие-то известные книги из своего личного ИИ-опыта, но обязательно явно укажи, что этих книг в данный момент нет в каталоге нашего магазина.";
        }

        var apiKey = _config["Gemini:ApiKey"] ?? "AIzaSyA1kZJloXIarJcks6gz71jkXgSiLJsnZkc";
        var baseUrl = _config["Gemini:BaseUrl"] ?? "https://generativelanguage.googleapis.com";
        var url = $"{baseUrl.TrimEnd('/')}/v1beta/models/gemini-3.1-flash-lite:generateContent?key={apiKey}";

        var contents = new JsonArray
        {
            new JsonObject
            {
                ["role"] = "user",
                ["parts"] = new JsonArray {
                    new JsonObject { ["text"] = req.Message }
                }
            }
        };

        bool hasChanges = false;
        const int maxTurns = 6;
        int turn = 0;
        string finalResponseText = "Не удалось получить ответ от ассистента.";

        try
        {
            while (turn < maxTurns)
            {
                var requestBody = new JsonObject
                {
                    ["contents"] = contents.DeepClone(),
                    ["systemInstruction"] = new JsonObject
                    {
                        ["parts"] = new JsonArray {
                            new JsonObject { ["text"] = systemInstruction }
                        }
                    }
                };

                if (toolsJsonArray != null)
                {
                    requestBody["tools"] = toolsJsonArray.DeepClone();
                }

                var json = requestBody.ToJsonString();
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, content);
                if (!response.IsSuccessStatusCode)
                {
                    var errorText = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, $"Ошибка Gemini API: {errorText}");
                }

                var responseBody = await response.Content.ReadAsStringAsync();
                using var responseDoc = JsonDocument.Parse(responseBody);
                
                var root = responseDoc.RootElement;
                if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
                {
                    break;
                }

                var candidate = candidates[0];
                if (!candidate.TryGetProperty("content", out var contentElement))
                {
                    break;
                }

                // Преобразуем contentElement в JsonNode, чтобы добавить в историю
                var contentNode = JsonNode.Parse(contentElement.GetRawText());
                contents.Add(contentNode);

                var parts = contentElement.GetProperty("parts");
                if (parts.ValueKind != JsonValueKind.Array || parts.GetArrayLength() == 0)
                {
                    break;
                }

                var hasFunctionCalls = false;
                var functionResponseParts = new JsonArray();

                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("functionCall", out var functionCall))
                    {
                        hasFunctionCalls = true;
                        var funcName = functionCall.GetProperty("name").GetString();
                        
                        JsonObject argsObj = null;
                        if (functionCall.TryGetProperty("args", out var argsVal))
                        {
                            argsObj = JsonNode.Parse(argsVal.GetRawText()) as JsonObject;
                        }

                        // Выполняем вызов функции
                        var toolResult = await ExecuteToolCallAsync(funcName, argsObj, isAdmin, isStaff);

                        if (toolResult != null && toolResult["error"] == null && funcName != "search_web")
                        {
                            hasChanges = true;
                        }

                        functionResponseParts.Add(new JsonObject
                        {
                            ["functionResponse"] = new JsonObject
                            {
                                ["name"] = funcName,
                                ["response"] = toolResult
                            }
                        });
                    }
                }

                if (hasFunctionCalls)
                {
                    contents.Add(new JsonObject
                    {
                        ["role"] = "function",
                        ["parts"] = functionResponseParts
                    });
                    turn++;
                }
                else
                {
                    // Модель вернула текстовый ответ
                    if (parts[0].TryGetProperty("text", out var textProp))
                    {
                        finalResponseText = textProp.GetString() ?? "";
                    }
                    break;
                }
            }

            return Ok(new ChatResponse(finalResponseText, hasChanges));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Внутренняя ошибка сервера при работе с ассистентом: {ex.Message}");
        }
    }

    private async Task<JsonNode> ExecuteToolCallAsync(string funcName, JsonObject args, bool isAdmin, bool isStaff)
    {
        object result = null;
        try
        {
            if (funcName == "update_delivery_order_status")
            {
                if (!isStaff)
                {
                    result = new { error = "У вас нет прав для изменения статуса заказов." };
                }
                else
                {
                    var status = args?["status"]?.GetValue<string>();
                    var orderIds = new List<int>();
                    if (args?["orderIds"] is JsonArray arr)
                    {
                        foreach (var el in arr)
                        {
                            if (el != null)
                            {
                                if (el.AsValue().TryGetValue<int>(out var idVal))
                                {
                                    orderIds.Add(idVal);
                                }
                                else if (el.AsValue().TryGetValue<string>(out var strVal) && int.TryParse(strVal, out var parsedId))
                                {
                                    orderIds.Add(parsedId);
                                }
                            }
                        }
                    }

                    if (orderIds.Count > 0 && !string.IsNullOrEmpty(status))
                    {
                        var validStatuses = new[] { "created", "shipped", "delivered", "cancelled" };
                        if (validStatuses.Contains(status))
                        {
                            var affectedOrders = await _db.DeliveryOrders
                                .Include(o => o.Book)
                                .Where(o => orderIds.Contains(o.OrderId))
                                .ToListAsync();

                            foreach (var order in affectedOrders)
                            {
                                if (status == "cancelled" && order.Status != "cancelled")
                                {
                                    var book = await _db.Books.FindAsync(order.BookId);
                                    if (book != null) book.StockQuantity++;
                                }
                                order.Status = status;
                            }
                            await _db.SaveChangesAsync();

                            var updatedList = string.Join(", ", affectedOrders.Select(o => $"#{o.OrderId} (\"{o.Book.Title}\")"));
                            result = new { success = true, message = $"Статус заказов успешно изменен на '{status}'. Изменено: {updatedList}" };
                        }
                        else
                        {
                            result = new { error = "Некорректный статус." };
                        }
                    }
                    else
                    {
                        result = new { error = "Не передан список ID заказов или статус." };
                    }
                }
            }
            else if (funcName == "search_web")
            {
                if (!isAdmin)
                {
                    result = new { error = "Поиск доступен только администраторам." };
                }
                else
                {
                    var query = args?["query"]?.GetValue<string>() ?? "";
                    result = await ExecuteWebSearchAsync(query);
                }
            }
            else if (funcName == "create_author")
            {
                if (!isAdmin)
                {
                    result = new { error = "Создание авторов доступно только администраторам." };
                }
                else
                {
                    var fullName = args?["fullName"]?.GetValue<string>();
                    var biography = args?["biography"]?.GetValue<string>();
                    
                    DateOnly? birthYear = null;
                    if (args != null && args.TryGetPropertyValue("birthYear", out var byNode) && byNode != null && int.TryParse(byNode.ToString(), out var byInt))
                    {
                        birthYear = new DateOnly(byInt, 1, 1);
                    }
                    
                    DateOnly? deathYear = null;
                    if (args != null && args.TryGetPropertyValue("deathYear", out var dyNode) && dyNode != null && int.TryParse(dyNode.ToString(), out var dyInt))
                    {
                        deathYear = new DateOnly(dyInt, 1, 1);
                    }

                    if (string.IsNullOrWhiteSpace(fullName))
                    {
                        result = new { error = "Имя автора не может быть пустым." };
                    }
                    else
                    {
                        var author = new Author
                        {
                            FullName = fullName,
                            Biography = biography,
                            BirthYear = birthYear,
                            DeathYear = deathYear
                        };
                        _db.Authors.Add(author);
                        await _db.SaveChangesAsync();
                        result = new { success = true, authorId = author.AuthorId, fullName = author.FullName, message = $"Автор '{fullName}' успешно создан с ID {author.AuthorId}." };
                    }
                }
            }
            else if (funcName == "create_category")
            {
                if (!isAdmin)
                {
                    result = new { error = "Создание категорий доступно только администраторам." };
                }
                else
                {
                    var name = args?["name"]?.GetValue<string>();
                    var description = args?["description"]?.GetValue<string>();
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        result = new { error = "Название категории не может быть пустым." };
                    }
                    else
                    {
                        var category = new Category { Name = name, Description = description };
                        _db.Categories.Add(category);
                        await _db.SaveChangesAsync();
                        result = new { success = true, categoryId = category.CategoryId, name = category.Name, message = $"Категория '{name}' успешно создана с ID {category.CategoryId}." };
                    }
                }
            }
            else if (funcName == "create_subcategory")
            {
                if (!isAdmin)
                {
                    result = new { error = "Создание подкатегорий доступно только администраторам." };
                }
                else
                {
                    var name = args?["name"]?.GetValue<string>();
                    var description = args?["description"]?.GetValue<string>();
                    int categoryId = 0;
                    if (args != null && args.TryGetPropertyValue("categoryId", out var catNode) && catNode != null && int.TryParse(catNode.ToString(), out var catInt))
                    {
                        categoryId = catInt;
                    }

                    if (string.IsNullOrWhiteSpace(name))
                    {
                        result = new { error = "Название подкатегории не может быть пустым." };
                    }
                    else if (categoryId <= 0)
                    {
                        result = new { error = "Некорректный ID категории." };
                    }
                    else
                    {
                        var subcategory = new Subcategory { Name = name, CategoryId = categoryId, Description = description };
                        _db.Subcategories.Add(subcategory);
                        await _db.SaveChangesAsync();
                        result = new { success = true, subcategoryId = subcategory.SubcategoryId, name = subcategory.Name, message = $"Подкатегория '{name}' успешно создана с ID {subcategory.SubcategoryId}." };
                    }
                }
            }
            else if (funcName == "create_book")
            {
                if (!isAdmin)
                {
                    result = new { error = "Создание книг доступно только администраторам." };
                }
                else
                {
                    var title = args?["title"]?.GetValue<string>();
                    
                    int authorId = 0;
                    if (args != null && args.TryGetPropertyValue("authorId", out var authNode) && authNode != null && int.TryParse(authNode.ToString(), out var authInt))
                    {
                        authorId = authInt;
                    }

                    int categoryId = 0;
                    if (args != null && args.TryGetPropertyValue("categoryId", out var catNode) && catNode != null && int.TryParse(catNode.ToString(), out var catInt))
                    {
                        categoryId = catInt;
                    }

                    int subcategoryId = 0;
                    if (args != null && args.TryGetPropertyValue("subcategoryId", out var subcatNode) && subcatNode != null && int.TryParse(subcatNode.ToString(), out var subcatInt))
                    {
                        subcategoryId = subcatInt;
                    }

                    int publicationYear = 0;
                    if (args != null && args.TryGetPropertyValue("publicationYear", out var pubNode) && pubNode != null && int.TryParse(pubNode.ToString(), out var pubInt))
                    {
                        publicationYear = pubInt;
                    }

                    var publisher = args?["publisher"]?.GetValue<string>();
                    var synopsis = args?["synopsis"]?.GetValue<string>();

                    decimal price = 0m;
                    if (args != null && args.TryGetPropertyValue("price", out var priceNode) && priceNode != null && decimal.TryParse(priceNode.ToString(), out var priceDec))
                    {
                        price = priceDec;
                    }

                    int stockQuantity = 0;
                    if (args != null && args.TryGetPropertyValue("stockQuantity", out var stockNode) && stockNode != null && int.TryParse(stockNode.ToString(), out var stockInt))
                    {
                        stockQuantity = stockInt;
                    }

                    var coverFileName = args?["coverFileName"]?.GetValue<string>();
                    var pdfFileName = args?["pdfFileName"]?.GetValue<string>();
                    var audioFileName = args?["audioFileName"]?.GetValue<string>();

                    byte[] coverBytes = null;
                    byte[] pdfBytes = null;
                    byte[] audioBytes = null;

                    if (!string.IsNullOrEmpty(coverFileName) && TempFiles.TryRemove(coverFileName, out var coverFile)) coverBytes = coverFile.Data;
                    if (!string.IsNullOrEmpty(pdfFileName) && TempFiles.TryRemove(pdfFileName, out var pdfFile)) pdfBytes = pdfFile.Data;
                    if (!string.IsNullOrEmpty(audioFileName) && TempFiles.TryRemove(audioFileName, out var audioFile)) audioBytes = audioFile.Data;

                    bool bookIsActive = true;
                    if (args != null && args.TryGetPropertyValue("isActive", out var activeNode) && activeNode != null)
                    {
                        if (activeNode.GetValueKind() == JsonValueKind.True) bookIsActive = true;
                        else if (activeNode.GetValueKind() == JsonValueKind.False) bookIsActive = false;
                        else if (bool.TryParse(activeNode.ToString(), out var parsedActive)) bookIsActive = parsedActive;
                    }

                    if (string.IsNullOrWhiteSpace(title))
                    {
                        result = new { error = "Название книги не может быть пустым." };
                    }
                    else
                    {
                        var book = new Book
                        {
                            Title = title,
                            AuthorId = authorId,
                            CategoryId = categoryId,
                            SubcategoryId = subcategoryId,
                            PublicationYear = publicationYear,
                            Publisher = publisher,
                            Synopsis = synopsis,
                            Price = price,
                            StockQuantity = stockQuantity,
                            CoverImage = coverBytes,
                            ContentPdf = pdfBytes,
                            ContentAudio = audioBytes,
                            IsActive = bookIsActive
                        };
                        _db.Books.Add(book);
                        await _db.SaveChangesAsync();
                        result = new { success = true, bookId = book.BookId, title = book.Title, message = $"Книга '{title}' успешно создана с ID {book.BookId}." };
                    }
                }
            }
            else if (funcName == "update_author")
            {
                if (!isAdmin)
                {
                    result = new { error = "Редактирование авторов доступно только администраторам." };
                }
                else
                {
                    int authorId = 0;
                    if (args != null && args.TryGetPropertyValue("authorId", out var authIdNode) && authIdNode != null && int.TryParse(authIdNode.ToString(), out var authIdInt))
                    {
                        authorId = authIdInt;
                    }

                    if (authorId <= 0)
                    {
                        result = new { error = "Некорректный ID автора." };
                    }
                    else
                    {
                        var author = await _db.Authors.FindAsync(authorId);
                        if (author == null)
                        {
                            result = new { error = $"Автор с ID {authorId} не найден." };
                        }
                        else
                        {
                            bool updated = false;

                            if (args != null && args.TryGetPropertyValue("fullName", out var fnNode) && fnNode != null)
                            {
                                var fnStr = fnNode.GetValue<string>();
                                if (!string.IsNullOrWhiteSpace(fnStr))
                                {
                                    author.FullName = fnStr;
                                    updated = true;
                                }
                            }

                            if (args != null && args.TryGetPropertyValue("biography", out var bioNode) && bioNode != null)
                            {
                                author.Biography = bioNode.GetValue<string>();
                                updated = true;
                            }

                            if (args != null && args.TryGetPropertyValue("birthYear", out var byNode) && byNode != null)
                            {
                                if (int.TryParse(byNode.ToString(), out var byInt))
                                {
                                    author.BirthYear = new DateOnly(byInt, 1, 1);
                                    updated = true;
                                }
                            }

                            if (args != null && args.TryGetPropertyValue("deathYear", out var dyNode) && dyNode != null)
                            {
                                if (int.TryParse(dyNode.ToString(), out var dyInt))
                                {
                                    author.DeathYear = new DateOnly(dyInt, 1, 1);
                                    updated = true;
                                }
                            }

                            if (updated)
                            {
                                _db.Authors.Update(author);
                                await _db.SaveChangesAsync();
                                result = new { success = true, authorId = author.AuthorId, fullName = author.FullName, message = $"Автор '{author.FullName}' успешно обновлен." };
                            }
                            else
                            {
                                result = new { success = true, message = "Нет изменений для обновления." };
                            }
                        }
                    }
                }
            }
            else if (funcName == "archive_books")
            {
                if (!isAdmin)
                {
                    result = new { error = "Архивация книг доступна только администраторам." };
                }
                else
                {
                    bool archive = true;
                    if (args != null && args.TryGetPropertyValue("archive", out var archiveNode) && archiveNode != null)
                    {
                        if (archiveNode.GetValueKind() == JsonValueKind.True)
                        {
                            archive = true;
                        }
                        else if (archiveNode.GetValueKind() == JsonValueKind.False)
                        {
                            archive = false;
                        }
                        else if (bool.TryParse(archiveNode.ToString(), out var archVal))
                        {
                            archive = archVal;
                        }
                    }

                    int? authorId = null;
                    if (args != null && args.TryGetPropertyValue("authorId", out var authIdNode) && authIdNode != null && int.TryParse(authIdNode.ToString(), out var authIdVal))
                    {
                        authorId = authIdVal;
                    }

                    int? categoryId = null;
                    if (args != null && args.TryGetPropertyValue("categoryId", out var catIdNode) && catIdNode != null && int.TryParse(catIdNode.ToString(), out var catIdVal))
                    {
                        categoryId = catIdVal;
                    }

                    int? subcategoryId = null;
                    if (args != null && args.TryGetPropertyValue("subcategoryId", out var subcatIdNode) && subcatIdNode != null && int.TryParse(subcatIdNode.ToString(), out var subcatIdVal))
                    {
                        subcategoryId = subcatIdVal;
                    }

                    var bookIds = new List<int>();
                    if (args != null && args.TryGetPropertyValue("bookIds", out var bIdsNode) && bIdsNode is JsonArray arr)
                    {
                        foreach (var el in arr)
                        {
                            if (el != null)
                            {
                                if (el.AsValue().TryGetValue<int>(out var idVal))
                                {
                                    bookIds.Add(idVal);
                                }
                                else if (el.AsValue().TryGetValue<string>(out var strVal) && int.TryParse(strVal, out var parsedId))
                                {
                                    bookIds.Add(parsedId);
                                }
                            }
                        }
                    }

                    var query = _db.Books.AsQueryable();
                    bool hasFilter = false;

                    if (authorId.HasValue)
                    {
                        query = query.Where(b => b.AuthorId == authorId.Value);
                        hasFilter = true;
                    }
                    if (categoryId.HasValue)
                    {
                        query = query.Where(b => b.CategoryId == categoryId.Value);
                        hasFilter = true;
                    }
                    if (subcategoryId.HasValue)
                    {
                        query = query.Where(b => b.SubcategoryId == subcategoryId.Value);
                        hasFilter = true;
                    }
                    if (bookIds.Count > 0)
                    {
                        query = query.Where(b => bookIds.Contains(b.BookId));
                        hasFilter = true;
                    }

                    if (!hasFilter)
                    {
                        result = new { error = "Не указаны фильтры для архивации/разархивации книг." };
                    }
                    else
                    {
                        var targetBooks = await query.ToListAsync();
                        foreach (var book in targetBooks)
                        {
                            book.IsActive = !archive;
                        }
                        await _db.SaveChangesAsync();

                        var actionName = archive ? "архивировано" : "разархивировано";
                        var updatedList = string.Join(", ", targetBooks.Select(b => $"#{b.BookId} (\"{b.Title}\")"));
                        result = new { success = true, count = targetBooks.Count, message = $"Успешно {actionName} книг: {targetBooks.Count} шт. Список: {updatedList}" };
                    }
                }
            }
            else
            {
                result = new { error = $"Неизвестная функция: {funcName}" };
            }
        }
        catch (Exception ex)
        {
            result = new { error = $"Исключение при вызове функции {funcName}: {ex.Message}" };
        }

        return JsonNode.Parse(JsonSerializer.Serialize(result)) ?? new JsonObject();
    }

    private async Task<object> ExecuteWebSearchAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return new { message = "Запрос пуст." };
        }

        try
        {
            var searchUrl = $"https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch={Uri.EscapeDataString(query)}&format=json";
            
            var request = new HttpRequestMessage(HttpMethod.Get, searchUrl);
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 BookStoreApi/1.0");
            
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return new { error = $"Ошибка поиска Википедии: {response.StatusCode}" };
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("query", out var queryProp) &&
                queryProp.TryGetProperty("search", out var searchProp) &&
                searchProp.ValueKind == JsonValueKind.Array &&
                searchProp.GetArrayLength() > 0)
            {
                var firstHit = searchProp[0];
                var title = firstHit.GetProperty("title").GetString();
                if (!string.IsNullOrEmpty(title))
                {
                    var summaryUrl = $"https://ru.wikipedia.org/api/rest_v1/page/summary/{Uri.EscapeDataString(title.Replace(" ", "_"))}";
                    
                    var summaryRequest = new HttpRequestMessage(HttpMethod.Get, summaryUrl);
                    summaryRequest.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 BookStoreApi/1.0");
                    
                    var summaryResponse = await _httpClient.SendAsync(summaryRequest);
                    if (summaryResponse.IsSuccessStatusCode)
                    {
                        var summaryJson = await summaryResponse.Content.ReadAsStringAsync();
                        using var summaryDoc = JsonDocument.Parse(summaryJson);
                        var pageTitle = summaryDoc.RootElement.TryGetProperty("title", out var tProp) ? tProp.GetString() : title;
                        var desc = summaryDoc.RootElement.TryGetProperty("description", out var dProp) ? dProp.GetString() : "";
                        var extract = summaryDoc.RootElement.TryGetProperty("extract", out var eProp) ? eProp.GetString() : "";
                        
                        return new {
                            title = pageTitle,
                            description = desc,
                            extract = extract
                        };
                    }
                }
            }
            return new { message = "Ничего не найдено по данному запросу." };
        }
        catch (Exception ex)
        {
            return new { error = $"Исключение при веб-поиске: {ex.Message}" };
        }
    }
}
