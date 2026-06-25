export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const AUTH_TOKEN_KEY = "token";

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

function withoutApiPrefix(path) {
  return path.replace(/^\/api(?=\/|$)/i, "") || "/";
}

function withCredentials(options = {}) {
  return { ...options, credentials: "include" };
}

async function fetchWithFallback(path, options) {
  const requestOptions = withCredentials(options);
  const first = await fetch(apiUrl(path), requestOptions);
  if (first.status !== 404) return first;

  const fallbackPath = withoutApiPrefix(path);
  return fetch(apiUrl(fallbackPath), requestOptions);
}

async function fetchTryPaths(paths, options) {
  let last = null;
  for (const p of paths) {
    const res = await fetchWithFallback(p, options);
    last = res;
    if (res.status !== 404) return res;
  }
  return last ?? fetchWithFallback(paths[0], options);
}

async function toJsonOrThrow(res, scopeLabel) {
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(text || `${scopeLabel}: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `${scopeLabel}: получен не JSON-ответ. Проверьте, что BooksApi запущен и Vite proxy направляет /api на backend.`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${scopeLabel}: сервер вернул некорректный JSON. Проверьте ответ API и настройки proxy.`
    );
  }
}

export async function fetchBooksCatalog(params = {}) {
  const q = new URLSearchParams();
  const set = (key, val) => {
    if (val === undefined || val === null || val === "") return;
    q.set(key, String(val));
  };
  set("Search", params.search);
  set("CategoryId", params.categoryId);
  set("SubcategoryId", params.subcategoryId);
  set("AuthorId", params.authorId);
  set("MinPrice", params.minPrice);
  set("MaxPrice", params.maxPrice);
  set("MinRating", params.minRating);
  set("PublicationYear", params.publicationYear);
  set("SortBy", params.sortBy);
  set("Page", params.page ?? 1);
  set("PageSize", params.pageSize ?? 8);

  const res = await fetchWithFallback(`/api/Books/Books_GetCatalog?${q}`);
  return toJsonOrThrow(res, "Каталог");
}

export async function fetchAuthors() {
  const res = await fetchWithFallback("/api/Authors/Authors_GetAll");
  return toJsonOrThrow(res, "Авторы");
}

export async function fetchCategories() {
  const res = await fetchWithFallback("/api/Categories/Categories_GetAll");
  return toJsonOrThrow(res, "Категории");
}

export async function fetchBookDetail(bookId) {
  const res = await fetchWithFallback(`/api/Books/${bookId}/Books_GetById`, {
    headers: { ...authHeaders() },
  });
  if (res.status === 401) {
    throw new Error("Требуется вход в аккаунт.");
  }
  if (res.status === 403) {
    throw new Error("Доступ к книге запрещён.");
  }
  if (res.status === 404) {
    throw new Error("Книга не найдена.");
  }
  return toJsonOrThrow(res, "Книга");
}

export function coverUrl(bookId) {
  return apiUrl(`/api/Books/${bookId}/Books_GetCover`);
}

export function readPdfUrl(bookId) {
  return apiUrl(`/api/Books/${bookId}/Books_ReadPdf`);
}

export function listenAudioUrl(bookId) {
  return apiUrl(`/api/Books/${bookId}/Books_ListenAudio`);
}

export function downloadPdfUrl(bookId) {
  return apiUrl(`/api/Books/${bookId}/Books_DownloadPdf`);
}

export function downloadAudioUrl(bookId) {
  return apiUrl(`/api/Books/${bookId}/Books_DownloadAudio`);
}

export function getYandexOAuthStartUrl(returnUrl = "/") {
  const normalizedReturnUrl = typeof returnUrl === "string" && returnUrl.trim() ? returnUrl : "/";
  return apiUrl(`/api/Auth/yandex/start?returnUrl=${encodeURIComponent(normalizedReturnUrl)}`);
}

