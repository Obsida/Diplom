import { API_BASE, getAuthToken } from "./api";

function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

function withCredentials(options = {}) {
  return { ...options, credentials: "include" };
}

async function fetchJson(path, options, scopeLabel) {
  const res = await fetch(apiUrl(path), withCredentials(options));
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(text || `${scopeLabel}: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${scopeLabel}: сервер вернул не JSON-ответ.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${scopeLabel}: сервер вернул некорректный JSON.`);
  }
}

async function fetchEmpty(path, options, scopeLabel) {
  const res = await fetch(apiUrl(path), withCredentials(options));
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(text || `${scopeLabel}: ${res.status}`);
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function appendDefinedFormValue(formData, key, value) {
  if (value === undefined || value === null || value === "") return;
  formData.append(key, value);
}

export async function fetchAdminPurchases() {
  return fetchJson("/api/Purchases/Purchases_GetAll", {
    headers: authHeaders(),
  }, "Покупки");
}

export async function fetchAdminBooks() {
  const paths = [
    "/api/Books/Books_GetAllAdmin",
    "/api/Books/Books_GetAll",
    "/api/Books/Admin_GetAll",
  ];

  for (const path of paths) {
    const res = await fetch(apiUrl(path), withCredentials({ headers: authHeaders() }));
    if (res.status === 404) continue;
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(text || `Книги (admin): ${res.status}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Книги (admin): сервер вернул некорректный JSON.");
    }
  }

  // Graceful fallback for old backend without admin-specific route.
  const catalog = await fetchJson("/api/Books/Books_GetCatalog?page=1&pageSize=100&sortBy=title", {
    headers: authHeaders(),
  }, "Каталог");
  return Array.isArray(catalog?.items) ? catalog.items : [];
}

export async function fetchAdminSubscriptions() {
  return fetchJson("/api/Subscriptions/Subscriptions_GetAll", {
    headers: authHeaders(),
  }, "Подписки");
}

export async function fetchAdminDeliveryOrders(status) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  const suffix = query.toString() ? `?${query}` : "";
  return fetchJson(`/api/delivery-orders/DeliveryOrders_GetAll${suffix}`, {
    headers: authHeaders(),
  }, "Заказы доставки");
}

export async function updateAdminDeliveryOrder(orderId, payload) {
  return fetchJson(`/api/delivery-orders/${orderId}/DeliveryOrders_UpdateStatus`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  }, "Обновление заказа");
}

export async function fetchAdminUsers() {
  return fetchJson("/api/Users/Users_GetAll", {
    headers: authHeaders(),
  }, "Пользователи");
}

export async function fetchAdminRoles() {
  return fetchJson("/api/Roles/Roles_GetAll", {
    headers: authHeaders(),
  }, "Роли");
}

export async function assignAdminUserRole(userId, roleId) {
  return fetchEmpty(`/api/Users/${userId}/role/Users_AssignRole`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ roleId }),
  }, "Назначение роли");
}

export async function createAuthor(payload) {
  return fetchJson("/api/Authors/Authors_Create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  }, "Создание автора");
}

export async function updateAuthor(authorId, payload) {
  return fetchJson(`/api/Authors/${authorId}/Authors_Update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  }, "Редактирование автора");
}

export async function createCategory(payload) {
  return fetchJson("/api/Categories/Categories_Create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  }, "Создание категории");
}

export async function updateCategory(categoryId, payload) {
  return fetchJson(`/api/Categories/${categoryId}/Categories_Update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  }, "Редактирование категории");
}

export async function createSubcategory(payload) {
  return fetchJson("/api/Subcategories/Subcategories_Create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  }, "Создание подкатегории");
}

export async function updateSubcategory(subcategoryId, payload) {
  return fetchJson(`/api/Subcategories/${subcategoryId}/Subcategories_Update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  }, "Редактирование подкатегории");
}

export async function createAdminBook(payload) {
  const formData = new FormData();
  appendDefinedFormValue(formData, "Title", payload.title);
  appendDefinedFormValue(formData, "AuthorId", String(payload.authorId));
  appendDefinedFormValue(formData, "CategoryId", String(payload.categoryId));
  appendDefinedFormValue(formData, "SubcategoryId", String(payload.subcategoryId));
  appendDefinedFormValue(formData, "PublicationYear", String(payload.publicationYear));
  appendDefinedFormValue(formData, "Publisher", payload.publisher);
  appendDefinedFormValue(formData, "Synopsis", payload.synopsis);
  appendDefinedFormValue(formData, "Price", String(payload.price));
  appendDefinedFormValue(formData, "StockQuantity", String(payload.stockQuantity));
  if (payload.cover) formData.append("cover", payload.cover);
  if (payload.pdf) formData.append("pdf", payload.pdf);
  if (payload.audio) formData.append("audio", payload.audio);

  return fetchJson("/api/Books/Books_Create", {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  }, "Создание книги");
}

export async function updateAdminBook(bookId, payload) {
  const formData = new FormData();
  appendDefinedFormValue(formData, "Title", payload.title);
  appendDefinedFormValue(formData, "AuthorId", payload.authorId != null ? String(payload.authorId) : null);
  appendDefinedFormValue(formData, "CategoryId", payload.categoryId != null ? String(payload.categoryId) : null);
  appendDefinedFormValue(formData, "SubcategoryId", payload.subcategoryId != null ? String(payload.subcategoryId) : null);
  appendDefinedFormValue(formData, "PublicationYear", payload.publicationYear != null ? String(payload.publicationYear) : null);
  appendDefinedFormValue(formData, "Publisher", payload.publisher);
  appendDefinedFormValue(formData, "Synopsis", payload.synopsis);
  appendDefinedFormValue(formData, "Price", payload.price != null ? String(payload.price) : null);
  appendDefinedFormValue(formData, "StockQuantity", payload.stockQuantity != null ? String(payload.stockQuantity) : null);
  appendDefinedFormValue(formData, "IsActive", payload.isActive != null ? String(payload.isActive) : null);
  if (payload.cover) formData.append("cover", payload.cover);
  if (payload.pdf) formData.append("pdf", payload.pdf);
  if (payload.audio) formData.append("audio", payload.audio);

  return fetchJson(`/api/Books/${bookId}/Books_Update`, {
    method: "PUT",
    headers: authHeaders(),
    body: formData,
  }, "Редактирование книги");
}

export async function archiveAdminBook(bookId) {
  return fetchEmpty(`/api/Books/${bookId}/Books_Archive`, {
    method: "DELETE",
    headers: authHeaders(),
  }, "Архивация книги");
}
