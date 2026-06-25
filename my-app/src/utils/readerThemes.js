export const DEFAULT_READER_THEME_ID = 'light'

export const READER_THEMES = [
  {
    id: 'light',
    name: 'Белая',
    background: '#ffffff',
    text: '#111111',
  },
  {
    id: 'dark',
    name: 'Черная',
    background: '#111111',
    text: '#f7f7f7',
  },
  {
    id: 'paper',
    name: 'Бумага',
    background: '#f7f4ee',
    text: '#1a1a1a',
  },
  {
    id: 'contrast',
    name: 'Контрастная',
    background: '#000000',
    text: '#ffffff',
  },
  {
    id: 'soft-dark',
    name: 'Мягкая темная',
    background: '#1f2328',
    text: '#edf1f5',
  },
]

export function findReaderTheme(themeId) {
  return READER_THEMES.find((theme) => theme.id === themeId) || READER_THEMES[0]
}