export function getAuthToken() {
  const fromCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${AUTH_TOKEN_KEY}=`))
    ?.split("=")[1];
  return fromCookie ? decodeURIComponent(fromCookie) : "";
}

function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function claimValue(payload, keys) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

export function getAuthRole(token = getAuthToken()) {
  const payload = decodeJwtPayload(token);
  const role = claimValue(payload, [
    "role",
    "Role",
    "roles",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  ]);
  return String(role || "").trim().toLowerCase();
}

export function getAuthUserId(token = getAuthToken()) {
  const payload = decodeJwtPayload(token);
  const raw = claimValue(payload, [
    "nameid",
    "sub",
    "userId",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  ]);
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

export function isAdminToken(token = getAuthToken()) {
  return getAuthRole(token) === "admin";
}

export function isManagerToken(token = getAuthToken()) {
  return getAuthRole(token) === "meneger";
}

export function isModeratorToken(token = getAuthToken()) {
  return isManagerToken(token);
}

export function saveAuthToken(token) {
  if (!token) return;
  document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; Max-Age=${60 * 60 * 24 * 7}; Path=/; SameSite=Lax`;
}

export function clearAuthToken() {
  document.cookie = `${AUTH_TOKEN_KEY}=; Max-Age=0; Path=/`;
}

export function consumeOAuthResultFromUrl() {
  if (typeof window === "undefined") return { token: "", error: "" };

  const url = new URL(window.location.href);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const token = hashParams.get("authToken") || url.searchParams.get("authToken") || "";
  const error = hashParams.get("authError") || url.searchParams.get("authError") || "";

  if (!token && !error) return { token: "", error: "" };

  hashParams.delete("authToken");
  hashParams.delete("authError");
  url.searchParams.delete("authToken");
  url.searchParams.delete("authError");

  const nextHash = hashParams.toString();
  const nextUrl = `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ""}`;
  window.history.replaceState({}, document.title, nextUrl);

  return { token, error };
}

