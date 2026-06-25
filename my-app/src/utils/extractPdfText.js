import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function median(values) {
  const arr = values.filter((n) => Number.isFinite(n) && n > 0)
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Собирает строки страницы: группировка по Y, порядок по X, табы по ширине промежутков.
 */
function layoutPageText(content) {
  const raw = content.items.filter(
    (item) => item && typeof item === 'object' && 'str' in item && typeof item.str === 'string',
  )
  if (!raw.length) return ''

  const placed = raw.map((item) => {
    const t = item.transform
    const x = t[4]
    const y = t[5]
    const str = item.str.replace(/\r/g, '')
    const w =
      item.width > 0
        ? item.width
        : Math.max(Math.abs(t[0]) * str.length * 0.45, Math.abs(t[0]) * 0.5)
    const h = item.height > 0 ? item.height : Math.abs(t[3]) || 10
    return { str, x, y, w, h }
  })

  const heights = placed.map((p) => p.h)
  const yTol = Math.max(2, median(heights) * 0.55)

  /** Кластеры «одна визуальная строка» по близости Y */
  const clusters = []
  for (const it of placed) {
    let hit = null
    for (const cl of clusters) {
      if (Math.abs(it.y - cl.yRef) <= yTol) {
        hit = cl
        break
      }
    }
    if (hit) {
      hit.items.push(it)
      const n = hit.items.length
      hit.yRef = (hit.yRef * (n - 1) + it.y) / n
    } else {
      clusters.push({ yRef: it.y, items: [it] })
    }
  }

  clusters.sort((a, b) => b.yRef - a.yRef)

  const charW = median(placed.map((p) => p.w / Math.max(1, p.str.replace(/\s/g, '').length || 1)))
  const unit = Math.max(charW * 0.35, 0.5)
  const tabWidth = Math.max(unit * 4, charW * 3.5)

  const pageMinX = Math.min(...placed.map((p) => p.x))

  const linesOut = []
  for (const cl of clusters) {
    const row = [...cl.items].sort((a, b) => a.x - b.x)
    let line = ''
    let prevRight = null

    for (let i = 0; i < row.length; i += 1) {
      const cur = row[i]
      const piece = cur.str.replace(/\u00a0/g, ' ')

      if (i === 0) {
        if (cur.str === '') {
          line += '\t'
        }
        const leadGap = cur.x - pageMinX
        if (leadGap > tabWidth * 0.75) {
          const tabs = Math.min(16, Math.max(1, Math.round(leadGap / tabWidth)))
          line += '\t'.repeat(tabs)
        } else if (leadGap > unit * 1.25) {
          line += ' '
        }
        line += piece
        prevRight = cur.x + cur.w
        continue
      }

      const gap = cur.x - prevRight
      if (gap < -unit * 0.3) {
        line += piece
      } else if (gap < unit * 0.35) {
        line += piece
      } else if (gap < tabWidth * 0.65) {
        line += ` ${piece}`
      } else {
        const nTab = Math.min(14, Math.max(1, Math.round(gap / tabWidth)))
        line += `${'\t'.repeat(nTab)}${piece}`
      }
      prevRight = Math.max(prevRight, cur.x + cur.w)
    }

    const trimmed = line.replace(/[ \t]+$/g, '')
    if (trimmed) linesOut.push(trimmed)
  }

  return linesOut.join('\n')
}

/**
 * Извлекает текст из PDF (pdf.js) с переносами строк и табуляцией по геометрии вёрстки.
 */
export async function extractPdfText(arrayBuffer) {
  const loadingTask = getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  try {
    const rawLines = []
    for (let p = 1; p <= pdf.numPages; p += 1) {
      // eslint-disable-next-line no-await-in-loop
      const page = await pdf.getPage(p)
      // eslint-disable-next-line no-await-in-loop
      const content = await page.getTextContent()
      const block = layoutPageText(content)
      if (block) {
        rawLines.push(...block.split('\n'))
      }
    }

    const cleanedLines = []
    for (const line of rawLines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // 1. Remove 100bestbooks
      if (/100bestbooks/i.test(trimmed) || /100 лучших книг/i.test(trimmed)) {
        continue
      }
      // 2. Remove page headers/footers
      if (/Артур Конан Дойл\s+«Собака Баскервилей»/i.test(trimmed)) {
        continue
      }
      if (/Артур Конан Дойл/i.test(trimmed) && trimmed.length < 30) {
        continue
      }
      if (/Собака Баскервилей/i.test(trimmed) && trimmed.length < 30) {
        continue
      }
      if (/^\d+$/.test(trimmed)) {
        continue // page number
      }

      cleanedLines.push(line)
    }

    const paragraphs = []
    let currentPara = []

    for (const line of cleanedLines) {
      const isNewPara = 
        line.startsWith('\t') || 
        line.startsWith(' ') ||
        /^\s*[-–—]/.test(line) || 
        /^\s*Глава\s+(?:[IVXLCDMivxlcdm]+|\d{1,4})/i.test(line) ||
        (currentPara.length > 0 && /^\s*Глава\s+/i.test(line))

      if (isNewPara) {
        if (currentPara.length > 0) {
          paragraphs.push(currentPara.join(' ').replace(/\s+/g, ' ').trim())
        }
        currentPara = [line.replace(/^\t+/, '')]
      } else {
        if (currentPara.length > 0) {
          currentPara.push(line)
        } else {
          currentPara = [line]
        }
      }
    }

    if (currentPara.length > 0) {
      paragraphs.push(currentPara.join(' ').replace(/\s+/g, ' ').trim())
    }

    return paragraphs.join('\n')
  } finally {
    try {
      await pdf.destroy()
    } catch {
      /* ignore */
    }
  }
}
