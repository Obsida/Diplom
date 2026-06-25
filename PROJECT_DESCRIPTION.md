# Описание проекта BooksApi и my-app

## Общая идея

Проект состоит из двух частей:

- `BooksApi` - backend API для книжного магазина.
- `my-app` - frontend-приложение для пользователя, администратора и менеджера.

Backend отвечает за хранение данных, авторизацию, книги, покупки, подписки, отзывы, доставку и модерацию. Frontend показывает каталог, карточки книг, личный кабинет, корзину, библиотеку, читалку, аудиоплеер и административные панели.

## Использованные технологии

### Backend

В backend использован ASP.NET Core Web API на C#.

Основные технологии:

- ASP.NET Core - основа серверного приложения и REST API.
- Entity Framework Core - работа с базой данных через модели и `DbContext`.
- PostgreSQL - база данных проекта.
- Npgsql - провайдер EF Core для PostgreSQL.
- JWT Bearer Authentication - авторизация пользователей по токену.
- BCrypt.Net - хеширование и проверка паролей.
- Swagger / OpenAPI - документация и тестирование API.
- MailKit / MimeKit - отправка email, например кодов восстановления пароля и чеков.
- Yandex OAuth - вход через Яндекс.

### Frontend

Во frontend использован React с Vite.

Основные технологии:

- React - построение интерфейса через компоненты.
- Vite - сборка и запуск frontend-приложения.
- JavaScript / JSX - логика компонентов и разметка.
- CSS - стили приложения.
- Fetch API - запросы к backend.
- LocalStorage - хранение корзины и локального прогресса чтения.
- Cookies - хранение JWT-токена и настроек читалки.
- PDF parsing utility - извлечение текста из PDF для режима чтения.

## Что написано в backend

### Program.cs

В файле `BooksApi/BooksApi/Program.cs` написана настройка приложения.

Там подключается база данных PostgreSQL, регистрируются сервисы, включается JWT-авторизация, CORS, Swagger и контроллеры.

Главная задача этого файла - собрать приложение и указать, какие middleware будут использоваться:

- `UseCors`
- `UseSwagger`
- `UseAuthentication`
- `UseAuthorization`
- `MapControllers`

### AppDbContext.cs

В файле `BooksApi/BooksApi/AppDbContext.cs` написан контекст базы данных.

Через `DbSet` описаны таблицы:

- пользователи;
- роли;
- книги;
- авторы;
- категории и подкатегории;
- подписки;
- покупки;
- доставки;
- закладки;
- прогресс чтения;
- отзывы;
- комментарии;
- журнал модерации.

В методе `OnModelCreating` настроены ключи, связи между таблицами, уникальные индексы и правила удаления.

### Entities.cs

В файле `BooksApi/BooksApi/Entities.cs` написаны классы сущностей базы данных.

Например:

- `User` описывает пользователя.
- `Book` описывает книгу.
- `Author` описывает автора.
- `Review` описывает отзыв.
- `Purchase` описывает покупку.
- `DeliveryOrder` описывает заказ доставки.

Эти классы соответствуют таблицам PostgreSQL.

### Dtos.cs

В файле `BooksApi/BooksApi/Dtos.cs` написаны DTO-модели.

DTO используются для передачи данных между frontend и backend. Например:

- `LoginRequest` - данные для входа.
- `RegisterRequest` - данные для регистрации.
- `BookResponse` - краткое описание книги.
- `BookDetailResponse` - подробное описание книги.
- `CreatePurchaseRequest` - данные для покупки.
- `CreateSubscriptionRequest` - данные для подписки.

## Главные методы backend

### Авторизация

Файл: `BooksApi/BooksApi/AuthController.cs`

Метод `Register` регистрирует пользователя. Он проверяет, занят ли email, хеширует пароль через BCrypt, назначает роль `client`, сохраняет пользователя и возвращает JWT-токен.

Метод `Login` ищет пользователя по email, проверяет пароль через BCrypt и возвращает JWT-токен.

Метод `ForgotPassword` создаёт код восстановления пароля, сохраняет его в базе и отправляет пользователю email.

Метод `ResetPassword` проверяет код восстановления и меняет пароль пользователя.

