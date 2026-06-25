import { useEffect, useMemo, useState } from "react";
import "../App.css";
import "./AdminPage.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AuthModal from "../components/AuthModal";
import { formatDeliveryStatus } from "../utils/deliveryStatus";
import {
  clearAuthToken,
  getAuthRole,
  getAuthToken,
  isManagerToken,
} from "../api";
import {
  fetchAdminDeliveryOrders,
  updateAdminDeliveryOrder,
} from "../adminApi";

const ORDER_STATUSES = ["created", "shipped", "delivered", "cancelled"];

const ROLE_LABELS = {
  admin: "Администратор",
  client: "Клиент",
  meneger: "Менеджер",
};

const STATUS_STYLES = {
  created: { background: "#fff8e1", color: "#b78103", border: "1px solid #ffe082" }, // Warm Amber
  shipped: { background: "#e0f7fa", color: "#006064", border: "1px solid #b2ebf2" }, // Light Blue
  delivered: { background: "#e8f5e9", color: "#1b5e20", border: "1px solid #c8e6c9" }, // Emerald Green
  cancelled: { background: "#ffebee", color: "#b71c1c", border: "1px solid #ffcdd2" }, // Soft Red
};

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

function formatRoleName(roleName) {
  const key = String(roleName || "").trim().toLowerCase();
  if (!key) return "—";
  return ROLE_LABELS[key] || roleName;
}

export default function ManagerPage() {
  const [authToken, setAuthToken] = useState(() => getAuthToken());
  const [authOpen, setAuthOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [sortByDate, setSortByDate] = useState("desc"); // 'desc' = сначала новые, 'asc' = сначала старые
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [pageError, setPageError] = useState("");

  const authRole = getAuthRole(authToken);
  const isManager = isManagerToken(authToken);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setToastMessage(String(message ?? ""));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  async function loadOrders(status = orderStatusFilter, showLoading = true) {
    if (showLoading) setOrdersLoading(true);
    try {
      const data = await fetchAdminDeliveryOrders(status || undefined);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      setPageError(error?.message || "Не удалось загрузить заказы.");
    } finally {
      if (showLoading) setOrdersLoading(false);
    }
  }

  useEffect(() => {
    if (!authToken || !isManager) return;
    loadOrders(orderStatusFilter, true);
  }, [authToken, isManager]);

  useEffect(() => {
    if (!authToken || !isManager) return;

    const interval = setInterval(() => {
      loadOrders(orderStatusFilter, false);
    }, 5000);

    return () => clearInterval(interval);
  }, [authToken, isManager, orderStatusFilter]);

  useEffect(() => {
    const handleCatalogUpdated = () => {
      loadOrders(orderStatusFilter, false);
    };
    window.addEventListener("catalog-updated", handleCatalogUpdated);
    return () => window.removeEventListener("catalog-updated", handleCatalogUpdated);
  }, [orderStatusFilter]);

  const handleOrderUpdate = async (orderId, draft) => {
    setUpdatingOrderId(orderId);
    try {
      await updateAdminDeliveryOrder(orderId, {
        status: draft.status,
      });
      await loadOrders(orderStatusFilter, false);
      setToastMessage("Статус заказа обновлен.");
    } catch (error) {
      setToastMessage(error?.message || "Не удалось обновить заказ.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const STATUS_PRIORITY = {
    created: 1,
    shipped: 2,
    delivered: 3,
    cancelled: 4,
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [orderStatusFilter, sortByDate]);

  const sortedOrders = useMemo(() => {
    const list = [...orders];
    list.sort((a, b) => {
      const priorityA = STATUS_PRIORITY[a.status] || 99;
      const priorityB = STATUS_PRIORITY[b.status] || 99;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      const dateA = new Date(a.orderDate || 0).getTime();
      const dateB = new Date(b.orderDate || 0).getTime();
      return sortByDate === "asc" ? dateA - dateB : dateB - dateA;
    });
    return list;
  }, [orders, sortByDate]);

  const totalPages = Math.ceil(sortedOrders.length / pageSize);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  const renderOrdersTab = () => (
    <section className="admin-card" style={{ width: "100%", padding: "1.5rem" }}>
      <style>{`
        .premium-order-card {
          background: var(--color-white);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.25rem;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          position: relative;
        }
        .premium-order-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(35, 78, 112, 0.08);
          border-color: var(--color-accent);
        }
        .order-meta-info {
          flex: 1;
        }
        .order-meta-info p {
          margin: 0.35rem 0 0;
          font-size: 0.9rem;
          color: var(--color-text-muted);
        }
        .order-meta-info strong {
          font-size: 1.15rem;
          color: var(--color-text);
        }
        .order-address-box {
          flex: 1.2;
          font-size: 0.95rem;
          color: var(--color-text);
          padding-left: 1rem;
          border-left: 2px solid var(--color-border);
        }
        .order-address-box span {
          display: block;
          font-size: 0.8rem;
          color: var(--color-text-muted);
          margin-bottom: 0.2rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .order-actions-area {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .order-price {
          font-weight: 700;
          font-size: 1.2rem;
          color: var(--color-accent);
          text-align: right;
          min-width: 100px;
        }
        .status-pill {
          display: inline-block;
          padding: 0.3rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-align: center;
          margin-top: 0.4rem;
        }
        .order-row-updating {
          opacity: 0.6;
          pointer-events: none;
        }
        @media (max-width: 900px) {
          .premium-order-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 1.25rem;
          }
          .order-address-box {
            padding-left: 0;
            border-left: none;
            border-top: 1px solid var(--color-border);
            padding-top: 0.75rem;
            width: 100%;
          }
          .order-actions-area {
            width: 100%;
            justify-content: space-between;
            border-top: 1px solid var(--color-border);
            padding-top: 0.75rem;
          }
          .order-price {
            text-align: left;
          }
        }
      `}</style>

      <div className="admin-card__header" style={{ marginBottom: "2rem" }}>
        <div>
          <h2>Заказы доставки</h2>
          <p>Просмотр и изменение статусов доставки заказов.</p>
        </div>
        <div className="admin-toolbar" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <select
            className="catalog-field__input"
            value={orderStatusFilter}
            onChange={(event) => {
              setOrderStatusFilter(event.target.value);
              loadOrders(event.target.value, true);
            }}
          >
            <option value="">Все статусы</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatDeliveryStatus(status)}
              </option>
            ))}
          </select>

          <select
            className="catalog-field__input"
            value={sortByDate}
            onChange={(event) => setSortByDate(event.target.value)}
          >
            <option value="desc">Сначала новые</option>
            <option value="asc">Сначала старые</option>
          </select>

          <button type="button" className="btn btn--light" onClick={() => loadOrders(orderStatusFilter, true)}>
            Обновить
          </button>
        </div>
      </div>

      {ordersLoading ? <div className="catalog-loading">Загрузка заказов...</div> : null}
      
      {!ordersLoading && sortedOrders.length === 0 ? (
        <div className="books-empty" style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-muted)" }}>
          Заказов с выбранными параметрами не найдено.
        </div>
      ) : null}

      <div className="orders-list-wrapper">
        {paginatedOrders.map((order) => (
          <OrderRow
            key={`${order.orderId}-${order.status || ""}`}
            order={order}
            busy={updatingOrderId === order.orderId}
            onSave={handleOrderUpdate}
          />
        ))}
      </div>

      {totalPages > 1 ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="btn btn--light"
            style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", height: "42px" }}
          >
            Назад
          </button>
          <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--color-text)" }}>
            Страница {currentPage} из {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="btn btn--light"
            style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", height: "42px" }}
          >
            Вперед
          </button>
        </div>
      ) : null}
    </section>
  );

  const navbar = (
    <Navbar
      isAuthorized={Boolean(authToken)}
      isAdmin={false}
      isManager={isManager}
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
            <h1>Вход для менеджера</h1>
            <p>Чтобы открыть панель менеджера, войдите в аккаунт с ролью `meneger`.</p>
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
            promptText="Войдите под учетной записью менеджера."
          />
        ) : null}
      </>
    );
  }

  if (!isManager) {
    return (
      <>
        {navbar}
        <main className="main">
          <section className="admin-guard">
            <h1>Доступ запрещен</h1>
            <p>Текущая роль: {authRole ? formatRoleName(authRole) : "не определена"}. Для входа нужен менеджер.</p>
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
        isAdmin={false}
        isManager
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
              <div className="section-header__title">Панель менеджера</div>
              <div className="section-header__sub">
                Просмотр и редактирование статусов доставки заказов пользователей.
              </div>
            </div>
            <a className="btn btn--light" href="/">Назад в магазин</a>
          </header>

          <div className="admin-content">
            {pageError ? <div className="catalog-error">{pageError}</div> : null}
            {renderOrdersTab()}
          </div>
        </section>
      </main>

      <Footer />
      {toastMessage ? <div className="app-toast">{toastMessage}</div> : null}
    </>
  );
}

