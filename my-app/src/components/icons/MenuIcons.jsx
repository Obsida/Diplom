const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function IconUser(props) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-3.5 4.5-5 7-5s5.5 1.5 7 5" />
    </svg>
  )
}

export function IconCart(props) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 5h2l1.5 11h11L19 8H7" />
    </svg>
  )
}

export function IconOrders(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M7 4h10l1 3H6l1-3z" />
      <path d="M6 9h12v10H6V9z" />
      <path d="M10 13h4" />
    </svg>
  )
}

export function IconBookmark(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M7 4h10v14l-5-3-5 3V4z" />
    </svg>
  )
}

export function IconLibrary(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21V5.5z" />
      <path d="M5 5.5A2.5 2.5 0 0 0 2.5 3H2v16h.5A2.5 2.5 0 0 1 5 21" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  )
}

export function IconShield(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  )
}

export function IconSettings(props) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </svg>
  )
}

export function IconLogout(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M10 7V5a2 2 0 0 1 2-2h5v16h-5a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h10" />
      <path d="M7 9l-3 3 3 3" />
    </svg>
  )
}

export function IconMenu(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
    </svg>
  )
}