Также написаны методы для входа через Яндекс OAuth: старт авторизации, callback, получение профиля Яндекса и создание пользователя, если его ещё нет.

### Каталог книг

Файл: `BooksApi/BooksApi/BooksController.cs`

Метод `GetCatalog` получает список книг для каталога. Он использует `IQueryable`, чтобы постепенно добавить фильтры:

- поиск по названию, автору, категории и подкатегории;
- фильтр по категории;
- фильтр по автору;
- фильтр по цене;
- фильтр по рейтингу;
- фильтр по году публикации;
- сортировку;
- пагинацию.

После этого метод возвращает `PagedResult<BookResponse>`.

### Карточка книги

Метод `GetById` получает подробную информацию о книге. Он загружает книгу вместе с автором, категорией, подкатегорией и активными отзывами.

На frontend этот метод используется на странице книги и в модальном окне книги.

### Обложка, PDF и аудио

Метод `GetCover` возвращает обложку книги как файл `image/jpeg`.

Методы `GetPdf`, `DownloadPdf`, `GetAudio`, `DownloadAudio` возвращают PDF или аудиофайл. Перед выдачей файла вызывается `CheckBookAccess`.

`CheckBookAccess` проверяет, имеет ли пользователь доступ к книге:

- книга куплена;
- или есть активная подписка;
- или пользователь входит в семейную подписку.

### Создание и редактирование книги

Методы `Create` и `Update` принимают данные книги через `FormData`.

Так сделано потому, что вместе с текстовыми полями передаются файлы:

- обложка;
- PDF;
- аудио.

Файлы читаются в `byte[]` и сохраняются в базе данных.

### Рекомендации

Метод `GetRecommendations` подбирает книги для пользователя.

Если пользователь авторизован, метод анализирует:

- книги из библиотеки;
- книги из закладок;
- книги с прогрессом чтения.

После этого рекомендации сортируются по совпадению автора, подкатегории, категории и рейтингу. Если данных мало, добавляются популярные книги по рейтингу.

### Библиотека

Файл: `BooksApi/BooksApi/LibraryBookmarksProgressController.cs`

Метод `GetMyLibrary` возвращает книги текущего пользователя из личной библиотеки.

Пользователь определяется по JWT-токену через `ClaimTypes.NameIdentifier`.

### Закладки

Метод `GetMyBookmarks` возвращает закладки пользователя. Можно передать тип закладки.

Метод `Add` добавляет книгу в закладки или меняет категорию закладки. Например:

- `Читаю`;
- `Прочитано`;
- `Позже`;
- `Любимое`.

Метод `Remove` удаляет закладку.

### Прогресс чтения

Метод `Upsert` сохраняет прогресс чтения.

Если записи ещё нет, она создаётся. Если запись уже есть, обновляются:

- последняя глава или страница;
- таймкод аудио;
- дата обновления.

### Покупки

Файл: `BooksApi/BooksApi/PurchasesDeliveryController.cs`

Метод `Buy` оформляет электронную покупку книги.

Он проверяет, существует ли книга, не куплена ли она уже, создаёт запись `Purchase`, добавляет книгу в `UserLibrary` и отправляет чек на email.

### Доставка

Метод `Create` в `DeliveryOrdersController` создаёт заказ доставки.

Если покупается печатная книга, уменьшается `StockQuantity`. Если покупается электронная версия, книга сразу добавляется в библиотеку, а заказ получает статус `delivered`.

### Подписки

Файл: `BooksApi/BooksApi/SubscriptionsController.cs`

Метод `Subscribe` создаёт подписку. Он находит тариф, рассчитывает даты начала и окончания, создаёт запись подписки и обновляет статус пользователя.

Метод `CancelMyActive` отменяет активную подписку пользователя. Если это семейная подписка, все участники отвязываются от владельца.

Методы `AddFamilyMember` и `RemoveFamilyMember` управляют участниками семейной подписки.

### Отзывы

Файл: `BooksApi/BooksApi/ReviewsController.cs`

Метод `Create` создаёт отзыв. Отзыв можно оставить только при активной подписке.

Методы `Update` и `Delete` позволяют пользователю редактировать и удалять свой отзыв.

