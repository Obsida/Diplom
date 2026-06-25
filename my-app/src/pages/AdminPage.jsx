import { useEffect, useMemo, useState } from "react";
import "../App.css";
import "./AdminPage.css";
import AdminBooksTab from "../components/admin/AdminBooksTab";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AuthModal from "../components/AuthModal";
import {
  clearAuthToken,
  fetchAuthors,
  fetchCategories,
  getAuthRole,
  getAuthToken,
  isAdminToken,
} from "../api";
import {
  archiveAdminBook,
  assignAdminUserRole,
  createAuthor,
  createAdminBook,
  createCategory,
  createSubcategory,
  fetchAdminBooks,
  fetchAdminRoles,
  fetchAdminSubscriptions,
  fetchAdminUsers,
  updateAuthor,
  updateAdminBook,
  updateCategory,
  updateSubcategory,
  fetchAdminPurchases,
  fetchAdminDeliveryOrders,
} from "../adminApi";

const ADMIN_TABS = [
  { id: "books", label: "Книги" },
  { id: "authors", label: "Авторы" },
  { id: "categories", label: "Категории" },
  { id: "subcategories", label: "Подкатегории" },
  { id: "statistics", label: "Статистика" },
  { id: "users", label: "Пользователи" },
];

const MIN_AUTHOR_AGE = 18;

const ADMIN_STATUS_LABELS = {
  active: "Активна",
  cancelled: "Отменена",
  completed: "Завершена",
  expired: "Истекла",
  failed: "Ошибка оплаты",
  none: "Нет подписки",
  pending: "Ожидает оплаты",
  success: "Успешно",
};

const PAYMENT_METHOD_LABELS = {
  card: "Банковская карта",
  cash: "Наличные",
  sbp: "СБП",
};

const ROLE_LABELS = {
  admin: "Администратор",
  client: "Клиент",
  meneger: "Менеджер",
};

const emptyBookForm = {
  title: "",
  authorId: "",
  categoryId: "",
  subcategoryId: "",
  publicationYear: "",
  publisher: "",
  synopsis: "",
  price: "",
  stockQuantity: "",
  cover: null,
  pdf: null,
  audio: null,
};

const emptyCategoryForm = { name: "", description: "" };
const emptySubcategoryForm = { categoryId: "", name: "", description: "" };
const emptyAuthorForm = { fullName: "", biography: "", birthYear: "", deathYear: "", isAlive: true };

function formatMoney(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ru-RU");
}

function formatDateOnly(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ru-RU");
}

function formatAuthorLifeDates(author) {
  const birthDate = author?.birthYear ? formatDateOnly(author.birthYear) : "Дата рождения не указана";
  const deathDate = author?.deathYear ? formatDateOnly(author.deathYear) : "по настоящее время";
  return `${birthDate} - ${deathDate}`;
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? Number.NaN : date;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMaxAuthorBirthDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MIN_AUTHOR_AGE);
  return formatDateForInput(date);
}

function validateAuthorDates(birthYear, deathYear) {
  const birthDate = parseDateOnly(birthYear);
  const deathDate = parseDateOnly(deathYear);

  if (Number.isNaN(birthDate) || Number.isNaN(deathDate)) {
    return "Укажите корректные даты автора.";
  }

  if (birthDate) {
    const minBirthDate = new Date();
    minBirthDate.setFullYear(minBirthDate.getFullYear() - MIN_AUTHOR_AGE);
    if (birthDate > minBirthDate) {
      return `Автор должен быть не младше ${MIN_AUTHOR_AGE} лет.`;
    }
  }

  if (birthDate && deathDate && deathDate <= birthDate) {
    return "Дата рождения должна быть раньше даты смерти.";
  }

  return "";
}

function formatAdminStatus(status) {
  const key = String(status || "").trim().toLowerCase();
  if (!key) return "—";
  return ADMIN_STATUS_LABELS[key] || status;
}

function formatPaymentMethod(method) {
  const key = String(method || "").trim().toLowerCase();
  if (!key) return "—";
  return PAYMENT_METHOD_LABELS[key] || method;
}

function formatRoleName(roleName) {
  const key = String(roleName || "").trim().toLowerCase();
  if (!key) return "—";
  return ROLE_LABELS[key] || roleName;
}

function normalizeBookDraft(book) {
  return {
    title: book?.title ?? "",
    authorId: book?.authorId != null ? String(book.authorId) : "",
    categoryId: book?.categoryId != null ? String(book.categoryId) : "",
    subcategoryId: book?.subcategoryId != null ? String(book.subcategoryId) : "",
    publicationYear: book?.publicationYear != null ? String(book.publicationYear) : "",
    publisher: book?.publisher ?? "",
    synopsis: book?.synopsis ?? "",
    price: book?.price != null && book?.price !== "" ? String(book.price) : "",
    stockQuantity: book?.stockQuantity != null ? String(book.stockQuantity) : "",
    isActive: book?.isActive !== false,
    cover: null,
    pdf: null,
    audio: null,
  };
}

function buildBookDrafts(items) {
  return Object.fromEntries((items || []).map((book) => [book.bookId, normalizeBookDraft(book)]));
}

function normalizeAuthorDraft(author) {
  return {
    fullName: author?.fullName ?? "",
    biography: author?.biography ?? "",
    birthYear: author?.birthYear ?? "",
    deathYear: author?.deathYear ?? "",
    isAlive: !author?.deathYear,
  };
}

function buildAuthorDrafts(items) {
  return Object.fromEntries((items || []).map((author) => [author.authorId, normalizeAuthorDraft(author)]));
}

function normalizeCategoryDraft(category) {
  return {
    name: category?.name ?? "",
    description: category?.description ?? "",
    isActive: category?.isActive !== false,
  };
}

function buildCategoryDrafts(items) {
  return Object.fromEntries((items || []).map((category) => [category.categoryId, normalizeCategoryDraft(category)]));
}

function normalizeSubcategoryDraft(subcategory) {
  return {
    name: subcategory?.name ?? "",
    description: subcategory?.description ?? "",
    isActive: subcategory?.isActive !== false,
  };
}

function buildSubcategoryDrafts(items) {
  return Object.fromEntries(
    (items || []).flatMap((category) =>
      (category.subcategories || []).map((subcategory) => [
        subcategory.subcategoryId,
        normalizeSubcategoryDraft(subcategory),
      ]),
    ),
  );
}

const MIN_PUBLICATION_YEAR = 1000;
const MAX_PUBLICATION_YEAR = new Date().getFullYear() + 1;
const TEXT_LIMITS = {
  title: 160,
  publisher: 120,
  synopsis: 4000,
  categoryName: 120,
  description: 1000,
};

function normalizeDecimalText(value) {
  return String(value ?? "").trim().replace(",", ".");
}

function parseFiniteNumber(value) {
  const text = normalizeDecimalText(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : Number.NaN;
}

function parseFiniteInteger(value) {
  const text = String(value ?? "").trim();
  if (!text || !/^\d+$/.test(text)) return text ? Number.NaN : null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : Number.NaN;
}

function fileMatches(file, kind) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  if (kind === "cover") return type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);
  if (kind === "pdf") return type === "application/pdf" || /\.pdf$/i.test(name);
  if (kind === "audio") return type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(name);
  return false;
}

function validateOptionalFile(file, kind, label) {
  if (!file) return "";
  return fileMatches(file, kind) ? "" : `${label}: выбран неподдерживаемый тип файла.`;
}

