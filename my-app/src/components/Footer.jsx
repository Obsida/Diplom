const FOOTER_COLS = [
  ['Разделы', ['Главная', 'Каталог', 'Аудиокниги', 'Популярное']],
  ['Аккаунт', ['Вход', 'Регистрация', 'Мои книги', 'Избранное']],
  ['Поддержка', ['Центр помощи', 'Связаться с нами', 'Политика конфиденциальности', 'Условия']],
]

const Footer = () => (
  <footer className="footer">
    <div className="footer__inner">
      <div className="footer__brand">
        <div className="footer__logo">Букс<span>бери</span></div>
        <p className="footer__tagline">
          Ваш доступ к лучшим книгам и аудиокнигам.
          Открывайте, читайте и слушайте.
        </p>
      </div>
      {FOOTER_COLS.map(([title, links]) => (
        <div key={title}>
          <div className="footer__col-title">{title}</div>
          <ul className="footer__links">
            {links.map(link => (
              <li key={link}><a href="#" className="footer__link">{link}</a></li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="footer__bottom">
      <span className="footer__copy">© 2026 Буксбери. Все права защищены.</span>
      <span className="footer__site">www.booksbury.ru</span>
    </div>
  </footer>
)

export default Footer