После изменения отзывов вызывается `RecalcBookRating`, который пересчитывает средний рейтинг книги.

### Модерация

Файл: `BooksApi/BooksApi/ModerationController.cs`

Менеджер или администратор может:

- просматривать отзывы и комментарии;
- скрывать отзывы;
- помечать нарушения;
- удалять отзывы и комментарии;
- смотреть журнал своих действий.

Все действия записываются в `ModerationLogs`.

## Что написано во frontend

### api.js

Файл: `my-app/src/api.js`

В этом файле написан слой работы с backend.

Основные функции:

- `fetchBooksCatalog` - загрузка каталога книг.
- `fetchBookDetail` - загрузка карточки книги.
- `login` - вход.
- `register` - регистрация.
- `fetchMyLibrary` - личная библиотека.
- `fetchMyBookmarks` - закладки.
- `addBookmark` - добавить закладку.
- `removeBookmark` - удалить закладку.
- `upsertReadingProgress` - сохранить прогресс чтения.
- `buyBook` - купить книгу.
- `createPhysicalOrder` - создать заказ.
- `buySubscription` - купить подписку.
- `sendAiAssistantMessage` - отправить сообщение AI-ассистенту.

Также там написана работа с JWT:

- `saveAuthToken`;
- `getAuthToken`;
- `clearAuthToken`;
- `getAuthRole`;
- `getAuthUserId`;
- `isAdminToken`;
- `isManagerToken`.

### App.jsx

Файл: `my-app/src/App.jsx`

Это главный компонент пользовательской части.

В нём написана логика:

- загрузки каталога;
- фильтрации книг;
- поиска с задержкой через debounce;
- пагинации;
- загрузки популярных книг;
- загрузки рекомендаций;
- работы с корзиной;
- загрузки библиотеки;
- загрузки закладок;
- загрузки заказов;
- открытия модальных окон авторизации, подписки и оформления заказа.

Корзина хранится в `localStorage` под ключом `bookstore_cart`.

### main.jsx

Файл: `my-app/src/main.jsx`

Там написана простая маршрутизация по адресу страницы.

Например:

- `/` открывает главную страницу.
- `/book/:id` открывает страницу книги.
- `/readdPdf?bookId=...` открывает читалку.
- `/library` открывает библиотеку.
- `/cart` открывает корзину.
- `/admin` открывает админ-панель.
- `/manager` открывает панель менеджера.

### BookPage.jsx

Файл: `my-app/src/pages/BookPage.jsx`

Это страница одной книги.

В ней написана логика:

- загрузки подробной информации о книге;
- загрузки отзывов;
- проверки подписки;
- проверки покупки;
- добавления в закладки;
- добавления в корзину;
- покупки электронной и печатной версии;
- открытия читалки;
- открытия аудиоплеера;
- скачивания PDF и аудио;
- создания, редактирования и удаления отзыва;
- удаления отзыва менеджером.

Доступ к чтению считается так: если у книги есть PDF и пользователь купил книгу или имеет активную подписку, кнопка чтения становится доступной.

### ReadPdfPage.jsx

Файл: `my-app/src/pages/ReadPdfPage.jsx`

Это страница чтения книги.

Она:

- получает `bookId` из query-параметра;
- загружает данные книги;
- скачивает PDF через защищённый endpoint;
- извлекает текст из PDF;
- делит текст на главы;
- даёт менять размер шрифта и тему;
- сохраняет прогресс чтения;
- синхронизирует прогресс с backend.

Настройки читалки сохраняются в cookie, а прогресс по главам - локально и на сервере.

### Modal.jsx

Файл: `my-app/src/components/Modal.jsx`

Это модальное окно книги из каталога.

В нём написаны:

- загрузка подробной информации о книге;
- проверка, находится ли книга в закладках;
- переключение вкладок описания, деталей и автора;
- добавление и удаление закладки;
- кнопка начала чтения;
- кнопка покупки печатной книги.

### AuthModal.jsx

Файл: `my-app/src/components/AuthModal.jsx`

Это модальное окно авторизации.

В нём написаны режимы:

- вход;
- регистрация;
- восстановление пароля;
- сброс пароля;
- вход через Яндекс.

После успешного входа JWT сохраняется в cookie.