function validateBookDraft(draft, { requireFiles = false } = {}) {
  const title = String(draft?.title ?? "").trim();
  const publisher = String(draft?.publisher ?? "").trim();
  const synopsis = String(draft?.synopsis ?? "").trim();
  const authorId = parseFiniteInteger(draft?.authorId);
  const categoryId = parseFiniteInteger(draft?.categoryId);
  const subcategoryId = parseFiniteInteger(draft?.subcategoryId);
  const publicationYear = parseFiniteInteger(draft?.publicationYear);
  const price = parseFiniteNumber(draft?.price);
  const stockQuantity = parseFiniteInteger(draft?.stockQuantity);

  if (!title) return { message: "Укажите название книги." };
  if (title.length > TEXT_LIMITS.title) return { message: `Название не должно быть длиннее ${TEXT_LIMITS.title} символов.` };
  if (authorId == null || Number.isNaN(authorId) || authorId <= 0) return { message: "Выберите корректного автора." };
  if (categoryId == null || Number.isNaN(categoryId) || categoryId <= 0) return { message: "Выберите корректную категорию." };
  if (subcategoryId == null || Number.isNaN(subcategoryId) || subcategoryId <= 0) return { message: "Выберите корректную подкатегорию." };
  if (publicationYear == null || Number.isNaN(publicationYear)) return { message: "Укажите год издания целым числом." };
  if (publicationYear < MIN_PUBLICATION_YEAR || publicationYear > MAX_PUBLICATION_YEAR) {
    return { message: `Год издания должен быть от ${MIN_PUBLICATION_YEAR} до ${MAX_PUBLICATION_YEAR}.` };
  }
  if (price == null || Number.isNaN(price) || price <= 0) return { message: "Укажите цену больше 0." };
  if (stockQuantity == null || Number.isNaN(stockQuantity) || stockQuantity < 0) {
    return { message: "Укажите остаток целым числом от 0." };
  }
  if (!publisher) return { message: "Укажите издателя." };
  if (publisher.length > TEXT_LIMITS.publisher) return { message: `Издатель не должен быть длиннее ${TEXT_LIMITS.publisher} символов.` };
  if (!synopsis) return { message: "Заполните описание книги." };
  if (synopsis.length > TEXT_LIMITS.synopsis) return { message: `Описание не должно быть длиннее ${TEXT_LIMITS.synopsis} символов.` };

  const fileFields = [
    ["cover", "cover", "Обложка"],
    ["pdf", "pdf", "PDF"],
    ["audio", "audio", "Аудио"],
  ];
  for (const [field, kind, label] of fileFields) {
    if (requireFiles && !draft?.[field]) return { message: `${label}: выберите файл.` };
    const fileError = validateOptionalFile(draft?.[field], kind, label);
    if (fileError) return { message: fileError };
  }

  return {
    values: {
      title,
      authorId,
      categoryId,
      subcategoryId,
      publicationYear,
      publisher,
      synopsis,
      price,
      stockQuantity,
      cover: draft?.cover || null,
      pdf: draft?.pdf || null,
      audio: draft?.audio || null,
    },
  };
}

