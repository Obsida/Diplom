/**
 * Делит текст на главы по строкам-заголовкам глав.
 * Примеры: «Глава I. МИСТЕР ШЕРЛОК ХОЛМС», «Глава 3. Ночь», «Глава XII В дороге».
 * Римские и арабские номера; точка после номера необязательна.
 * Текст до первой такой строки попадает во «Вступление», если он не пустой.
 * @returns {{ id: number, title: string, body: string }[]}
 */
function isChapterHeadingLine(line) {
  const t = String(line || '')
  // «Глава» + пробел + (римские IVXLCDM или 1–4 цифры) + опц. точка + дальше хотя бы один не-пробельный символ (заголовок)
  if (/^\s*Глава\s+(?:[IVXLCDMivxlcdm]+|\d{1,4})\.?\s*\S/i.test(t)) return true
  // Запасной вариант: «Глава» и дальше не пробел (на случай нестандартной нумерации)
  if (/^\s*Глава\s+\S/i.test(t)) return true
  return false
}

export function splitReaderChapters(rawText) {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n')
  const trimmedEnd = normalized.replace(/\n+$/g, '')
  if (!trimmedEnd.trim()) return []

  const lines = trimmedEnd.split('\n')
  const startLineIndices = []
  lines.forEach((line, i) => {
    if (isChapterHeadingLine(line)) startLineIndices.push(i)
  })

  if (startLineIndices.length === 0) {
    return [{ id: 0, title: 'Текст', body: trimmedEnd.trim() }]
  }

  const chapters = []
  let id = 0

  if (startLineIndices[0] > 0) {
    const body = lines.slice(0, startLineIndices[0]).join('\n').trim()
    if (body) {
      chapters.push({ id: id++, title: 'Вступление', body })
    }
  }

  for (let s = 0; s < startLineIndices.length; s += 1) {
    const from = startLineIndices[s]
    const to = s + 1 < startLineIndices.length ? startLineIndices[s + 1] : lines.length
    const title = lines[from].trim()
    const body = lines.slice(from + 1, to).join('\n').trim()
    chapters.push({ id: id++, title, body })
  }

  return chapters
}