function OrderRow({ order, busy, onSave }) {
  const [status, setStatus] = useState(order.status || "created");

  const styleBadge = STATUS_STYLES[order.status] || { background: "#f5f5f5", color: "#616161", border: "1px solid #e0e0e0" };

  return (
    <div className={`premium-order-card ${busy ? "order-row-updating" : ""}`}>
      <div className="order-meta-info">
        <strong>{order.bookTitle}</strong>
        <p>Заказ #{order.orderId} · {formatDate(order.orderDate)}</p>
        <div className="status-pill" style={styleBadge}>
          {formatDeliveryStatus(order.status)}
        </div>
      </div>
      
      <div className="order-address-box">
        <span>Адрес доставки</span>
        {order.deliveryAddress}
      </div>

      <div className="order-actions-area">
        <div className="order-price">
          {formatMoney(order.totalAmount)}
        </div>
        <div className="admin-order-controls" style={{ display: "flex", gap: "0.5rem" }}>
          <select 
            className="catalog-field__input" 
            value={status} 
            onChange={(event) => setStatus(event.target.value)}
            style={{ width: "140px" }}
          >
            {ORDER_STATUSES.map((item) => (
              <option key={item} value={item}>
                {formatDeliveryStatus(item)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--dark"
            disabled={busy || status === order.status}
            onClick={() => onSave(order.orderId, { status })}
            style={{ padding: "0 1rem", height: "42px" }}
          >
            {busy ? "..." : "Ок"}
          </button>
        </div>
      </div>
    </div>
  );
}