### adminApi.js

Файл: `my-app/src/adminApi.js`

Это отдельный API-слой для админки.

Там написаны методы:

- загрузка всех книг;
- создание и редактирование книги;
- архивирование книги;
- загрузка пользователей;
- назначение ролей;
- загрузка заказов доставки;
- обновление статуса доставки;
- создание авторов, категорий и подкатегорий.

## Описание логики с примерами кода

### Логика авторизации

Авторизация сделана через JWT-токен. Когда пользователь входит в аккаунт, frontend отправляет email и пароль на backend. Backend ищет пользователя в базе, проверяет пароль и создаёт токен.

Пример логики входа на backend:

```csharp
var user = await _db.Users
    .Include(u => u.Role)
    .FirstOrDefaultAsync(u => u.Email == req.Email);

if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
    return Unauthorized("Неверный email или пароль");

var token = _jwt.GenerateToken(user);
return Ok(new AuthResponse(token, user.Role.Name, user.UserId, user.Email));
```

Смысл этого кода:

- пользователь ищется по email;
- пароль сравнивается с хешем через BCrypt;
- если данные правильные, создаётся JWT;
- frontend сохраняет токен и использует его в следующих запросах.

На frontend токен сохраняется в cookie:

```javascript
export function saveAuthToken(token) {
  if (!token) return;
  document.cookie = `token=${encodeURIComponent(token)}; Max-Age=${60 * 60 * 24 * 7}; Path=/; SameSite=Lax`;
}
```

После этого при защищённых запросах frontend добавляет заголовок `Authorization`.

```javascript
function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

### Логика загрузки каталога

Каталог книг сделан через фильтрацию на backend. Frontend собирает параметры фильтра и отправляет их в API. Backend получает параметры и добавляет условия к запросу.

Пример backend-логики:

```csharp
var query = _db.Books
    .Include(b => b.Author)
    .Include(b => b.Category)
    .Include(b => b.Subcategory)
    .Where(b => b.IsActive && b.CoverImage != null)
    .AsQueryable();

if (!string.IsNullOrWhiteSpace(filter.Search))
{
    var s = filter.Search.ToLower();
    query = query.Where(b =>
        b.Title.ToLower().Contains(s) ||
        b.Author.FullName.ToLower().Contains(s));
}

if (filter.CategoryId.HasValue)
    query = query.Where(b => b.CategoryId == filter.CategoryId.Value);
```

Смысл:

- сначала берутся только активные книги;
- через `Include` подгружается автор, категория и подкатегория;
- если пользователь ввёл поиск, добавляется условие по названию и автору;
- если выбрана категория, добавляется фильтр по категории.

После фильтрации применяется сортировка и пагинация:

```csharp
var total = await query.CountAsync();
var items = await query
    .Skip((filter.Page - 1) * filter.PageSize)
    .Take(filter.PageSize)
    .ToListAsync();
```

Frontend вызывает этот метод так:

```javascript
fetchBooksCatalog({
  search: debouncedSearch || undefined,
  categoryId: categoryId ?? undefined,
  page: currentPage,
  pageSize: BOOKS_PER_PAGE,
});
```

То есть пользователь меняет фильтры, React обновляет состояние, а после этого заново загружает каталог.

### Логика страницы книги

Страница книги открывается по адресу `/book/:id`. Frontend берёт `id` из адреса и загружает подробные данные книги.

Пример:

```javascript
function getBookIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const raw = parts[1];
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}
```

После этого вызывается API:

```javascript
useEffect(() => {
  if (!bookId) return;

  fetchBookDetail(bookId)
    .then((data) => setDetail(data))
    .catch((error) => setError(error?.message || 'Не удалось загрузить книгу'))
    .finally(() => setLoading(false));
}, [bookId]);
```

Смысл:

- из URL получается id книги;
- React загружает данные книги;
- данные сохраняются в `detail`;
- если произошла ошибка, показывается сообщение.

### Логика доступа к чтению

Чтение PDF и прослушивание аудио доступны не всем. Backend проверяет, есть ли у пользователя покупка или активная подписка.

Пример проверки на backend:

```csharp
var hasPurchased = await _db.Purchases.AnyAsync(p =>
    p.UserId == userId.Value &&
    p.BookId == bookId &&
    p.Status == "success");