export async function login(payload) {
  const res = await fetchWithFallback("/api/Auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return toJsonOrThrow(res, "Вход");
}

export async function register(payload) {
  const res = await fetchWithFallback("/api/Auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return toJsonOrThrow(res, "Регистрация");
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchMyBookmarks(type = "favorite") {
  const q = new URLSearchParams();
  if (type) q.set("type", type);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await fetchTryPaths([
    `/api/Bookmarks/Bookmarks_GetMy${suffix}`,
    `/api/Bookmarks/My${suffix}`,
    `/api/Bookmarks${suffix}`,
  ], {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Закладки");
}

export async function fetchMyLibrary() {
  const res = await fetchTryPaths([
    "/api/library/Library_GetMyLibrary",
    "/api/UserLibrary/Library_GetMyLibrary",
    "/api/library",
  ], {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Личная библиотека");
}

export async function fetchReadingProgressByBook(bookId) {
  const id = Number(bookId);
  if (Number.isNaN(id)) return null;
  const res = await fetchTryPaths([`/api/reading-progress/${id}`], {
    headers: authHeaders(),
  });
  if (res.status === 404 || res.status === 401) return null;
  return toJsonOrThrow(res, "Прогресс чтения");
}

export async function fetchMyReadingProgress() {
  const res = await fetchTryPaths(["/api/reading-progress/ReadingProgress_GetAll"], {
    headers: authHeaders(),
  });
  if (res.status === 401 || res.status === 404) return [];
  return toJsonOrThrow(res, "Прогресс чтения");
}

export async function upsertReadingProgress(payload) {
  const body = {
    bookId: Number(payload.bookId),
    lastPage: payload.lastPage ?? null,
    timecodeSeconds: payload.timecodeSeconds ?? null,
  };
  const res = await fetchTryPaths(["/api/reading-progress/ReadingProgress_Upsert"], {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return toJsonOrThrow(res, "Прогресс чтения");
}

export async function fetchMyPurchases() {
  const res = await fetchTryPaths([
    "/api/Purchases/Purchases_GetMy",
    "/api/Purchases/My",
    "/api/Purchases",
  ], {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Покупки");
}

export async function fetchMyDeliveryOrders() {
  const res = await fetchTryPaths([
    "/api/delivery-orders/DeliveryOrders_GetMy",
    "/api/delivery-orders/DeliveryOrders_GetMine",
    "/api/delivery-orders/my",
    "/api/delivery-orders",
  ], {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Мои заказы");
}

export async function fetchMyProfile() {
  const res = await fetchTryPaths([
    "/api/Users/Users_GetMyProfile",
    "/api/Users/Me",
    "/api/Users/Profile",
  ], {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Профиль");
}

export async function updateMyProfile(payload = {}) {
  const hasField = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  const normalized = {};
  if (hasField("firstName")) normalized.firstName = String(payload.firstName ?? "").trim();
  if (hasField("lastName")) normalized.lastName = String(payload.lastName ?? "").trim();
  if (hasField("middleName")) normalized.middleName = String(payload.middleName ?? "").trim();
  if (hasField("phone")) normalized.phone = String(payload.phone ?? "").trim();
  const lowerPayload = {};
  const upperPayload = {};
  if (hasField("firstName")) {
    lowerPayload.firstName = normalized.firstName;
    upperPayload.FirstName = normalized.firstName;
  }
  if (hasField("lastName")) {
    lowerPayload.lastName = normalized.lastName;
    upperPayload.LastName = normalized.lastName;
  }
  if (hasField("middleName")) {
    lowerPayload.middleName = normalized.middleName || null;
    upperPayload.MiddleName = normalized.middleName || null;
  }
  if (hasField("phone")) {
    lowerPayload.phone = normalized.phone || null;
    upperPayload.Phone = normalized.phone || null;
  }
  const paths = [
    "/api/Users/Users_UpdateMyProfile",
    "/api/Users/UpdateMyProfile",
    "/api/Users/Profile",
    "/api/Users/Me",
  ];
  const payloads = [
    lowerPayload,
    upperPayload,
  ];

  let lastErr = null;
  for (const body of payloads) {
    const res = await fetchTryPaths(paths, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return toJsonOrThrow(res, "Обновление профиля");
    if (![400, 404, 409, 415, 422].includes(res.status)) {
      return toJsonOrThrow(res, "Обновление профиля");
    }
    lastErr = await res.text().catch(() => "");
  }

  throw new Error(lastErr || "Не удалось обновить профиль");
}

export async function createPhysicalOrder(bookId, deliveryAddress, paymentMethod = "card") {
  const paths = [
    "/api/delivery-orders/DeliveryOrders_Create",
    "/api/delivery-orders/Create",
    "/api/delivery-orders",
  ];
  const payloads = [
    { bookId, deliveryAddress, paymentMethod },
    { BookId: bookId, DeliveryAddress: deliveryAddress, PaymentMethod: paymentMethod },
    { bookId, address: deliveryAddress, paymentMethod },
    { BookId: bookId, Address: deliveryAddress, PaymentMethod: paymentMethod },
  ];

  let lastErr = null;
  for (const body of payloads) {
    const res = await fetchTryPaths(paths, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return toJsonOrThrow(res, "Оформление доставки");
    if (![400, 404, 409, 415, 422].includes(res.status)) {
      return toJsonOrThrow(res, "Оформление доставки");
    }
    lastErr = await res.text().catch(() => "");
  }

  throw new Error(lastErr || "Не удалось оформить заказ доставки");
}

export async function fetchSubscriptionPlans() {
  const res = await fetchTryPaths([
    "/api/subscription-plans/SubscriptionPlans_GetAll",
    "/api/SubscriptionPlans/SubscriptionPlans_GetAll",
    "/api/subscription-plans",
  ]);
  return toJsonOrThrow(res, "Тарифы подписки");
}

export async function fetchMySubscriptions() {
  const res = await fetchTryPaths([
    "/api/Subscriptions/Subscriptions_GetMy",
    "/api/Subscriptions/My",
    "/api/Subscriptions",
  ], {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Мои подписки");
}

export async function buySubscription(planId, paymentMethod = "card") {
  const paths = [
    "/api/Subscriptions/Subscriptions_Subscribe",
    "/api/Subscriptions/Subscribe",
    "/api/Subscriptions",
  ];
  const payloads = [
    { planId, paymentMethod },
    { PlanId: planId, PaymentMethod: paymentMethod },
  ];

  let lastErr = null;
  for (const body of payloads) {
    const res = await fetchTryPaths(paths, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return toJsonOrThrow(res, "Подписка");
    if (![400, 404, 409, 415, 422].includes(res.status)) {
      return toJsonOrThrow(res, "Подписка");
    }
    lastErr = await res.text().catch(() => "");
  }

  throw new Error(lastErr || "Подписка: не удалось выполнить запрос");
}

export async function cancelMySubscription() {
  const res = await fetchTryPaths([
    "/api/Subscriptions/Subscriptions_CancelMyActive",
    "/api/Subscriptions/CancelMyActive",
    "/api/Subscriptions/cancel",
  ], {
    method: "PATCH",
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Отмена подписки");
}

export async function buyBook(bookId, paymentMethod = "card") {
  const paths = [
    "/api/Purchases/Purchases_Buy",
    "/api/Purchases/Buy",
    "/api/Purchases",
  ];
  const payloads = [
    { bookId, paymentMethod },
    { BookId: bookId, PaymentMethod: paymentMethod },
  ];

  let lastErr = null;
  for (const body of payloads) {
    const res = await fetchTryPaths(paths, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return toJsonOrThrow(res, "Покупка");
    if (![400, 404, 409, 415, 422].includes(res.status)) {
      return toJsonOrThrow(res, "Покупка");
    }
    lastErr = await res.text().catch(() => "");
  }

  throw new Error(lastErr || "Покупка: не удалось выполнить запрос");
}

export async function fetchReviewsByBook(bookId) {
  const res = await fetchTryPaths([
    `/api/Reviews/book/${bookId}/Reviews_GetByBook`,
    `/api/Reviews/book/${bookId}`,
    `/api/Reviews/${bookId}`,
  ]);
  return toJsonOrThrow(res, "Отзывы");
}

export async function createReview(bookId, rating, reviewText) {
  const payloads = [
    { bookId, rating, reviewText },
    { BookId: bookId, Rating: rating, ReviewText: reviewText },
  ];
  let lastErr = null;
  for (const body of payloads) {
    const res = await fetchTryPaths([
      "/api/Reviews/Reviews_Create",
      "/api/Reviews/Create",
      "/api/Reviews",
    ], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return toJsonOrThrow(res, "Отзыв");
    if (![400, 404, 409, 415, 422].includes(res.status)) {
      return toJsonOrThrow(res, "Отзыв");
    }
    lastErr = await res.text().catch(() => "");
  }
  throw new Error(lastErr || "Не удалось добавить отзыв");
}

export async function updateReview(reviewId, rating, reviewText) {
  const payloads = [
    { rating, reviewText },
    { Rating: rating, ReviewText: reviewText },
  ];
  let lastErr = null;
  for (const body of payloads) {
    const res = await fetchTryPaths([
      `/api/Reviews/${reviewId}/Reviews_Update`,
      `/api/Reviews/${reviewId}/Update`,
      `/api/Reviews/${reviewId}`,
    ], {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return toJsonOrThrow(res, "Обновление отзыва");
    if (![400, 404, 409, 415, 422].includes(res.status)) {
      return toJsonOrThrow(res, "Обновление отзыва");
    }
    lastErr = await res.text().catch(() => "");
  }
  throw new Error(lastErr || "Не удалось обновить отзыв");
}

export async function deleteReview(reviewId) {
  const res = await fetchTryPaths([
    `/api/Reviews/${reviewId}/Reviews_Delete`,
    `/api/Reviews/${reviewId}/Delete`,
    `/api/Reviews/${reviewId}`,
  ], {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(text || "Не удалось удалить отзыв");
}

function normalizeReviewListResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.reviews)) return data.reviews;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function fetchModerationReviewsFromCatalog() {
  const catalog = await fetchBooksCatalog({ page: 1, pageSize: 100, sortBy: "title" });
  const books = Array.isArray(catalog?.items) ? catalog.items : [];
  const reviewsByBook = await Promise.all(
    books.map(async (book) => {
      try {
        const reviews = await fetchReviewsByBook(book.bookId);
        return normalizeReviewListResponse(reviews).map((review) => ({
          ...review,
          bookId: review.bookId ?? review.BookId ?? book.bookId,
          bookTitle: review.bookTitle ?? review.BookTitle ?? book.title,
        }));
      } catch {
        return [];
      }
    }),
  );
  return reviewsByBook.flat();
}

export async function fetchModerationReviews() {
  const paths = [
    "/api/Moderation/reviews/Moderation_GetReviews",
    "/api/Moderation/reviews",
    "/api/moderation/reviews",
    "/api/Reviews/Reviews_GetAll",
    "/api/Reviews/GetAll",
    "/api/Reviews",
  ];

  for (const path of paths) {
    const res = await fetchWithFallback(path, { headers: authHeaders() });
    if ([404, 405].includes(res.status)) continue;
    const data = await toJsonOrThrow(res, "Модерация отзывов");
    return normalizeReviewListResponse(data);
  }

  return fetchModerationReviewsFromCatalog();
}

async function sendModerationReviewAction(reviewId, action, reason = "") {
  const id = Number(reviewId);
  if (Number.isNaN(id)) throw new Error("Некорректный id отзыва.");

  const normalizedAction = String(action || "").trim().toLowerCase();
  const normalizedReason = String(reason || "").trim();
  const actionPaths = {
    hide: [
      `/api/Moderation/reviews/${id}/Moderation_HideReview`,
      `/api/Moderation/reviews/${id}/hide`,
      `/api/moderation/reviews/${id}/hide`,
      `/api/Reviews/${id}/Reviews_Hide`,
      `/api/Reviews/${id}/hide`,
    ],
    violation: [
      `/api/Moderation/reviews/${id}/Moderation_MarkViolation`,
      `/api/Moderation/reviews/${id}/violation`,
      `/api/moderation/reviews/${id}/violation`,
      `/api/Reviews/${id}/Reviews_MarkViolation`,
      `/api/Reviews/${id}/violation`,
    ],
    delete: [
      `/api/Moderation/reviews/${id}/Moderation_DeleteReview`,
      `/api/Moderation/reviews/${id}/delete`,
      `/api/moderation/reviews/${id}/delete`,
      `/api/Reviews/${id}/moderation/Reviews_Delete`,
      `/api/Reviews/${id}/Reviews_DeleteByModerator`,
    ],
  };
  const paths = actionPaths[normalizedAction] || [];
  const payloads = [
    { reason: normalizedReason },
    { Reason: normalizedReason },
    { action: normalizedAction, reason: normalizedReason },
    { Action: normalizedAction, Reason: normalizedReason },
    normalizedAction === "hide" ? { isHidden: true, reason: normalizedReason } : null,
    normalizedAction === "violation" ? { hasViolation: true, reason: normalizedReason } : null,
  ].filter(Boolean);

  let lastErr = "";
  for (const path of paths) {
    const methods = normalizedAction === "delete" ? ["DELETE", "POST", "PATCH"] : ["PATCH", "POST", "PUT"];
    for (const method of methods) {
      for (const body of payloads) {
        const res = await fetchWithFallback(path, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(body),
        });
        if (res.ok) return res;
        if (![400, 404, 405, 409, 415, 422].includes(res.status)) {
          return toJsonOrThrow(res, "Модерация отзыва");
        }
        lastErr = await res.text().catch(() => "");
      }
    }
  }

  throw new Error(lastErr || "Сервер не нашёл endpoint для действия модерации.");
}

export async function hideModerationReview(reviewId, reason) {
  return sendModerationReviewAction(reviewId, "hide", reason);
}

export async function markModerationReviewViolation(reviewId, reason) {
  return sendModerationReviewAction(reviewId, "violation", reason);
}

export async function deleteModerationReview(reviewId, reason = "") {
  try {
    await sendModerationReviewAction(reviewId, "delete", reason);
  } catch {
    await deleteReview(reviewId);
  }
}

export async function fetchModerationLog() {
  const paths = [
    "/api/Moderation/log/Moderation_GetMyLog",
    "/api/Moderation/log",
    "/api/moderation/log",
  ];

  for (const path of paths) {
    const res = await fetchWithFallback(path, { headers: authHeaders() });
    if ([404, 405].includes(res.status)) continue;
    const data = await toJsonOrThrow(res, "Журнал модерации");
    return Array.isArray(data) ? data : normalizeReviewListResponse(data);
  }

  return [];
}

export async function addBookmark(bookId, bookmarkType = "favorite") {
  const paths = [
    "/api/Bookmarks/Bookmarks_Add",
    "/api/Bookmarks/Add",
    "/api/Bookmarks/Bookmarks_Create",
    "/api/Bookmarks/Create",
    "/api/Bookmarks",
  ];

  const payloads = [
    { bookId, bookmarkType },
    { bookId, type: bookmarkType },
    { BookId: bookId, BookmarkType: bookmarkType },
    { BookId: bookId, Type: bookmarkType },
  ];

  let lastErr = null;
  for (const body of payloads) {
    const res = await fetchTryPaths(paths, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await toJsonOrThrow(res, "Добавление в закладки");
      if (data && typeof data === "object") {
        return {
          ...data,
          bookmarkId: data.bookmarkId ?? data.id ?? data.bookmarkID ?? data.bookmark_id ?? null,
        };
      }
      return data;
    }

    if (![400, 404, 415, 422].includes(res.status)) {
      return toJsonOrThrow(res, "Добавление в закладки");
    }
    lastErr = await res.text().catch(() => "");
  }

  throw new Error(lastErr || "Добавление в закладки: не удалось подобрать маршрут API");
}

export async function removeBookmark(bookmarkId) {
  const deletePaths = [
    `/api/Bookmarks/${bookmarkId}/Bookmarks_Remove`,
    `/api/Bookmarks/${bookmarkId}`,
    `/api/Bookmarks/Bookmarks_Delete/${bookmarkId}`,
    `/api/Bookmarks/Delete/${bookmarkId}`,
    `/api/Bookmarks/Bookmarks_Remove/${bookmarkId}`,
    `/api/Bookmarks/Remove/${bookmarkId}`,
  ];

  const delRes = await fetchTryPaths(deletePaths, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (delRes.ok) return;

  const actionPaths = [
    "/api/Bookmarks/Bookmarks_Delete",
    "/api/Bookmarks/Delete",
    "/api/Bookmarks/Bookmarks_Remove",
    "/api/Bookmarks/Remove",
  ];

  const payloads = [
    { bookmarkId },
    { id: bookmarkId },
    { BookmarkId: bookmarkId },
    { Id: bookmarkId },
  ];

  for (const body of payloads) {
    const res = await fetchTryPaths(actionPaths, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return;

    if (![400, 404, 415, 422, 405].includes(res.status)) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Удаление из закладок: ${res.status}`);
    }
  }

  const queryRes = await fetchTryPaths(
    actionPaths.map((p) => `${p}?bookmarkId=${encodeURIComponent(String(bookmarkId))}`),
    { method: "POST", headers: authHeaders() },
  );
  if (queryRes.ok) return;

  const text = await queryRes.text().catch(() => "");
  throw new Error(
    text ||
      `Удаление из закладок: сервер не нашёл подходящий маршрут (последний статус ${queryRes.status}). ` +
        `Нужен реальный endpoint backend для удаления.`,
  );
}

export async function fetchBookRecommendations() {
  const res = await fetchWithFallback("/api/Books/Books_GetRecommendations", {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Рекомендации по книгам");
}

export async function fetchFamilyMembers() {
  const res = await fetchWithFallback("/api/Subscriptions/family-members", {
    headers: authHeaders(),
  });
  return toJsonOrThrow(res, "Члены семьи");
}

export async function addFamilyMember(email) {
  const res = await fetchWithFallback("/api/Subscriptions/family-members", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ email }),
  });
  return toJsonOrThrow(res, "Добавление члена семьи");
}

export async function removeFamilyMember(userId) {
  const res = await fetchWithFallback(`/api/Subscriptions/family-members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(text || "Не удалось удалить участника из семейной подписки.");
}

export async function sendAiAssistantMessage(message) {
  const res = await fetchWithFallback("/api/AiAssistant/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ message }),
  });
  return toJsonOrThrow(res, "ИИ-ассистент");
}

export async function uploadTempFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetchWithFallback("/api/AiAssistant/upload-temp", {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return toJsonOrThrow(res, "Загрузка временного файла");
}

export async function requestPasswordReset(email) {
  const res = await fetchWithFallback("/api/Auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return toJsonOrThrow(res, "Запрос сброса пароля");
}

export async function resetPassword(email, code, newPassword) {
  const res = await fetchWithFallback("/api/Auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });
  return toJsonOrThrow(res, "Сброс пароля");
}

