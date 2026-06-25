import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconBookmark,
  IconCart,
  IconLibrary,
  IconLogout,
  IconMenu,
  IconOrders,
  IconSettings,
  IconShield,
  IconUser,
} from './icons/MenuIcons'

const Navbar = ({
  isAuthorized,
  isAdmin = false,
  isManager = false,
  onAuthClick,
  onSubscriptionClick,
  onLogout,
  onCartClick,
  onLibraryClick,
  onPurchasedBooksClick,
  onPurchasesClick,
  onBookmarksClick,
  onProfileClick,
  onManagerPanelClick,
  onHomeClick,
  onAdminPanelClick,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const menuItems = useMemo(
    () =>
      [
        onProfileClick ? { key: 'profile', label: 'Профиль', Icon: IconUser, onClick: onProfileClick } : null,
        onLibraryClick ? { key: 'library', label: 'Личная библиотека', Icon: IconLibrary, onClick: onLibraryClick } : null,
        onPurchasedBooksClick ? { key: 'purchased_books', label: 'Купленные книги', Icon: IconLibrary, onClick: onPurchasedBooksClick } : null,
        onCartClick ? { key: 'cart', label: 'Корзина', Icon: IconCart, onClick: onCartClick } : null,
        onPurchasesClick ? { key: 'purchases', label: 'Мои заказы', Icon: IconOrders, onClick: onPurchasesClick } : null,
        onBookmarksClick ? { key: 'bookmarks', label: 'Закладки', Icon: IconBookmark, onClick: onBookmarksClick } : null,
        isManager && onManagerPanelClick ? { key: 'manager', label: 'Панель менеджера', Icon: IconSettings, onClick: onManagerPanelClick } : null,
        isAdmin && onAdminPanelClick
          ? { key: 'admin', label: 'Админ-панель', Icon: IconSettings, onClick: onAdminPanelClick }
          : null,
      ].filter(Boolean),
    [isAdmin, isManager, onAdminPanelClick, onManagerPanelClick, onBookmarksClick, onCartClick, onLibraryClick, onPurchasedBooksClick, onProfileClick, onPurchasesClick],
  )

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <nav className="navbar">
      <button type="button" className="navbar__logo" onClick={onHomeClick} aria-label="На главную">
        <span className="navbar__logo-text">Букс<span>бери</span></span>
      </button>

      <div className="navbar__actions">
        {onSubscriptionClick ? (
          <button type="button" className="btn btn--light" onClick={onSubscriptionClick}>
            Подписка
          </button>
        ) : null}

        <div className="account-menu" ref={menuRef}>
          <button
            type="button"
            className="btn btn--light account-menu__trigger"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <span className="account-menu__trigger-icon" aria-hidden="true">
              {isAuthorized ? <IconUser /> : <IconMenu />}
            </span>
            {isAuthorized ? 'Аккаунт' : 'Меню'}
          </button>
          {menuOpen ? (
            <div className="account-menu__panel" role="menu">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="account-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    item.onClick?.()
                  }}
                >
                  <span className="account-menu__item-icon" aria-hidden="true">
                    <item.Icon />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}

              {isAuthorized ? (
                <>
                  {menuItems.length ? <div className="account-menu__divider" role="separator" /> : null}
                  <button
                    type="button"
                    className="account-menu__item account-menu__item--danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout()
                    }}
                  >
                    <span className="account-menu__item-icon" aria-hidden="true">
                      <IconLogout />
                    </span>
                    <span>Выйти</span>
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {!isAuthorized ? (
          <button type="button" className="btn btn--dark" onClick={onAuthClick}>
            Войти
          </button>
        ) : null}
      </div>
    </nav>
  )
}


export default Navbar