if (hasPurchased) return true;

return user.SubscriptionStatus == "active" &&
       user.SubscriptionEndDate >= today;
```

Если доступа нет, backend возвращает `403`.

На frontend кнопка чтения тоже зависит от доступа:

```javascript
const canReadPdf = Boolean(detail?.hasPdf) && (hasSubscriptionAccess || isPurchased);
```

Если `canReadPdf` равен `true`, показывается ссылка на читалку. Если нет, кнопка блокируется.

### Логика читалки PDF

Читалка открывается по адресу `/readdPdf?bookId=...`. Она загружает PDF через защищённый endpoint, извлекает текст и делит его на главы.

Пример загрузки PDF:

```javascript
const token = getAuthToken();
const headers = token ? { Authorization: `Bearer ${token}` } : {};
const res = await fetch(readPdfUrl(bookId), { headers, credentials: 'include' });

const buf = await res.arrayBuffer();
const { extractPdfText } = await import('../utils/extractPdfText.js');
const extracted = await extractPdfText(buf);
```

Смысл:

- берётся JWT-токен;
- PDF запрашивается с заголовком `Authorization`;
- ответ превращается в `ArrayBuffer`;
- из PDF извлекается текст;
- текст показывается в интерфейсе читалки.

Прогресс чтения сохраняется с задержкой, чтобы не отправлять запрос при каждом пикселе прокрутки:

```javascript
upsertProgressTimer.current = window.setTimeout(() => {
  upsertReadingProgress({
    bookId: Number(bookId),
    lastPage: chapterIndex,
    timecodeSeconds: null,
  }).catch(() => {});
}, 900);
```

Такой подход снижает количество запросов к backend.

### Логика закладок

Закладки сделаны как отдельная таблица `bookmarks`. У закладки есть пользователь, книга и тип.

Когда пользователь нажимает кнопку закладки, frontend вызывает `addBookmark` или `removeBookmark`.

Пример frontend-логики:

```javascript
if (bookmarkId != null) {
  await removeBookmark(bookmarkId);
  setBookmarkId(null);
} else {
  const created = await addBookmark(book.bookId, 'favorite');
  setBookmarkId(created?.bookmarkId ?? -1);
}
```

Backend при добавлении проверяет тип закладки:

```csharp
var normalizedType = req.BookmarkType.Trim().ToLower() switch
{
    "reading" or "читаю" => "Читаю",
    "completed" or "прочитано" => "Прочитано",
    "later" or "позже" => "Позже",
    "favorite" or "любимое" => "Любимое",
    _ => null
};
```

Если закладка уже существует, backend не создаёт дубликат, а обновляет её тип.

### Логика покупки книги

Покупка электронной книги создаёт запись в таблице `purchases` и добавляет книгу в личную библиотеку.

Пример backend-логики:

```csharp
var purchase = new Purchase
{
    UserId = CurrentUserId,
    BookId = req.BookId,
    Amount = book.Price,
    PaymentMethod = req.PaymentMethod,
    Status = "success"
};

_db.Purchases.Add(purchase);
```

После этого книга добавляется в библиотеку:

```csharp
_db.UserLibrary.Add(new UserLibrary
{
    UserId = CurrentUserId,
    BookId = req.BookId,
    AcquisitionType = "purchase"
});
```

Смысл:

- покупка фиксируется отдельно;
- доступ к книге появляется через личную библиотеку;
- пользователь может читать книгу после покупки.

### Логика корзины

Корзина сделана на frontend и хранится в `localStorage`.

Пример:

```javascript
const raw = window.localStorage.getItem('bookstore_cart');
const parsed = raw ? JSON.parse(raw) : [];
const list = Array.isArray(parsed) ? parsed : [];
```

При добавлении книги в корзину frontend проверяет, нет ли такой книги уже в списке:

```javascript
if (list.some((item) => Number(item.bookId) === Number(viewBook.bookId))) {
  return;
}