export default function AdminPage() {
  const [authToken, setAuthToken] = useState(() => getAuthToken());
  const [authOpen, setAuthOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [activeTab, setActiveTab] = useState("books");

  const [books, setBooks] = useState([]);
  const [bookDrafts, setBookDrafts] = useState({});
  const [authors, setAuthors] = useState([]);
  const [authorDrafts, setAuthorDrafts] = useState({});
  const [categories, setCategories] = useState([]);
  const [categoryDrafts, setCategoryDrafts] = useState({});
  const [subcategoryDrafts, setSubcategoryDrafts] = useState({});
  const [expandedAuthorEdits, setExpandedAuthorEdits] = useState({});
  const [expandedCategoryEdits, setExpandedCategoryEdits] = useState({});
  const [expandedSubcategoryEdits, setExpandedSubcategoryEdits] = useState({});
  const [subscriptions, setSubscriptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userRoleDrafts, setUserRoleDrafts] = useState({});

  const [adminPurchases, setAdminPurchases] = useState([]);
  const [adminPurchasesLoading, setAdminPurchasesLoading] = useState(false);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);
  const [statStartDate, setStatStartDate] = useState("");
  const [statEndDate, setStatEndDate] = useState("");

  const [booksLoading, setBooksLoading] = useState(false);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const [savingBookId, setSavingBookId] = useState(null);
  const [savingAuthorId, setSavingAuthorId] = useState(null);
  const [savingCategoryId, setSavingCategoryId] = useState(null);
  const [savingSubcategoryId, setSavingSubcategoryId] = useState(null);
  const [archivingBookId, setArchivingBookId] = useState(null);
  const [creatingBook, setCreatingBook] = useState(false);
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [authorForm, setAuthorForm] = useState(emptyAuthorForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [subcategoryForm, setSubcategoryForm] = useState(emptySubcategoryForm);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [bookListSearch, setBookListSearch] = useState("");
  const [bookListSort, setBookListSort] = useState("title");
  const [bookListFilter, setBookListFilter] = useState("all");
  const [addBookModalOpen, setAddBookModalOpen] = useState(false);

  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);

  const [authorSearch, setAuthorSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");

  const [addAuthorModalOpen, setAddAuthorModalOpen] = useState(false);
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [addSubcategoryModalOpen, setAddSubcategoryModalOpen] = useState(false);

  const authRole = getAuthRole(authToken);
  const isAdmin = isAdminToken(authToken);

  const selectedCreateCategory = useMemo(
    () => categories.find((item) => Number(item.categoryId) === Number(bookForm.categoryId)),
    [categories, bookForm.categoryId],
  );

  const selectedSubcategoryCategory = useMemo(
    () => categories.find((item) => Number(item.categoryId) === Number(subcategoryForm.categoryId)),
    [categories, subcategoryForm.categoryId],
  );

  const filteredAdminBooks = useMemo(() => {
    const query = bookListSearch.trim().toLowerCase();
    let list = Array.isArray(books) ? [...books] : [];

    if (bookListFilter === "active") {
      list = list.filter((item) => item.isActive !== false);
    } else if (bookListFilter === "archived") {
      list = list.filter((item) => item.isActive === false);
    } else if (bookListFilter === "emptyFields") {
      list = list.filter((item) => !item.hasCover || !item.hasPdf || !item.hasAudio || !item.synopsis || !item.publisher);
    }

    if (query) {
      list = list.filter((item) => {
        const haystack = [
          item.title,
          item.authorName,
          item.categoryName,
          item.publisher,
          String(item.bookId),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    list.sort((left, right) => {
      if (bookListSort === "rating") {
        return Number(right.rating) - Number(left.rating);
      }
      if (bookListSort === "price") {
        return Number(left.price) - Number(right.price);
      }
      if (bookListSort === "id") {
        return Number(left.bookId) - Number(right.bookId);
      }
      return String(left.title || "").localeCompare(String(right.title || ""), "ru");
    });

    return list;
  }, [books, bookListFilter, bookListSearch, bookListSort]);

  const selectedBook = books.find((item) => item.bookId === selectedBookId) || null;
  const selectedBookDraft = selectedBookId != null ? bookDrafts[selectedBookId] : null;

  const allSubcategories = useMemo(() => {
    return (categories || []).flatMap((category) =>
      (category.subcategories || []).map((sub) => ({
        ...sub,
        categoryId: category.categoryId,
        categoryName: category.name,
      }))
    );
  }, [categories]);

  const filteredAdminAuthors = useMemo(() => {
    const query = authorSearch.trim().toLowerCase();
    if (!query) return [];
    return (authors || []).filter((item) =>
      String(item.fullName || "").toLowerCase().includes(query) ||
      String(item.authorId).includes(query)
    );
  }, [authors, authorSearch]);

  const filteredAdminCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return [];
    return (categories || []).filter((item) =>
      String(item.name || "").toLowerCase().includes(query) ||
      String(item.categoryId).includes(query)
    );
  }, [categories, categorySearch]);

  const filteredAdminSubcategories = useMemo(() => {
    const query = subcategorySearch.trim().toLowerCase();
    if (!query) return [];
    return allSubcategories.filter((item) =>
      String(item.name || "").toLowerCase().includes(query) ||
      String(item.categoryName || "").toLowerCase().includes(query) ||
      String(item.subcategoryId).includes(query)
    );
  }, [allSubcategories, subcategorySearch]);

  const selectedAuthor = (authors || []).find((item) => item.authorId === selectedAuthorId) || null;
  const selectedAuthorDraft = selectedAuthorId != null ? authorDrafts[selectedAuthorId] : null;

  const selectedCategory = (categories || []).find((item) => item.categoryId === selectedCategoryId) || null;
  const selectedCategoryDraft = selectedCategoryId != null ? categoryDrafts[selectedCategoryId] : null;

  const selectedSubcategory = allSubcategories.find((item) => item.subcategoryId === selectedSubcategoryId) || null;
  const selectedSubcategoryDraft = selectedSubcategoryId != null ? subcategoryDrafts[selectedSubcategoryId] : null;

  const totalRevenue = useMemo(() => {
    return (subscriptions || []).reduce((acc, s) => acc + (s.paidAmount || 0), 0);
  }, [subscriptions]);

  const totalStockValue = useMemo(() => {
    return (books || []).reduce((acc, b) => acc + (b.price || 0) * (b.stockQuantity || 0), 0);
  }, [books]);

  const categoryStats = useMemo(() => {
    const stats = {};
    (categories || []).forEach((c) => {
      stats[c.name] = 0;
    });
    (books || []).forEach((b) => {
      if (b.categoryName && stats[b.categoryName] !== undefined) {
        stats[b.categoryName]++;
      }
    });
    return Object.entries(stats)
      .map(([name, count]) => ({
        name,
        count,
        percentage: books.length ? Math.round((count / books.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [categories, books]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const handleCatalogUpdated = () => {
      loadReferences();
      loadBooks();
    };
    window.addEventListener("catalog-updated", handleCatalogUpdated);
    return () => window.removeEventListener("catalog-updated", handleCatalogUpdated);
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setToastMessage(String(message ?? ""));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  async function loadReferences() {
    setReferencesLoading(true);
    try {
      const [authorsData, categoriesData, rolesData] = await Promise.all([
        fetchAuthors(),
        fetchCategories(),
        fetchAdminRoles(),
      ]);
      const authorItems = Array.isArray(authorsData) ? authorsData : [];
      const categoryItems = Array.isArray(categoriesData) ? categoriesData : [];
      setAuthors(authorItems);
      setAuthorDrafts(buildAuthorDrafts(authorItems));
      setCategories(categoryItems);
      setCategoryDrafts(buildCategoryDrafts(categoryItems));
      setSubcategoryDrafts(buildSubcategoryDrafts(categoryItems));
      setRoles(Array.isArray(rolesData) ? rolesData.filter((item) => item?.isActive !== false) : []);
    } finally {
      setReferencesLoading(false);
    }
  }

  async function loadBooks() {
    setBooksLoading(true);
    try {
      const data = await fetchAdminBooks();
      const items = Array.isArray(data) ? data : [];
      setBooks(items);
      setBookDrafts(buildBookDrafts(items));
    } finally {
      setBooksLoading(false);
    }
  }

  async function loadSubscriptions() {
    setSubscriptionsLoading(true);
    try {
      const data = await fetchAdminSubscriptions();
      setSubscriptions(Array.isArray(data) ? data : []);
    } finally {
      setSubscriptionsLoading(false);
    }
  }

  async function loadAdminPurchases() {
    setAdminPurchasesLoading(true);
    try {
      const data = await fetchAdminPurchases();
      setAdminPurchases(Array.isArray(data) ? data : []);
    } catch {
      setAdminPurchases([]);
    } finally {
      setAdminPurchasesLoading(false);
    }
  }

  async function loadAdminOrders() {
    setAdminOrdersLoading(true);
    try {
      const data = await fetchAdminDeliveryOrders();
      setAdminOrders(Array.isArray(data) ? data : []);
    } catch {
      setAdminOrders([]);
    } finally {
      setAdminOrdersLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const data = await fetchAdminUsers();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      setUserRoleDrafts(
        Object.fromEntries(list.map((item) => [item.userId, item.roleName?.toLowerCase?.() || ""])),
      );
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    if (!authToken || !isAdmin) return;
    let cancelled = false;

    const loadAll = async () => {
      setPageError("");
      try {
        await Promise.all([
          loadReferences(),
          loadBooks(),
          loadSubscriptions(),
          loadUsers(),
          loadAdminPurchases(),
          loadAdminOrders(),
        ]);
      } catch (error) {
        if (!cancelled) setPageError(error?.message || "Не удалось загрузить данные админ-панели.");
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [authToken, isAdmin]);

  const handleBookDraftChange = (bookId, field, value) => {
    setBookDrafts((prev) => ({
      ...prev,
      [bookId]: {
        ...(prev[bookId] || {}),
        [field]: value,
      },
    }));
  };

  const handleBookCategoryChange = (bookId, categoryId) => {
    setBookDrafts((prev) => {
      const base = prev[bookId];
      return {
        ...prev,
        [bookId]: {
          ...base,
          categoryId: String(categoryId),
          subcategoryId: "",
        },
      };
    });
  };

  const handleBookFileChange = (bookId, field, file) => {
    setBookDrafts((prev) => ({
      ...prev,
      [bookId]: {
        ...(prev[bookId] || {}),
        [field]: file || null,
      },
    }));
  };

  const handleAuthorDraftChange = (authorId, field, value) => {
    setAuthorDrafts((prev) => ({
      ...prev,
      [authorId]: {
        ...(prev[authorId] || {}),
        [field]: value,
      },
    }));
  };

  const handleAuthorDraftAliveChange = (authorId, isAlive) => {
    setAuthorDrafts((prev) => ({
      ...prev,
      [authorId]: {
        ...(prev[authorId] || {}),
        isAlive,
        deathYear: isAlive ? "" : (prev[authorId]?.deathYear ?? ""),
      },
    }));
  };

  const handleCategoryDraftChange = (categoryId, field, value) => {
    setCategoryDrafts((prev) => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSubcategoryDraftChange = (subcategoryId, field, value) => {
    setSubcategoryDrafts((prev) => ({
      ...prev,
      [subcategoryId]: {
        ...(prev[subcategoryId] || {}),
        [field]: value,
      },
    }));
  };

  const toggleAuthorEdit = (authorId) => {
    setExpandedAuthorEdits((prev) => ({ ...prev, [authorId]: !prev[authorId] }));
  };

  const toggleCategoryEdit = (categoryId) => {
    setExpandedCategoryEdits((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const toggleSubcategoryEdit = (subcategoryId) => {
    setExpandedSubcategoryEdits((prev) => ({ ...prev, [subcategoryId]: !prev[subcategoryId] }));
  };

  const handleSaveBook = async (bookId) => {
    const draft = bookDrafts[bookId];
    if (!draft) return;
    const validation = validateBookDraft(draft);
    if (validation.message) {
      setToastMessage(validation.message);
      return;
    }
    const title = (draft.title ?? "").trim();
    if (!title) {
      setToastMessage("Укажите название книги.");
      return;
    }
    const authorId = draft.authorId === "" ? null : Number(draft.authorId);
    const categoryId = draft.categoryId === "" ? null : Number(draft.categoryId);
    const subcategoryId = draft.subcategoryId === "" ? null : Number(draft.subcategoryId);
    const publicationYear = draft.publicationYear === "" ? null : Number(draft.publicationYear);
    if (authorId != null && Number.isNaN(authorId)) {
      setToastMessage("Некорректный автор.");
      return;
    }
    if (categoryId != null && Number.isNaN(categoryId)) {
      setToastMessage("Некорректная категория.");
      return;
    }
    if (subcategoryId != null && Number.isNaN(subcategoryId)) {
      setToastMessage("Некорректная подкатегория.");
      return;
    }
    if (publicationYear != null && Number.isNaN(publicationYear)) {
      setToastMessage("Некорректный год издания.");
      return;
    }
    setSavingBookId(bookId);
    try {
      await updateAdminBook(bookId, {
        title,
        authorId,
        categoryId,
        subcategoryId,
        publicationYear,
        publisher: (draft.publisher ?? "").trim() || null,
        synopsis: draft.synopsis ?? "",
        price: parseFiniteNumber(draft.price),
        stockQuantity: parseFiniteInteger(draft.stockQuantity),
        isActive: Boolean(draft.isActive),
        cover: draft.cover || null,
        pdf: draft.pdf || null,
        audio: draft.audio || null,
      });
      await loadBooks();
      setToastMessage("Книга обновлена.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось обновить книгу.");
    } finally {
      setSavingBookId(null);
    }
  };

  const handleArchiveBook = async (bookId) => {
    setArchivingBookId(bookId);
    try {
      await archiveAdminBook(bookId);
      await loadBooks();
      setToastMessage("Книга отправлена в архив.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось архивировать книгу.");
    } finally {
      setArchivingBookId(null);
    }
  };

  const handleUnarchiveBook = async (bookId) => {
    setArchivingBookId(bookId);
    try {
      await updateAdminBook(bookId, { isActive: true });
      await loadBooks();
      setToastMessage("Книга возвращена из архива.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось вернуть книгу из архива.");
    } finally {
      setArchivingBookId(null);
    }
  };

  const handleCreateBook = async (event) => {
    event.preventDefault();
    const validation = validateBookDraft(bookForm, { requireFiles: true });
    if (validation.message) {
      setToastMessage(validation.message);
      return;
    }
    setCreatingBook(true);
    try {
      await createAdminBook({
        title: bookForm.title.trim(),
        authorId: Number(bookForm.authorId),
        categoryId: Number(bookForm.categoryId),
        subcategoryId: Number(bookForm.subcategoryId),
        publicationYear: Number(bookForm.publicationYear),
        publisher: bookForm.publisher.trim(),
        synopsis: bookForm.synopsis.trim(),
        price: parseFiniteNumber(bookForm.price),
        stockQuantity: parseFiniteInteger(bookForm.stockQuantity),
        cover: bookForm.cover,
        pdf: bookForm.pdf,
        audio: bookForm.audio,
      });
      setBookForm(emptyBookForm);
      setAddBookModalOpen(false);
      await loadBooks();
      setToastMessage("Новая книга добавлена.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось добавить книгу.");
    } finally {
      setCreatingBook(false);
    }
  };

  const handleCreateAuthor = async (event) => {
    event.preventDefault();
    const fullName = authorForm.fullName.trim();
    const biography = authorForm.biography.trim();
    const birthYear = authorForm.birthYear || null;
    const deathYear = authorForm.isAlive ? null : (authorForm.deathYear || null);

    if (!fullName) {
      setToastMessage("Укажите имя автора.");
      return;
    }
    if (fullName.length > TEXT_LIMITS.title) {
      setToastMessage(`Имя автора не должно быть длиннее ${TEXT_LIMITS.title} символов.`);
      return;
    }
    if (biography.length > TEXT_LIMITS.synopsis) {
      setToastMessage(`Биография не должна быть длиннее ${TEXT_LIMITS.synopsis} символов.`);
      return;
    }
    const dateError = validateAuthorDates(birthYear, deathYear);
    if (dateError) {
      setToastMessage(dateError);
      return;
    }

    setCreatingAuthor(true);
    try {
      await createAuthor({
        fullName,
        biography: biography || null,
        birthYear,
        deathYear,
      });
      setAuthorForm(emptyAuthorForm);
      setAddAuthorModalOpen(false);
      await loadReferences();
      setToastMessage("Автор добавлен.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось добавить автора.");
    } finally {
      setCreatingAuthor(false);
    }
  };

  const handleSaveAuthor = async (authorId) => {
    const draft = authorDrafts[authorId];
    if (!draft) return;

    const fullName = draft.fullName.trim();
    const biography = draft.biography.trim();
    const birthYear = draft.birthYear || null;
    const deathYear = draft.isAlive ? null : (draft.deathYear || null);

    if (!fullName) {
      setToastMessage("Укажите имя автора.");
      return;
    }
    if (fullName.length > TEXT_LIMITS.title) {
      setToastMessage(`Имя автора не должно быть длиннее ${TEXT_LIMITS.title} символов.`);
      return;
    }
    if (biography.length > TEXT_LIMITS.synopsis) {
      setToastMessage(`Биография не должна быть длиннее ${TEXT_LIMITS.synopsis} символов.`);
      return;
    }
    const dateError = validateAuthorDates(birthYear, deathYear);
    if (dateError) {
      setToastMessage(dateError);
      return;
    }

    setSavingAuthorId(authorId);
    try {
      await updateAuthor(authorId, {
        fullName,
        biography: biography || null,
        birthYear,
        deathYear,
      });
      await loadReferences();
      setToastMessage("Автор обновлен.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось обновить автора.");
    } finally {
      setSavingAuthorId(null);
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    const name = categoryForm.name.trim();
    const description = categoryForm.description.trim();
    if (!name) {
      setToastMessage("Укажите название категории.");
      return;
    }
    if (name.length > TEXT_LIMITS.categoryName) {
      setToastMessage(`Название категории не должно быть длиннее ${TEXT_LIMITS.categoryName} символов.`);
      return;
    }
    if (!description) {
      setToastMessage("Заполните описание категории.");
      return;
    }
    if (description.length > TEXT_LIMITS.description) {
      setToastMessage(`Описание не должно быть длиннее ${TEXT_LIMITS.description} символов.`);
      return;
    }
    setCreatingCategory(true);
    try {
      await createCategory({
        name,
        description,
      });
      setCategoryForm(emptyCategoryForm);
      setAddCategoryModalOpen(false);
      await loadReferences();
      setToastMessage("Категория добавлена.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось добавить категорию.");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSaveCategory = async (categoryId) => {
    const draft = categoryDrafts[categoryId];
    if (!draft) return;

    const name = draft.name.trim();
    const description = draft.description.trim();

    if (!name) {
      setToastMessage("Укажите название категории.");
      return;
    }
    if (name.length > TEXT_LIMITS.categoryName) {
      setToastMessage(`Название категории не должно быть длиннее ${TEXT_LIMITS.categoryName} символов.`);
      return;
    }
    if (description.length > TEXT_LIMITS.description) {
      setToastMessage(`Описание не должно быть длиннее ${TEXT_LIMITS.description} символов.`);
      return;
    }

    setSavingCategoryId(categoryId);
    try {
      await updateCategory(categoryId, {
        name,
        description,
        isActive: Boolean(draft.isActive),
      });
      await loadReferences();
      setToastMessage("Категория обновлена.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось обновить категорию.");
    } finally {
      setSavingCategoryId(null);
    }
  };

  const handleCreateSubcategory = async (event) => {
    event.preventDefault();
    const categoryId = parseFiniteInteger(subcategoryForm.categoryId);
    const name = subcategoryForm.name.trim();
    const description = subcategoryForm.description.trim();
    if (categoryId == null || Number.isNaN(categoryId) || categoryId <= 0) {
      setToastMessage("Выберите категорию для подкатегории.");
      return;
    }
    if (!name) {
      setToastMessage("Укажите название подкатегории.");
      return;
    }
    if (name.length > TEXT_LIMITS.categoryName) {
      setToastMessage(`Название подкатегории не должно быть длиннее ${TEXT_LIMITS.categoryName} символов.`);
      return;
    }
    if (!description) {
      setToastMessage("Заполните описание подкатегории.");
      return;
    }
    if (description.length > TEXT_LIMITS.description) {
      setToastMessage(`Описание не должно быть длиннее ${TEXT_LIMITS.description} символов.`);
      return;
    }
    setCreatingSubcategory(true);
    try {
      await createSubcategory({
        categoryId,
        name,
        description,
      });
      setSubcategoryForm(emptySubcategoryForm);
      setAddSubcategoryModalOpen(false);
      await loadReferences();
      setToastMessage("Подкатегория добавлена.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось добавить подкатегорию.");
    } finally {
      setCreatingSubcategory(false);
    }
  };

  const handleSaveSubcategory = async (subcategoryId) => {
    const draft = subcategoryDrafts[subcategoryId];
    if (!draft) return;

    const name = draft.name.trim();
    const description = draft.description.trim();

    if (!name) {
      setToastMessage("Укажите название подкатегории.");
      return;
    }
    if (name.length > TEXT_LIMITS.categoryName) {
      setToastMessage(`Название подкатегории не должно быть длиннее ${TEXT_LIMITS.categoryName} символов.`);
      return;
    }
    if (description.length > TEXT_LIMITS.description) {
      setToastMessage(`Описание не должно быть длиннее ${TEXT_LIMITS.description} символов.`);
      return;
    }

    setSavingSubcategoryId(subcategoryId);
    try {
      await updateSubcategory(subcategoryId, {
        name,
        description,
        isActive: Boolean(draft.isActive),
      });
      await loadReferences();
      setToastMessage("Подкатегория обновлена.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось обновить подкатегорию.");
    } finally {
      setSavingSubcategoryId(null);
    }
  };

  const handleUserRoleSave = async (userId) => {
    const selectedName = userRoleDrafts[userId];
    const selectedRole = roles.find((item) => item.name?.toLowerCase?.() === selectedName);
    if (!selectedRole) return;
    setUpdatingUserId(userId);
    try {
      await assignAdminUserRole(userId, selectedRole.roleId);
      await loadUsers();
      setToastMessage("Роль пользователя обновлена.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось назначить роль.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const renderBooksTab = () => (
    <AdminBooksTab
      booksLoading={booksLoading}
      filteredBooks={filteredAdminBooks}
      totalBooksCount={books.length}
      bookListSearch={bookListSearch}
      onBookListSearchChange={setBookListSearch}
      bookListFilter={bookListFilter}
      onBookListFilterChange={setBookListFilter}
      bookListSort={bookListSort}
      onBookListSortChange={setBookListSort}
      selectedBookId={selectedBookId}
      onSelectBook={setSelectedBookId}
      selectedBook={selectedBook}
      selectedBookDraft={selectedBookDraft}
      authors={authors}
      categories={categories}
      savingBookId={savingBookId}
      archivingBookId={archivingBookId}
      onDraftChange={handleBookDraftChange}
      onCategoryChange={handleBookCategoryChange}
      onFileChange={handleBookFileChange}
      onSave={handleSaveBook}
      onArchive={handleArchiveBook}
      onUnarchive={handleUnarchiveBook}
      onOpenAddModal={() => setAddBookModalOpen(true)}
      addBookModalOpen={addBookModalOpen}
      onCloseAddModal={() => {
        setAddBookModalOpen(false)
        setBookForm(emptyBookForm)
      }}
      bookForm={bookForm}
      onBookFormChange={(field, value) => setBookForm((prev) => ({ ...prev, [field]: value }))}
      onCreateBook={handleCreateBook}
      creatingBook={creatingBook}
      referencesLoading={referencesLoading}
      selectedCreateCategory={selectedCreateCategory}
    />
  );

  const renderAuthorsTab = () => (
    <section className="admin-books-panel">
      <header className="admin-books-panel__toolbar">
        <div>
          <h2>Авторы</h2>
          <p className="admin-muted">Список, поиск и редактирование авторов каталога.</p>
        </div>
        <button type="button" className="btn btn--dark" onClick={() => setAddAuthorModalOpen(true)}>
          + Добавить автора
        </button>
      </header>

      <div className="admin-books-layout">
        <aside className="admin-books-list">
          <div className="admin-books-list__controls">
            <input
              className="catalog-field__input"
              type="search"
              placeholder="Поиск по имени, ID..."
              value={authorSearch}
              onChange={(event) => setAuthorSearch(event.target.value)}
            />
          </div>

          <div className="admin-books-list__items" role="listbox" aria-label="Список авторов">
            {!authorSearch.trim() ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--color-secondary)',
                borderRadius: '12px',
                border: '1px dashed var(--color-border)',
                margin: '1rem 0'
              }}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: '0.75rem', display: 'inline-block' }}
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--color-text)' }}>
                  Всего авторов в базе: {authors.length}
                </strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', lineHeight: '1.45' }}>
                  Начните вводить поисковый запрос в поле выше для отображения авторов.
                </p>
              </div>
            ) : (
              <>
                {filteredAdminAuthors.length === 0 ? (
                  <p className="admin-muted">Авторы не найдены.</p>
                ) : null}
                {filteredAdminAuthors.map((author) => (
                  <button
                    key={author.authorId}
                    type="button"
                    role="option"
                    aria-selected={selectedAuthorId === author.authorId}
                    className={`admin-books-list__item ${selectedAuthorId === author.authorId ? 'admin-books-list__item--active' : ''}`}
                    onClick={() => setSelectedAuthorId(author.authorId)}
                  >
                    <strong>#{author.authorId} · {author.fullName}</strong>
                    <span>{formatAuthorLifeDates(author)}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        <div className="admin-books-editor-wrap">
          {selectedAuthor ? (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveAuthor(selectedAuthor.authorId);
              }}
            >
              <header className="admin-books-editor__header" style={{ marginBottom: '1rem' }}>
                <h2>Редактирование автора</h2>
                <p className="admin-muted">ID автора: #{selectedAuthor.authorId}</p>
              </header>
              <label className="admin-field">
                <span className="admin-field__label">Имя автора</span>
                <input
                  className="catalog-field__input"
                  value={authorDrafts[selectedAuthor.authorId]?.fullName ?? ""}
                  onChange={(event) => handleAuthorDraftChange(selectedAuthor.authorId, "fullName", event.target.value)}
                  maxLength={TEXT_LIMITS.title}
                  required
                />
              </label>
              <div className="admin-form__row">
                <label className="admin-field">
                  <span className="admin-field__label">Дата рождения</span>
                  <input
                    className="catalog-field__input"
                    type="date"
                    max={getMaxAuthorBirthDate()}
                    value={authorDrafts[selectedAuthor.authorId]?.birthYear ?? ""}
                    onChange={(event) => handleAuthorDraftChange(selectedAuthor.authorId, "birthYear", event.target.value)}
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">Дата смерти</span>
                  <input
                    className="catalog-field__input"
                    type="date"
                    min={authorDrafts[selectedAuthor.authorId]?.birthYear || undefined}
                    value={authorDrafts[selectedAuthor.authorId]?.deathYear ?? ""}
                    disabled={authorDrafts[selectedAuthor.authorId]?.isAlive ?? !authorDrafts[selectedAuthor.authorId]?.deathYear}
                    onChange={(event) => handleAuthorDraftChange(selectedAuthor.authorId, "deathYear", event.target.value)}
                  />
                </label>
                <label className="admin-checkbox-row admin-checkbox-row--author-life">
                  <input
                    type="checkbox"
                    checked={authorDrafts[selectedAuthor.authorId]?.isAlive ?? !authorDrafts[selectedAuthor.authorId]?.deathYear}
                    onChange={(event) => handleAuthorDraftAliveChange(selectedAuthor.authorId, event.target.checked)}
                  />
                  <span>Автор жив</span>
                </label>
              </div>
              <label className="admin-field">
                <span className="admin-field__label">Биография</span>
                <textarea
                  className="catalog-field__input admin-textarea"
                  value={authorDrafts[selectedAuthor.authorId]?.biography ?? ""}
                  onChange={(event) => handleAuthorDraftChange(selectedAuthor.authorId, "biography", event.target.value)}
                  maxLength={TEXT_LIMITS.synopsis}
                />
              </label>
              <button
                type="submit"
                className="btn btn--dark"
                disabled={savingAuthorId === selectedAuthor.authorId}
              >
                {savingAuthorId === selectedAuthor.authorId ? "Сохраняем..." : "Сохранить автора"}
              </button>
            </form>
          ) : (
            <div className="admin-books-editor--empty">
              <p>Выберите автора из списка слева для просмотра и редактирования.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderCategoriesTab = () => (
    <section className="admin-books-panel">
      <header className="admin-books-panel__toolbar">
        <div>
          <h2>Категории</h2>
          <p className="admin-muted">Список, поиск и редактирование категорий каталога.</p>
        </div>
        <button type="button" className="btn btn--dark" onClick={() => setAddCategoryModalOpen(true)}>
          + Добавить категория
        </button>
      </header>

      <div className="admin-books-layout">
        <aside className="admin-books-list">
          <div className="admin-books-list__controls">
            <input
              className="catalog-field__input"
              type="search"
              placeholder="Поиск по названию, ID..."
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
            />
          </div>

          <div className="admin-books-list__items" role="listbox" aria-label="Список категорий">
            {!categorySearch.trim() ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--color-secondary)',
                borderRadius: '12px',
                border: '1px dashed var(--color-border)',
                margin: '1rem 0'
              }}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: '0.75rem', display: 'inline-block' }}
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--color-text)' }}>
                  Всего категорий в базе: {categories.length}
                </strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', lineHeight: '1.45' }}>
                  Начните вводить поисковый запрос в поле выше для отображения категорий.
                </p>
              </div>
            ) : (
              <>
                {filteredAdminCategories.length === 0 ? (
                  <p className="admin-muted">Категории не найдены.</p>
                ) : null}
                {filteredAdminCategories.map((category) => (
                  <button
                    key={category.categoryId}
                    type="button"
                    role="option"
                    aria-selected={selectedCategoryId === category.categoryId}
                    className={`admin-books-list__item ${selectedCategoryId === category.categoryId ? 'admin-books-list__item--active' : ''}`}
                    onClick={() => setSelectedCategoryId(category.categoryId)}
                  >
                    <strong>#{category.categoryId} · {category.name}</strong>
                    <span>{category.isActive === false ? 'скрыта' : 'активна'} · {category.subcategories?.length || 0} подкат.</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        <div className="admin-books-editor-wrap">
          {selectedCategory ? (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveCategory(selectedCategory.categoryId);
              }}
            >
              <header className="admin-books-editor__header" style={{ marginBottom: '1rem' }}>
                <h2>Редактирование категории</h2>
                <p className="admin-muted">ID категории: #{selectedCategory.categoryId}</p>
              </header>
              <label className="admin-field">
                <span className="admin-field__label">Название категории</span>
                <input
                  className="catalog-field__input"
                  value={categoryDrafts[selectedCategory.categoryId]?.name ?? ""}
                  onChange={(event) => handleCategoryDraftChange(selectedCategory.categoryId, "name", event.target.value)}
                  maxLength={TEXT_LIMITS.categoryName}
                  required
                />
              </label>
              <label className="admin-field">
                <span className="admin-field__label">Описание категории</span>
                <textarea
                  className="catalog-field__input admin-textarea"
                  value={categoryDrafts[selectedCategory.categoryId]?.description ?? ""}
                  onChange={(event) => handleCategoryDraftChange(selectedCategory.categoryId, "description", event.target.value)}
                  maxLength={TEXT_LIMITS.description}
                  required
                />
              </label>
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={categoryDrafts[selectedCategory.categoryId]?.isActive !== false}
                  onChange={(event) => handleCategoryDraftChange(selectedCategory.categoryId, "isActive", event.target.checked)}
                />
                <span>Категория активна</span>
              </label>
              <button
                type="submit"
                className="btn btn--dark"
                disabled={savingCategoryId === selectedCategory.categoryId}
              >
                {savingCategoryId === selectedCategory.categoryId ? "Сохраняем..." : "Сохранить категорию"}
              </button>
            </form>
          ) : (
            <div className="admin-books-editor--empty">
              <p>Выберите категорию из списка слева для просмотра и редактирования.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const renderSubcategoriesTab = () => (
    <section className="admin-books-panel">
      <header className="admin-books-panel__toolbar">
        <div>
          <h2>Подкатегории</h2>
          <p className="admin-muted">Список, поиск и редактирование подкатегорий (жанров) каталога.</p>
        </div>
        <button type="button" className="btn btn--dark" onClick={() => setAddSubcategoryModalOpen(true)}>
          + Добавить подкатегорию
        </button>
      </header>

      <div className="admin-books-layout">
        <aside className="admin-books-list">
          <div className="admin-books-list__controls">
            <input
              className="catalog-field__input"
              type="search"
              placeholder="Поиск по названию, категории, ID..."
              value={subcategorySearch}
              onChange={(event) => setSubcategorySearch(event.target.value)}
            />
          </div>

          <div className="admin-books-list__items" role="listbox" aria-label="Список подкатегорий">
            {!subcategorySearch.trim() ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--color-secondary)',
                borderRadius: '12px',
                border: '1px dashed var(--color-border)',
                margin: '1rem 0'
              }}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: '0.75rem', display: 'inline-block' }}
                >
                  <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M3 15h6" />
                  <path d="M3 19h6" />
                </svg>
                <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--color-text)' }}>
                  Всего подкатегорий в базе: {allSubcategories.length}
                </strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', lineHeight: '1.45' }}>
                  Начните вводить поисковый запрос в поле выше для отображения подкатегорий.
                </p>
              </div>
            ) : (
              <>
                {filteredAdminSubcategories.length === 0 ? (
                  <p className="admin-muted">Подкатегории не найдены.</p>
                ) : null}
                {filteredAdminSubcategories.map((sub) => (
                  <button
                    key={sub.subcategoryId}
                    type="button"
                    role="option"
                    aria-selected={selectedSubcategoryId === sub.subcategoryId}
                    className={`admin-books-list__item ${selectedSubcategoryId === sub.subcategoryId ? 'admin-books-list__item--active' : ''}`}
                    onClick={() => setSelectedSubcategoryId(sub.subcategoryId)}
                  >
                    <strong>#{sub.subcategoryId} · {sub.name}</strong>
                    <span>Категория: {sub.categoryName}</span>
                    <span>{sub.isActive === false ? 'скрыта' : 'активна'}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        <div className="admin-books-editor-wrap">
          {selectedSubcategory ? (
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveSubcategory(selectedSubcategory.subcategoryId);
              }}
            >
              <header className="admin-books-editor__header" style={{ marginBottom: '1rem' }}>
                <h2>Редактирование подкатегории</h2>
                <p className="admin-muted">ID подкатегории: #{selectedSubcategory.subcategoryId} · Категория: {selectedSubcategory.categoryName}</p>
              </header>
              <label className="admin-field">
                <span className="admin-field__label">Название подкатегории</span>
                <input
                  className="catalog-field__input"
                  value={subcategoryDrafts[selectedSubcategory.subcategoryId]?.name ?? ""}
                  onChange={(event) => handleSubcategoryDraftChange(selectedSubcategory.subcategoryId, "name", event.target.value)}
                  maxLength={TEXT_LIMITS.categoryName}
                  required
                />
              </label>
              <label className="admin-field">
                <span className="admin-field__label">Описание подкатегории</span>
                <textarea
                  className="catalog-field__input admin-textarea"
                  value={subcategoryDrafts[selectedSubcategory.subcategoryId]?.description ?? ""}
                  onChange={(event) => handleSubcategoryDraftChange(selectedSubcategory.subcategoryId, "description", event.target.value)}
                  maxLength={TEXT_LIMITS.description}
                  required
                />
              </label>
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={subcategoryDrafts[selectedSubcategory.subcategoryId]?.isActive !== false}
                  onChange={(event) => handleSubcategoryDraftChange(selectedSubcategory.subcategoryId, "isActive", event.target.checked)}
                />
                <span>Подкатегория активна</span>
              </label>
              <button
                type="submit"
                className="btn btn--dark"
                disabled={savingSubcategoryId === selectedSubcategory.subcategoryId}
              >
                {savingSubcategoryId === selectedSubcategory.subcategoryId ? "Сохраняем..." : "Сохранить подкатегорию"}
              </button>
            </form>
          ) : (
            <div className="admin-books-editor--empty">
              <p>Выберите подкатегорию из списка слева для просмотра и редактирования.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  const dailyStats = useMemo(() => {
    const stats = {};
    const getOrCreate = (dateStr) => {
      if (!stats[dateStr]) {
        stats[dateStr] = {
          date: dateStr,
          subCount: 0,
          subAmount: 0,
          electCount: 0,
          electAmount: 0,
          physCount: 0,
          physAmount: 0,
          totalAmount: 0,
        };
      }
      return stats[dateStr];
    };

    (subscriptions || []).forEach((s) => {
      if (s.startDate) {
        const d = s.startDate;
        const entry = getOrCreate(d);
        entry.subCount++;
        entry.subAmount += Number(s.paidAmount) || 0;
      }
    });

    (adminPurchases || []).forEach((p) => {
      if (p.purchaseDate) {
        const d = p.purchaseDate.split("T")[0];
        const entry = getOrCreate(d);
        entry.electCount++;
        entry.electAmount += Number(p.amount) || 0;
      }
    });

    (adminOrders || []).forEach((o) => {
      if (o.orderDate) {
        const d = o.orderDate.split("T")[0];
        const entry = getOrCreate(d);
        entry.physCount++;
        entry.physAmount += Number(o.totalAmount) || 0;
      }
    });

    return Object.values(stats)
      .map((entry) => {
        entry.totalAmount = entry.subAmount + entry.electAmount + entry.physAmount;
        return entry;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [subscriptions, adminPurchases, adminOrders]);

  const filteredDailyStats = useMemo(() => {
    let list = dailyStats;
    if (statStartDate) {
      list = list.filter((s) => s.date >= statStartDate);
    }
    if (statEndDate) {
      list = list.filter((s) => s.date <= statEndDate);
    }
    return list;
  }, [dailyStats, statStartDate, statEndDate]);

  const filteredTotalRevenue = useMemo(() => {
    return filteredDailyStats.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [filteredDailyStats]);

  const renderStatisticsTab = () => {
    const activeBooks = (books || []).filter(b => b.isActive !== false).length;
    const archivedBooks = (books || []).filter(b => b.isActive === false).length;
    const totalStock = (books || []).reduce((acc, b) => acc + (b.stockQuantity || 0), 0);
    const outOfStock = (books || []).filter(b => (b.stockQuantity || 0) === 0).length;
    const avgPrice = (books || []).length ? ((books || []).reduce((acc, b) => acc + (b.price || 0), 0) / (books || []).length) : 0;

    const admins = (users || []).filter(u => u.roleName?.toLowerCase() === 'admin').length;
    const managers = (users || []).filter(u => u.roleName?.toLowerCase() === 'meneger').length;
    const clients = (users || []).filter(u => u.roleName?.toLowerCase() === 'client' || !u.roleName).length;

    const activeSubs = (subscriptions || []).filter(s => ['success', 'active'].includes(s.status?.toLowerCase())).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
        <header className="admin-card__header" style={{ marginBottom: 0 }}>
          <div>
            <h2>Панель статистики</h2>
            <p className="admin-muted">Аналитика каталога, пользователей, подписок и финансовой выручки.</p>
          </div>
        </header>

        {/* Top Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px'
        }}>
          {/* Card 1: Revenue */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
              Общая выручка
            </span>
            <strong style={{ fontSize: '2.2rem', color: 'var(--color-accent)', fontWeight: '800' }}>
              {formatMoney(totalRevenue)}
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Всего платежей по подпискам: {(subscriptions || []).length}
            </span>
          </div>

          {/* Card 2: Users */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
              Пользователи в системе
            </span>
            <strong style={{ fontSize: '2.2rem', color: 'var(--color-accent)', fontWeight: '800' }}>
              {(users || []).length}
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Клиенты: {clients} · Менеджеры: {managers} · Админы: {admins}
            </span>
          </div>

          {/* Card 3: Books */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
              Каталог книг
            </span>
            <strong style={{ fontSize: '2.2rem', color: 'var(--color-accent)', fontWeight: '800' }}>
              {(books || []).length}
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Активные: {activeBooks} · В архиве: {archivedBooks}
            </span>
          </div>

          {/* Card 4: Subscriptions */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
              Активные подписки
            </span>
            <strong style={{ fontSize: '2.2rem', color: 'var(--color-accent)', fontWeight: '800' }}>
              {activeSubs}
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Конверсия пользователей: {(users || []).length ? Math.round((activeSubs / (users || []).length) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Detailed Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {/* Card left: Inventory & Catalog */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Управление складом и ценностью</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Всего книг на складе:</span>
                <strong style={{ color: 'var(--color-text)' }}>{totalStock} шт.</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Нет в наличии:</span>
                <strong style={{ color: outOfStock ? 'var(--md-sys-color-error)' : 'var(--color-text)' }}>
                  {outOfStock} книг
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Стоимость склада:</span>
                <strong style={{ color: 'var(--color-text)' }}>{formatMoney(totalStockValue)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Средняя стоимость книги:</span>
                <strong style={{ color: 'var(--color-text)' }}>{formatMoney(avgPrice)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Всего авторов:</span>
                <strong style={{ color: 'var(--color-text)' }}>{(authors || []).length} чел.</strong>
              </div>
            </div>
          </div>

          {/* Card right: Books by Category */}
          <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Распределение книг по категориям</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {(categoryStats || []).length === 0 ? (
                <p className="admin-muted">Данные по категориям отсутствуют.</p>
              ) : (
                (categoryStats || []).map(stat => (
                  <div key={stat.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: '600' }}>{stat.name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{stat.count} книг ({stat.percentage}%)</span>
                    </div>
                    {/* CSS Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '4px',
                      background: 'var(--color-border)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${stat.percentage}%`,
                        height: '100%',
                        borderRadius: '4px',
                        background: 'var(--color-accent)',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Date Statistics Section */}
        <section className="admin-card" style={{ width: "100%" }}>
          <div className="admin-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Статистика доходов по датам</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.9rem' }}>
                С:
                <input
                  type="date"
                  className="catalog-field__input"
                  value={statStartDate}
                  onChange={(e) => setStatStartDate(e.target.value)}
                  style={{ width: '130px', padding: '4px 8px', height: '32px' }}
                />
              </label>
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.9rem' }}>
                По:
                <input
                  type="date"
                  className="catalog-field__input"
                  value={statEndDate}
                  onChange={(e) => setStatEndDate(e.target.value)}
                  style={{ width: '130px', padding: '4px 8px', height: '32px' }}
                />
              </label>
              {(statStartDate || statEndDate) ? (
                <button
                  type="button"
                  className="btn btn--light"
                  onClick={() => { setStatStartDate(""); setStatEndDate(""); }}
                  style={{ padding: '4px 12px', height: '32px' }}
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--color-bg-light)', padding: '10px 16px', borderRadius: '8px', flex: '1', minWidth: '150px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Выручка за период</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                {formatMoney(filteredTotalRevenue)}
              </div>
            </div>
            <div style={{ background: 'var(--color-bg-light)', padding: '10px 16px', borderRadius: '8px', flex: '1', minWidth: '150px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Подписки</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                {formatMoney(filteredDailyStats.reduce((acc, s) => acc + s.subAmount, 0))}
              </div>
            </div>
            <div style={{ background: 'var(--color-bg-light)', padding: '10px 16px', borderRadius: '8px', flex: '1', minWidth: '150px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Эл. книги</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                {formatMoney(filteredDailyStats.reduce((acc, s) => acc + s.electAmount, 0))}
              </div>
            </div>
            <div style={{ background: 'var(--color-bg-light)', padding: '10px 16px', borderRadius: '8px', flex: '1', minWidth: '150px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Печатные книги</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                {formatMoney(filteredDailyStats.reduce((acc, s) => acc + s.physAmount, 0))}
              </div>
            </div>
          </div>

          {adminPurchasesLoading || adminOrdersLoading || subscriptionsLoading ? (
            <div className="catalog-loading">Загрузка статистики...</div>
          ) : null}

          <div className="admin-table" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '24px' }}>
            <div className="admin-table__row" style={{ fontWeight: 'bold', borderBottom: '2px solid var(--color-border)' }}>
              <div>Дата</div>
              <div>Подписки</div>
              <div>Электронные</div>
              <div>Печатные (доставка)</div>
              <div>Итого</div>
            </div>
            {filteredDailyStats.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Нет транзакций за выбранный период
              </div>
            ) : (
              filteredDailyStats.map((stat) => (
                <div key={stat.date} className="admin-table__row">
                  <div data-label="Дата"><strong>{formatDateOnly(stat.date)}</strong></div>
                  <div data-label="Подписки">
                    {formatMoney(stat.subAmount)}
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>({stat.subCount} шт)</span>
                  </div>
                  <div data-label="Электронные">
                    {formatMoney(stat.electAmount)}
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>({stat.electCount} шт)</span>
                  </div>
                  <div data-label="Печатные">
                    {formatMoney(stat.physAmount)}
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>({stat.physCount} шт)</span>
                  </div>
                  <div data-label="Итого">
                    <strong style={{ color: 'var(--color-accent)' }}>{formatMoney(stat.totalAmount)}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Subscriptions Table inside Statistics tab */}
        <section className="admin-card" style={{ width: "100%" }}>
          <div className="admin-card__header" style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>История платежей подписок</h3>
          </div>
          {subscriptionsLoading ? <div className="catalog-loading">Загрузка подписок...</div> : null}
          <div className="admin-table" style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
            {(subscriptions || []).map((subscription) => (
              <div key={subscription.subscriptionId} className="admin-table__row">
                <div data-label="Тариф">
                  <strong>{subscription.planName}</strong>
                  <p>Подписка #{subscription.subscriptionId} · User #{subscription.userId}</p>
                </div>
                <div data-label="Сумма">{formatMoney(subscription.paidAmount)}</div>
                <div data-label="Статус">{formatAdminStatus(subscription.status)}</div>
                <div data-label="Период">{formatDateOnly(subscription.startDate)} → {formatDateOnly(subscription.endDate)}</div>
                <div data-label="Оплата">{formatPaymentMethod(subscription.paymentMethod)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  const renderAddAuthorModal = () => (
    <div className="admin-modal-overlay" role="presentation" onClick={() => setAddAuthorModalOpen(false)}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal__header">
          <div>
            <h2>Новый автор</h2>
            <p className="admin-muted">Заполните данные для добавления автора в справочник.</p>
          </div>
          <button type="button" className="admin-modal__close" onClick={() => setAddAuthorModalOpen(false)} aria-label="Закрыть">
            ×
          </button>
        </header>

        <form className="admin-form admin-modal__body" onSubmit={handleCreateAuthor}>
          <label className="admin-field">
            <span className="admin-field__label">Имя автора</span>
            <input
              className="catalog-field__input"
              value={authorForm.fullName}
              onChange={(event) => setAuthorForm((prev) => ({ ...prev, fullName: event.target.value }))}
              maxLength={TEXT_LIMITS.title}
              required
            />
          </label>

          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Дата рождения</span>
              <input
                className="catalog-field__input"
                type="date"
                max={getMaxAuthorBirthDate()}
                value={authorForm.birthYear}
                onChange={(event) => setAuthorForm((prev) => ({ ...prev, birthYear: event.target.value }))}
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Дата смерти</span>
              <input
                className="catalog-field__input"
                type="date"
                min={authorForm.birthYear || undefined}
                value={authorForm.deathYear}
                disabled={authorForm.isAlive}
                onChange={(event) => setAuthorForm((prev) => ({ ...prev, deathYear: event.target.value }))}
              />
            </label>
            <label className="admin-checkbox-row admin-checkbox-row--author-life">
              <input
                type="checkbox"
                checked={authorForm.isAlive}
                onChange={(event) =>
                  setAuthorForm((prev) => ({
                    ...prev,
                    isAlive: event.target.checked,
                    deathYear: event.target.checked ? "" : prev.deathYear,
                  }))
                }
              />
              <span>Автор жив</span>
            </label>
          </div>

          <label className="admin-field">
            <span className="admin-field__label">Биография</span>
            <textarea
              className="catalog-field__input admin-textarea"
              value={authorForm.biography}
              onChange={(event) => setAuthorForm((prev) => ({ ...prev, biography: event.target.value }))}
              maxLength={TEXT_LIMITS.synopsis}
            />
          </label>

          <div className="admin-modal__actions">
            <button type="button" className="btn btn--light" onClick={() => setAddAuthorModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn--dark" disabled={creatingAuthor}>
              {creatingAuthor ? "Добавляем..." : "Добавить автора"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderAddCategoryModal = () => (
    <div className="admin-modal-overlay" role="presentation" onClick={() => setAddCategoryModalOpen(false)}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal__header">
          <div>
            <h2>Новая категория</h2>
            <p className="admin-muted">Заполните данные для добавления новой категории.</p>
          </div>
          <button type="button" className="admin-modal__close" onClick={() => setAddCategoryModalOpen(false)} aria-label="Закрыть">
            ×
          </button>
        </header>

        <form className="admin-form admin-modal__body" onSubmit={handleCreateCategory}>
          <label className="admin-field">
            <span className="admin-field__label">Название категории</span>
            <input
              className="catalog-field__input"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              maxLength={TEXT_LIMITS.categoryName}
              required
            />
          </label>
          <label className="admin-field">
            <span className="admin-field__label">Описание категории</span>
            <textarea
              className="catalog-field__input admin-textarea"
              value={categoryForm.description}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
              maxLength={TEXT_LIMITS.description}
              required
            />
          </label>
          <div className="admin-modal__actions">
            <button type="button" className="btn btn--light" onClick={() => setAddCategoryModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn--dark" disabled={creatingCategory}>
              {creatingCategory ? "Добавляем..." : "Добавить категорию"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderAddSubcategoryModal = () => (
    <div className="admin-modal-overlay" role="presentation" onClick={() => setAddSubcategoryModalOpen(false)}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal__header">
          <div>
            <h2>Новая подкатегория</h2>
            <p className="admin-muted">Заполните данные для добавления новой подкатегории.</p>
          </div>
          <button type="button" className="admin-modal__close" onClick={() => setAddSubcategoryModalOpen(false)} aria-label="Закрыть">
            ×
          </button>
        </header>

        <form className="admin-form admin-modal__body" onSubmit={handleCreateSubcategory}>
          <label className="admin-field">
            <span className="admin-field__label">Родительская категория</span>
            <select
              className="catalog-field__input"
              value={subcategoryForm.categoryId}
              onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              required
            >
              <option value="">Выберите категорию</option>
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-field__label">Название подкатегории</span>
            <input
              className="catalog-field__input"
              value={subcategoryForm.name}
              onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              maxLength={TEXT_LIMITS.categoryName}
              required
            />
          </label>
          <label className="admin-field">
            <span className="admin-field__label">Описание подкатегории</span>
            <textarea
              className="catalog-field__input admin-textarea"
              value={subcategoryForm.description}
              onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, description: event.target.value }))}
              maxLength={TEXT_LIMITS.description}
              required
            />
          </label>
          <div className="admin-modal__actions">
            <button type="button" className="btn btn--light" onClick={() => setAddSubcategoryModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn--dark" disabled={creatingSubcategory}>
              {creatingSubcategory ? "Добавляем..." : "Добавить подкатегорию"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderUsersTab = () => (
    <section className="admin-card" style={{ width: "100%" }}>
      <div className="admin-card__header">
        <div>
          <h2>Пользователи</h2>
          <p>Просмотр зарегистрированных пользователей и назначение системных ролей.</p>
        </div>
      </div>
      {usersLoading ? <div className="catalog-loading">Загрузка пользователей...</div> : null}
      <div className="admin-table">
        {users.map((user) => (
          <div key={user.userId} className="admin-table__row admin-table__row--users">
            <div data-label="Пользователь">
              <strong>{user.firstName} {user.lastName}</strong>
              <p>{user.email}</p>
            </div>
            <div data-label="Телефон">{user.phone || "—"}</div>
            <div data-label="Подписка">{formatAdminStatus(user.subscriptionStatus)}</div>
            <div className="admin-user-role" data-label="Роль">
              <select
                className="catalog-field__input"
                value={userRoleDrafts[user.userId] || user.roleName?.toLowerCase?.() || ""}
                onChange={(event) =>
                  setUserRoleDrafts((prev) => ({ ...prev, [user.userId]: event.target.value }))
                }
              >
                {roles.map((role) => (
                  <option key={role.roleId} value={role.name?.toLowerCase?.() || ""}>
                    {formatRoleName(role.name)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--dark"
                disabled={updatingUserId === user.userId}
                onClick={() => handleUserRoleSave(user.userId)}
              >
                {updatingUserId === user.userId ? "Сохраняем..." : "Назначить"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case "authors":
        return renderAuthorsTab();
      case "categories":
        return renderCategoriesTab();
      case "subcategories":
        return renderSubcategoriesTab();
      case "statistics":
        return renderStatisticsTab();
      case "users":
        return renderUsersTab();
      default:
        return renderBooksTab();
    }
  };

  const navbar = (
    <Navbar
      isAuthorized={Boolean(authToken)}
      isAdmin={isAdmin}
      onHomeClick={() => {
        window.location.href = "/";
      }}
      onAuthClick={() => setAuthOpen(true)}
      onLogout={() => {
        clearAuthToken();
        setAuthToken("");
        window.location.href = "/";
      }}
    />
  );

  if (!authToken) {
    return (
      <>
        {navbar}
        <main className="main">
          <section className="admin-guard">
            <h1>Вход для администратора</h1>
            <p>Чтобы открыть админ-панель, войдите в аккаунт с ролью `admin`.</p>
            <button type="button" className="btn btn--dark" onClick={() => setAuthOpen(true)}>
              Войти
            </button>
          </section>
        </main>
        <Footer />
        {authOpen ? (
          <AuthModal
            onClose={() => setAuthOpen(false)}
            onAuthSuccess={(token) => setAuthToken(token)}
            promptText="Войдите под учетной записью администратора."
          />
        ) : null}
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        {navbar}
        <main className="main">
          <section className="admin-guard">
            <h1>Доступ запрещен</h1>
            <p>Текущая роль: {authRole ? formatRoleName(authRole) : "не определена"}. Для входа нужен администратор.</p>
            <a className="btn btn--dark" href="/">Вернуться на главную</a>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar
        isAuthorized
        isAdmin
        onHomeClick={() => { window.location.href = "/"; }}
        onAuthClick={() => setAuthOpen(true)}
        onLogout={() => {
          clearAuthToken();
          setAuthToken("");
          window.location.href = "/";
        }}
      />

      <main className="main">
        <section className="admin-shell">
          <header className="admin-shell__header" style={{ marginBottom: "2rem" }}>
            <div>
              <div className="section-header__title">Админ-панель</div>
              <div className="section-header__sub">
                Управление каталогом книг, авторов, категорий, подкатегорий, просмотр статистики и пользователей.
              </div>
            </div>
            <a className="btn btn--light" href="/">Назад в магазин</a>
          </header>

          <div className="admin-layout">
            <nav className="admin-sidebar" role="tablist" aria-label="Разделы админ-панели">
              {ADMIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`admin-sidebar__tab ${activeTab === tab.id ? "admin-sidebar__tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="admin-content">
              {pageError ? <div className="catalog-error">{pageError}</div> : null}
              {renderActiveTab()}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      {addAuthorModalOpen ? renderAddAuthorModal() : null}
      {addCategoryModalOpen ? renderAddCategoryModal() : null}
      {addSubcategoryModalOpen ? renderAddSubcategoryModal() : null}
      {toastMessage ? <div className="app-toast">{toastMessage}</div> : null}
    </>
  );
}