window.localStorage.setItem('bookstore_cart', JSON.stringify([newItem, ...list]));
```

Корзина не требует отдельной таблицы в базе, потому что заказ создаётся только при оформлении покупки.

### Логика доставки

Доставка оформляется через `DeliveryOrdersController`.

Если пользователь покупает печатную книгу, backend уменьшает количество книг на складе:

```csharp
if (!isElectronic)
{
    if (book.StockQuantity <= 0)
        return BadRequest("Нет в наличии");

    book.StockQuantity--;
}
```

После этого создаётся заказ:

```csharp
var order = new DeliveryOrder
{
    UserId = CurrentUserId,
    BookId = req.BookId,
    DeliveryAddress = req.DeliveryAddress,
    TotalAmount = book.Price,
    PaymentMethod = req.PaymentMethod,
    Status = isElectronic ? "delivered" : "created"
};
```

Для электронной версии статус сразу `delivered`, потому что физическая доставка не нужна.

### Логика подписки

Подписка даёт доступ к чтению книг без отдельной покупки. Backend создаёт запись в таблице `subscriptions` и обновляет пользователя.

Пример:

```csharp
var subscription = new Subscription
{
    UserId = CurrentUserId,
    PlanId = req.PlanId,
    StartDate = today,
    EndDate = today.AddDays(plan.DurationDays),
    PaidAmount = plan.BasePrice,
    PaymentMethod = req.PaymentMethod,
    Status = "success"
};
```

Потом обновляется статус пользователя:

```csharp
user.SubscriptionStatus = "active";
user.SubscriptionEndDate = endDate;
```

Именно эти поля потом используются при проверке доступа к чтению.

### Логика отзывов и рейтинга

Пользователь может оставить отзыв, если у него есть активная подписка.

После создания, изменения или удаления отзыва backend пересчитывает рейтинг книги.

Пример:

```csharp
var avg = await _db.Reviews
    .Where(r => r.BookId == bookId && r.IsActive)
    .AverageAsync(r => (double?)r.Rating) ?? 0;

book.Rating = Math.Round((decimal)avg, 2);
await _db.SaveChangesAsync();
```

Смысл:

- берутся только активные отзывы;
- считается средняя оценка;
- рейтинг книги обновляется в таблице `books`.

### Логика модерации

Модерация нужна для управления отзывами и комментариями. Менеджер или администратор может скрыть отзыв, отметить нарушение или удалить запись.

Пример скрытия отзыва:

```csharp
review.IsActive = false;
AddLog("review", id, "hide", req.Reason);
await _db.SaveChangesAsync();
```

Каждое действие сохраняется в журнал:

```csharp
_db.ModerationLogs.Add(new ModerationLog
{
    ModeratorUserId = CurrentUserId,
    TargetType = targetType,
    TargetId = targetId,
    Action = action,
    Reason = reason
});
```

Так можно посмотреть, кто и что модерировал.

### Логика админки

Для админки сделан отдельный файл `adminApi.js`. Он отправляет запросы на защищённые backend-методы.

Пример создания книги:

```javascript
const formData = new FormData();
formData.append("Title", payload.title);
formData.append("AuthorId", String(payload.authorId));
formData.append("Price", String(payload.price));

if (payload.cover) formData.append("cover", payload.cover);
if (payload.pdf) formData.append("pdf", payload.pdf);
if (payload.audio) formData.append("audio", payload.audio);
```

Используется `FormData`, потому что администратор загружает не только текстовые поля, но и файлы.

Запрос отправляется так:

```javascript
return fetchJson("/api/Books/Books_Create", {
  method: "POST",
  headers: authHeaders(),
  body: formData,
}, "Создание книги");
```

На backend этот запрос принимает метод `Create` в `BooksController`.

## Итог

Я написал backend как REST API на ASP.NET Core с PostgreSQL, Entity Framework Core и JWT-авторизацией.

Я написал frontend как React-приложение на Vite, где все запросы вынесены в `api.js`, а пользовательские сценарии разделены по компонентам и страницам.

Главные сценарии проекта:

- регистрация и вход;
- каталог книг;
- фильтрация и поиск;
- карточка книги;
- чтение PDF;
- прослушивание аудио;
- закладки;
- личная библиотека;
- покупка книг;
- доставка печатных книг;
- подписки;
- семейная подписка;
- отзывы;
- модерация;
- администрирование книг, пользователей и заказов.
