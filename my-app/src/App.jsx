import { useState, useEffect, useCallback } from 'react'
import './App.css'
import {
  fetchBooksCatalog,
  fetchAuthors,
  fetchCategories,
  fetchMyBookmarks,
  fetchMyLibrary,
  fetchMyReadingProgress,
  fetchMySubscriptions,
  fetchBookDetail,
  coverUrl,
  createPhysicalOrder,
  fetchMyDeliveryOrders,
  consumeOAuthResultFromUrl,
  getAuthToken,
  isAdminToken,
  isManagerToken,
  clearAuthToken,
  saveAuthToken,
  fetchBookRecommendations,
} from './api'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import ExploreHeader from './components/ExploreHeader'
import CatalogToolbar from './components/CatalogToolbar'
import CatalogContent from './components/CatalogContent'
import PopularSection from './components/PopularSection'
import RecommendationsSection from './components/RecommendationsSection'
import Footer from './components/Footer'
import AuthModal from './components/AuthModal'
import BookmarksContent from './components/BookmarksContent'
import LibraryContent from './components/LibraryContent'
import PurchasesContent from './components/PurchasesContent'
import CartContent from './components/CartContent'
import ProfileContent from './components/ProfileContent'
import SubscriptionModal from './components/SubscriptionModal'
import CheckoutModal from './components/CheckoutModal'
import { requestOpenGlobalAudioPlayer } from './utils/globalAudioPlayer'
import { loadReaderChapterProgress } from './utils/readerChapterProgress'

const BOOKS_PER_PAGE = 18


function useDebounced(value, delay) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function formatPrice(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return '—'
  return `${x.toLocaleString('ru-RU')} ₽`
}

function mapListBook(b) {
  return {
    id: b.bookId,
    bookId: b.bookId,
    title: b.title ?? '',
    author: b.authorName ?? '',
    category: b.categoryName ?? '',
    subcategory: b.subcategoryName ?? '',
    price: formatPrice(b.price),
    priceValue: Number(b.price),
    rating: Number(b.rating) || 0,
    reviews: null,
    year: b.publicationYear,
    pages: null,
    description: b.synopsis ?? '',
    cover: coverUrl(b.bookId),
    hasPdf: b.hasPdf,
    hasAudio: b.hasAudio,
  }
}

function mapDetailBook(bookId, detail) {
  const id = Number(bookId)
  return {
    id,
    bookId: id,
    title: detail?.title ?? `Книга #${id}`,
    author: detail?.author?.fullName ?? detail?.authorName ?? '',
    category: detail?.categoryName ?? '',
    subcategory: detail?.subcategoryName ?? '',
    price: detail?.price == null ? '—' : formatPrice(detail.price),
    priceValue: Number(detail?.price),
    rating: Number(detail?.rating) || 0,
    reviews: null,
    year: detail?.publicationYear ?? detail?.year ?? null,
    pages: detail?.pages ?? null,
    description: detail?.synopsis ?? '',
    cover: coverUrl(id),
    hasPdf: Boolean(detail?.hasPdf ?? detail?.hasPDF ?? true),
    hasAudio: Boolean(detail?.hasAudio ?? detail?.hasAUDIO ?? false),
  }
}

function readAny(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}

function parseProgressDate(value) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

function formatAudioTimecode(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function latestLocalProgressTime(slots) {
  return Object.values(slots || {}).reduce((max, slot) => {
    const t = parseProgressDate(slot?.at)
    return t > max ? t : max
  }, 0)
}

function buildLibraryContinueItems(books, progressList) {
  const progressByBookId = new Map(
    (Array.isArray(progressList) ? progressList : [])
      .map((item) => [Number(readAny(item, ['bookId', 'BookId'])), item])
      .filter(([id]) => !Number.isNaN(id)),
  )

  return books
    .map((book) => {
      const bookId = Number(book.bookId)
      if (Number.isNaN(bookId)) return null

      const progress = progressByBookId.get(bookId)
      const serverLastPage = readAny(progress, ['lastPage', 'LastPage'])
      const serverTimecode = readAny(progress, ['timecodeSeconds', 'TimecodeSeconds'])
      const updatedAt = readAny(progress, ['updatedAt', 'UpdatedAt'])
      const local = loadReaderChapterProgress(bookId)
      const localHasSlots = Object.keys(local.slots || {}).length > 0
      const localUpdatedAt = latestLocalProgressTime(local.slots)

      const lastPage = Number(serverLastPage ?? (localHasSlots ? local.lastIndex : null))
      const hasReadingProgress = Number.isFinite(lastPage) && (serverLastPage != null || localHasSlots)
      const timecodeSeconds = Number(serverTimecode)
      const hasAudioProgress = serverTimecode != null && Number.isFinite(timecodeSeconds)

      if (!hasReadingProgress && !hasAudioProgress) return null

      const updatedAtMs = parseProgressDate(updatedAt) || localUpdatedAt
      const updatedAtLabel = updatedAtMs
        ? new Date(updatedAtMs).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : ''

      return {
        ...book,
        updatedAtMs,
        updatedAtLabel,
        readingChapterLabel: hasReadingProgress ? `Глава ${Math.max(0, Math.floor(lastPage)) + 1}` : '',
        audioTimeLabel: hasAudioProgress ? formatAudioTimecode(timecodeSeconds) : '',
        hasReadingProgress,
        hasAudioProgress,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 6)
}

export default function App({ initialView = 'home' }) {
  const [view, setView] = useState(initialView) // home | bookmarks | library | cart | purchases | profile

  const [categories, setCategories] = useState([])
  const [authors, setAuthors] = useState([])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search.trim(), 400)

  const [categoryId, setCategoryId] = useState(null)
  const [subcategoryId, setSubcategoryId] = useState(null)
  const [authorId, setAuthorId] = useState(null)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minRating, setMinRating] = useState('')
  const [publicationYear, setPublicationYear] = useState('')
  const [sortBy, setSortBy] = useState('')

  const [books, setBooks] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [featured, setFeatured] = useState(null)
  const [popular, setPopular] = useState([])
  const [recommendations, setRecommendations] = useState([])

  const [currentPage, setCurrentPage] = useState(1)
  const [authOpen, setAuthOpen] = useState(false)
  const [authToken, setAuthToken] = useState(() => getAuthToken())
  const isAdmin = isAdminToken(authToken)
  const isManager = isManagerToken(authToken)

  useEffect(() => {
    if (isAdmin && window.location.pathname.toLowerCase() !== '/admin') {
      window.location.replace('/admin')
    }
    if (isManager && window.location.pathname.toLowerCase() !== '/manager') {
      window.location.replace('/manager')
    }
  }, [isAdmin, isManager])

  const [authPrompt, setAuthPrompt] = useState('')
  const [bookmarkedBookIds, setBookmarkedBookIds] = useState([])

  const [bookmarkBooks, setBookmarkBooks] = useState([])
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [bookmarkError, setBookmarkError] = useState('')
  const [libraryBooks, setLibraryBooks] = useState([])
  const [libraryContinueItems, setLibraryContinueItems] = useState([])
  const [, setLibraryBookIds] = useState([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [purchases, setPurchases] = useState([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [purchasesError, setPurchasesError] = useState('')
  const [cartItems, setCartItems] = useState(() => {
  try {
    const raw = window.localStorage.getItem('bookstore_cart')
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})
  const cartLoaded = true
  const [cartBuyingBookId, setCartBuyingBookId] = useState(null)
  const [cartBuyingAll, setCartBuyingAll] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutItems, setCheckoutItems] = useState([])
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [, setSubscriptions] = useState([])
  const [toastMessage, setToastMessage] = useState('')

useEffect(() => {
  if (!cartLoaded) return  // ← добавить эту проверку
  window.localStorage.setItem('bookstore_cart', JSON.stringify(cartItems))
}, [cartItems, cartLoaded])

  useEffect(() => {
    window.localStorage.setItem('bookstore_cart', JSON.stringify(cartItems))
  }, [cartItems])

  useEffect(() => {
    Promise.all([fetchAuthors(), fetchCategories()])
      .then(([a, c]) => {
        setAuthors(Array.isArray(a) ? a : [])
        setCategories(Array.isArray(c) ? c : [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const { token, error: oauthError } = consumeOAuthResultFromUrl()
    if (token) {
      saveAuthToken(token)
      setAuthToken(token)
      setAuthOpen(false)
      setAuthPrompt('')
      setToastMessage('Вход через Яндекс выполнен успешно.')
      return
    }

    if (oauthError) {
      setAuthPrompt(oauthError)
      setAuthOpen(true)
      setToastMessage(oauthError)
    }
  }, [])

  useEffect(() => {
    if (!toastMessage) return undefined
    const timer = window.setTimeout(() => setToastMessage(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    const originalAlert = window.alert
    window.alert = (message) => {
      setToastMessage(String(message ?? ''))
    }
    return () => {
      window.alert = originalAlert
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (  !authToken) {
      setBookmarkedBookIds([])
      setLibraryBookIds([])
      setSubscriptions([])
      return
    }
    Promise.all([fetchMyBookmarks(''), fetchMyLibrary(), fetchMySubscriptions()])
      .then(([items, library, subscriptionList]) => {
        if (cancelled) return
        const ids = Array.isArray(items)
          ? items.map(x => Number(x.bookId)).filter(x => !Number.isNaN(x))
          : []
        setBookmarkedBookIds(ids)
        const ownedIds = Array.isArray(library)
          ? library.map((x) => Number(x?.book?.bookId)).filter((x) => !Number.isNaN(x))
          : []
        setLibraryBookIds(ownedIds)
        setSubscriptions(Array.isArray(subscriptionList) ? subscriptionList : [])
      })
      .catch(() => {
        if (!cancelled) {
          setBookmarkedBookIds([])
          setLibraryBookIds([])
          setSubscriptions([])
        }
      })
    return () => { cancelled = true }
  }, [authToken])

  useEffect(() => {
    if (!authToken) {
      setDeliveryAddress('')
      return
    }
    const stored = window.localStorage.getItem('bookstore_delivery_address') || ''
    if (stored) setDeliveryAddress(stored)
  }, [authToken])

  useEffect(() => {
    let cancelled = false
    if (view !== 'bookmarks') return
    if (!authToken) {
      setBookmarkBooks([])
      setBookmarkError('Чтобы смотреть закладки, войдите в аккаунт.')
      setBookmarkLoading(false)
      return
    }

    setBookmarkLoading(true)
    setBookmarkError('')

    fetchMyBookmarks('')
      .then(async (items) => {
        if (cancelled) return
        const ids = Array.isArray(items)
          ? items.map(x => Number(x.bookId)).filter(x => !Number.isNaN(x))
          : []
        setBookmarkedBookIds(ids)

        const uniqueIds = Array.from(new Set(ids)).slice(0, 40)
        const details = await Promise.all(
          uniqueIds.map(async (id) => {
            try {
              const d = await fetchBookDetail(id)
              return { id, detail: d }
            } catch {
              return { id, detail: null }
            }
          }),
        )

        if (cancelled) return
        const mapped = details.map(({ id, detail }) => {
          const title = detail?.title ?? `Книга #${id}`
          const author = detail?.author?.fullName ?? detail?.authorName ?? ''
          const category = detail?.categoryName ?? ''
          const rating = Number(detail?.rating) || 0
          const hasPdf = Boolean(detail?.hasPdf ?? detail?.hasPDF ?? true)
          const hasAudio = Boolean(detail?.hasAudio ?? detail?.hasAUDIO ?? false)
          const year = detail?.publicationYear ?? detail?.year ?? null
          
          const bookmark = items.find(x => Number(x.bookId) === Number(id))

          return {
            id,
            bookId: id,
            title,
            author,
            category,
            subcategory: detail?.subcategoryName ?? '',
            price: '—',
            priceValue: NaN,
            rating,
            reviews: null,
            year,
            pages: detail?.pages ?? null,
            description: detail?.synopsis ?? '',
            cover: coverUrl(id),
            hasPdf,
            hasAudio,
            bookmarkCategory: bookmark?.bookmarkType || '',
          }
        })
        setBookmarkBooks(mapped)
      })
      .catch((e) => {
        if (!cancelled) {
          setBookmarkBooks([])
          setBookmarkError(e?.message || 'Не удалось загрузить закладки.')
        }
      })
      .finally(() => {
        if (!cancelled) setBookmarkLoading(false)
      })

    return () => { cancelled = true }
  }, [view, authToken])

  useEffect(() => {
    let cancelled = false
    if (view !== 'library' && view !== 'purchased_books') return
    if (!authToken) {
      setLibraryBooks([])
      setLibraryContinueItems([])
      setLibraryError('Чтобы смотреть личную библиотеку, войдите в аккаунт.')
      setLibraryLoading(false)
      return
    }

    setLibraryLoading(true)
    setLibraryError('')

    const loadLibrary = async () => {
      try {
        const [items, progressItems, bookmarkItems] = await Promise.all([
          fetchMyLibrary(),
          fetchMyReadingProgress().catch(() => []),
          fetchMyBookmarks('').catch(() => []),
        ])
        if (cancelled) return
        const mapped = Array.isArray(items)
          ? items.map((x) => {
            const b = x?.book ?? {}
            const bookmark = Array.isArray(bookmarkItems)
              ? bookmarkItems.find((bm) => Number(bm.bookId) === Number(b.bookId))
              : null
            return {
              id: b.bookId,
              bookId: b.bookId,
              title: b.title ?? '',
              author: b.authorName ?? '',
              category: b.categoryName ?? '',
              subcategory: b.subcategoryName ?? '',
              price: formatPrice(b.price),
              priceValue: Number(b.price),
              rating: Number(b.rating) || 0,
              reviews: null,
              year: b.publicationYear ?? null,
              pages: null,
              description: b.synopsis ?? '',
              cover: coverUrl(b.bookId),
              hasPdf: Boolean(b.hasPdf),
              hasAudio: Boolean(b.hasAudio),
              acquisitionType: x?.acquisitionType ?? x?.AcquisitionType,
              bookmarkCategory: bookmark?.bookmarkType || '',
            }
          })
          : []
        const libraryIds = new Set(mapped.map((book) => Number(book.bookId)))
        const progressBookIds = Array.from(new Set(
          (Array.isArray(progressItems) ? progressItems : [])
            .map((item) => Number(readAny(item, ['bookId', 'BookId'])))
            .filter((id) => !Number.isNaN(id) && !libraryIds.has(id)),
        ))
        const progressBooks = await Promise.all(
          progressBookIds.map(async (id) => {
            try {
              const detail = await fetchBookDetail(id)
              return mapDetailBook(id, detail)
            } catch {
              return mapDetailBook(id, null)
            }
          }),
        )
        if (cancelled) return
        setLibraryBooks(mapped)
        setLibraryContinueItems(buildLibraryContinueItems([...mapped, ...progressBooks], progressItems))
      } catch (e) {
        if (!cancelled) {
          setLibraryBooks([])
          setLibraryContinueItems([])
          setLibraryError(e?.message || 'Не удалось загрузить библиотеку.')
        }
      }
    }

    loadLibrary()
      .finally(() => {
        if (!cancelled) setLibraryLoading(false)
      })

    return () => { cancelled = true }
  }, [view, authToken])

  useEffect(() => {
    let cancelled = false
    if (view !== 'purchases') return
    if (!authToken) {
      setPurchases([])
      setPurchasesError('Чтобы смотреть покупки, войдите в аккаунт.')
      setPurchasesLoading(false)
      return
    }

    setPurchasesLoading(true)
    setPurchasesError('')

    fetchMyDeliveryOrders()
      .then((list) => {
        if (cancelled) return
        setPurchases(Array.isArray(list) ? list : [])
      })
      .catch((e) => {
        if (!cancelled) {
          setPurchases([])
          setPurchasesError(e?.message || 'Не удалось загрузить заказы.')
        }
      })
      .finally(() => {
        if (!cancelled) setPurchasesLoading(false)
      })

    return () => { cancelled = true }
  }, [view, authToken])

  useEffect(() => {
    fetchBooksCatalog({ pageSize: 1, sortBy: 'rating', page: 1 })
      .then(d => {
        const item = d.items?.[0]
        if (item) setFeatured(mapListBook(item))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchBooksCatalog({ pageSize: 5, sortBy: 'rating', page: 1 })
      .then(d => setPopular((d.items || []).map(mapListBook)))
      .catch(() => setPopular([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchBookRecommendations()
      .then(d => {
        if (!cancelled) {
          setRecommendations((d || []).map(mapListBook))
        }
      })
      .catch(() => {
        if (!cancelled) setRecommendations([])
      })
    return () => { cancelled = true }
  }, [authToken])
  

  const selectedCategory = categories.find(c => c.categoryId === categoryId)
  const subcategories = selectedCategory?.subcategories ?? []

  useEffect(() => {
    setCurrentPage(1)
  }, [
    debouncedSearch,
    categoryId,
    subcategoryId,
    authorId,
    minPrice,
    maxPrice,
    minRating,
    publicationYear,
    sortBy,
  ])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const minP = minPrice.trim() === '' ? null : Number(minPrice)
    const maxP = maxPrice.trim() === '' ? null : Number(maxPrice)
    const minR = minRating === '' ? null : Number(minRating)
    const year = publicationYear.trim() === '' ? null : Number(publicationYear)

    fetchBooksCatalog({
      search: debouncedSearch || undefined,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
      authorId: authorId ?? undefined,
      minPrice: minP != null && !Number.isNaN(minP) ? minP : undefined,
      maxPrice: maxP != null && !Number.isNaN(maxP) ? maxP : undefined,
      minRating: minR != null && !Number.isNaN(minR) ? minR : undefined,
      publicationYear: year != null && !Number.isNaN(year) ? year : undefined,
      sortBy: sortBy || undefined,
      page: currentPage,
      pageSize: BOOKS_PER_PAGE,
    })
      .then(data => {
        if (cancelled) return
        setBooks((data.items || []).map(mapListBook))
        const tc = data.totalCount ?? 0
        setTotalCount(tc)
        const ps = data.pageSize ?? BOOKS_PER_PAGE
        setTotalPages(data.totalPages ?? Math.max(1, Math.ceil(tc / ps)))
      })
      .catch(e => {
        if (!cancelled) setError(e.message || 'Ошибка загрузки')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [
    debouncedSearch,
    categoryId,
    subcategoryId,
    authorId,
    minPrice,
    maxPrice,
    minRating,
    publicationYear,
    sortBy,
    currentPage,
  ])

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const clearFilters = () => {
    setCategoryId(null)
    setSubcategoryId(null)
    setAuthorId(null)
    setMinPrice('')
    setMaxPrice('')
    setMinRating('')
    setPublicationYear('')
    setSortBy('')
    setSearch('')
  }

  const onPickCategory = (id) => {
    setCategoryId(id)
    setSubcategoryId(null)
  }

  const openBookPage = useCallback((book) => {
    if (!book?.bookId) return
    window.location.href = `/book/${book.bookId}`
  }, [])

  const handleContinueAudio = useCallback((book) => {
    if (!book?.bookId) return
    requestOpenGlobalAudioPlayer({
      bookId: book.bookId,
      title: book.title || `Книга #${book.bookId}`,
      author: book.author || '',
      cover: book.cover || coverUrl(book.bookId),
    })
  }, [])

  const handleAddToCart = useCallback((book) => {
    if (!authToken) {
      setAuthPrompt('Чтобы добавить книгу в корзину, сначала войдите в аккаунт.')
      setAuthOpen(true)
      return
    }
    setCartItems((prev) => {
      const isElectronic = Boolean(book.isElectronic)
      if (prev.some((x) => x.bookId === book.bookId && Boolean(x.isElectronic) === isElectronic)) return prev
      return [{ ...book, isElectronic }, ...prev]
    })
  }, [authToken])

  const openCheckout = useCallback((items) => {
    if (!authToken) {
      setAuthPrompt('Чтобы оформить заказ, сначала войдите в аккаунт.')
      setAuthOpen(true)
      return
    }
    if (!Array.isArray(items) || items.length === 0) return
    setCheckoutItems(items)
    setCheckoutOpen(true)
  }, [authToken])

  const handleBuyFromCart = useCallback(async (book) => {
    openCheckout([book])
  }, [openCheckout])

  const handleBuyAllFromCart = useCallback(async () => {
    openCheckout(cartItems)
  }, [cartItems, openCheckout])

  const submitCheckout = useCallback(async (addressRaw) => {
    const isElectronicOnly = checkoutItems.every((x) => x.isElectronic)
    const address = String(addressRaw || '').trim()
    if (!address && !isElectronicOnly) {
      alert('Укажите адрес доставки.')
      return
    }
    const isSingle = checkoutItems.length === 1
    if (isSingle) {
      setCartBuyingBookId(checkoutItems[0].bookId)
    } else {
      setCartBuyingAll(true)
    }
    try {
      if (!isElectronicOnly) {
        window.localStorage.setItem('bookstore_delivery_address', address)
        setDeliveryAddress(address)
      }

      const createdOrders = []
      for (const item of checkoutItems) {
        const itemAddress = item.isElectronic ? 'Электронная версия' : address
        // eslint-disable-next-line no-await-in-loop
        const created = await createPhysicalOrder(item.bookId, itemAddress, 'card')
        createdOrders.push({
          ...created,
          bookId: item.bookId,
          bookTitle: created?.bookTitle || item.title,
          amount: created?.amount ?? created?.totalAmount ?? (Number(item.priceValue) || 0),
          paymentMethod: created?.paymentMethod || 'card',
          deliveryAddress: created?.deliveryAddress || itemAddress,
          orderDate: created?.orderDate || new Date().toISOString(),
          status: created?.status || 'created',
        })
      }
      setPurchases((prev) => [...createdOrders, ...prev])
      setCartItems((prev) =>
        prev.filter(
          (x) =>
            !checkoutItems.some(
              (item) => item.bookId === x.bookId && Boolean(item.isElectronic) === Boolean(x.isElectronic),
            ),
        ),
      )
      setCheckoutOpen(false)
      if (isElectronicOnly) {
        alert('Покупка электронной книги успешно оформлена! Доступ предоставлен в личном кабинете.')
      } else {
        alert('Заказ оформлен. Мы доставим физическую книгу по указанному адресу.')
      }
    } catch (e) {
      alert(e?.message || 'Не удалось оформить заказ.')
    } finally {
      setCartBuyingBookId(null)
      setCartBuyingAll(false)
    }
  }, [checkoutItems])

  const cartBookIds = cartItems.map((x) => x.bookId)

  const filterSummaryParts = []
  if (debouncedSearch) filterSummaryParts.push(`запрос «${debouncedSearch}»`)
  if (categoryId != null) {
    const name = categories.find(c => c.categoryId === categoryId)?.name
    if (name) filterSummaryParts.push(`жанр: ${name}`)
  }
  if (authorId != null) {
    const name = authors.find(a => a.authorId === authorId)?.fullName
    if (name) filterSummaryParts.push(`автор: ${name}`)
  }

  return (
    <>
      <Navbar
        isAuthorized={Boolean(authToken)}
        isAdmin={isAdmin}
        onHomeClick={() => {
          window.location.href = '/'
        }}
        onAuthClick={() => {
          setAuthPrompt('')
          setAuthOpen(true)
        }}
        onSubscriptionClick={() => {
          setSubscriptionOpen(true)
        }}
        onCartClick={() => {
          if (!authToken) {
            setAuthPrompt('Чтобы открыть корзину, сначала войдите в аккаунт.')
            setAuthOpen(true)
            return
          }
          window.location.href = '/cart'
        }}
        onLibraryClick={() => {
          if (!authToken) {
            setAuthPrompt('Чтобы открыть "Мои книги", сначала войдите в аккаунт.')
            setAuthOpen(true)
            return
          }
          window.location.href = '/library'
        }}
        onPurchasedBooksClick={() => {
          if (!authToken) {
            setAuthPrompt('Чтобы открыть "Купленные книги", сначала войдите в аккаунт.')
            setAuthOpen(true)
            return
          }
          window.location.href = '/purchased-books'
        }}
        onPurchasesClick={() => {
          if (!authToken) {
            setAuthPrompt('Чтобы открыть "Мои заказы", сначала войдите в аккаунт.')
            setAuthOpen(true)
            return
          }
          window.location.href = '/purchases'
        }}
        onBookmarksClick={() => {
          if (!authToken) {
            setAuthPrompt('Чтобы открыть закладки, сначала войдите в аккаунт.')
            setAuthOpen(true)
            return
          }
          window.location.href = '/bookmarks'
        }}
        onProfileClick={() => {
          if (!authToken) {
            setAuthPrompt('Чтобы открыть профиль, войдите в аккаунт.')
            setAuthOpen(true)
            return
          }
          window.location.href = '/profile'
        }}
        isManager={isManager}
        onManagerPanelClick={isManager ? () => {
          window.location.href = '/manager'
        } : undefined}
        onAdminPanelClick={() => {
          if (!isAdmin) return
          window.location.href = '/admin'
        }}
        onLogout={() => {
          clearAuthToken()
          setAuthToken('')
          window.location.href = '/'
        }}
      />

      <main className="main">
        {view === 'home' ? (
          <>
            <HeroSection featured={featured} onSelectBook={openBookPage} />

            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 var(--layout-gutter)' }}>
              <RecommendationsSection
                recommendations={recommendations}
                onSelectBook={openBookPage}
                bookmarkedBookIds={bookmarkedBookIds}
                onAddToCart={handleAddToCart}
                cartBookIds={cartBookIds}
              />
            </div>

            <section className="catalog-section" id="explore">
              <aside className="catalog-sidebar">
                <ExploreHeader
                  loading={loading}
                  totalCount={totalCount}
                  filterSummaryParts={filterSummaryParts}
                />

                <CatalogToolbar
                  variant="sidebar"
                  search={search}
                  onSearchChange={setSearch}
                  categories={categories}
                  categoryId={categoryId}
                  onCategoryChange={onPickCategory}
                  subcategories={subcategories}
                  subcategoryId={subcategoryId}
                  onSubcategoryChange={setSubcategoryId}
                  authors={authors}
                  authorId={authorId}
                  onAuthorChange={setAuthorId}
                  minRating={minRating}
                  onMinRatingChange={setMinRating}
                  minPrice={minPrice}
                  onMinPriceChange={setMinPrice}
                  maxPrice={maxPrice}
                  onMaxPriceChange={setMaxPrice}
                  publicationYear={publicationYear}
                  onPublicationYearChange={setPublicationYear}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  onClearFilters={clearFilters}
                />
              </aside>

              <div className="catalog-main">
                <CatalogContent
                  error={error}
                  loading={loading}
                  books={books}
                  bookmarkedBookIds={bookmarkedBookIds}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  onSelectBook={openBookPage}
                  onPageChange={handlePageChange}
                  onAddToCart={handleAddToCart}
                  cartBookIds={cartBookIds}
                  ownedBookIds={[]}
                />

                <PopularSection
                  popular={popular}
                  onSelectBook={openBookPage}
                  bookmarkedBookIds={bookmarkedBookIds}
                />
              </div>
            </section>
          </>
        ) : view === 'bookmarks' ? (
          <BookmarksContent
            loading={bookmarkLoading}
            error={bookmarkError}
            books={bookmarkBooks}
            bookmarkedBookIds={bookmarkedBookIds}
            cartBookIds={cartBookIds}
            ownedBookIds={[]}
            onSelectBook={openBookPage}
            onAddToCart={handleAddToCart}
            onBack={() => { window.location.href = '/' }}
          />
        ) : view === 'library' ? (
          <LibraryContent
            loading={libraryLoading}
            error={libraryError}
            books={libraryBooks}
            continueItems={libraryContinueItems}
            bookmarkedBookIds={bookmarkedBookIds}
            cartBookIds={cartBookIds}
            ownedBookIds={[]}
            onSelectBook={openBookPage}
            onAddToCart={handleAddToCart}
            onContinueAudio={handleContinueAudio}
            onBack={() => { window.location.href = '/' }}
          />
        ) : view === 'purchased_books' ? (
          <LibraryContent
            loading={libraryLoading}
            error={libraryError}
            books={libraryBooks.filter((b) => b.acquisitionType === 'purchase')}
            continueItems={[]}
            bookmarkedBookIds={bookmarkedBookIds}
            cartBookIds={cartBookIds}
            ownedBookIds={[]}
            onSelectBook={openBookPage}
            onAddToCart={handleAddToCart}
            onContinueAudio={handleContinueAudio}
            onBack={() => { window.location.href = '/' }}
            title="Купленные книги"
          />
        ) : view === 'cart' ? (
          <CartContent
            items={cartItems}
            onBack={() => { window.location.href = '/' }}
            onRemove={(bookId, isElectronic) => setCartItems((prev) => prev.filter((x) => !(x.bookId === bookId && Boolean(x.isElectronic) === Boolean(isElectronic))))}
            onBuyOne={handleBuyFromCart}
            onBuyAll={handleBuyAllFromCart}
            busyBookId={cartBuyingBookId}
            buyingAll={cartBuyingAll}
          />
        ) : view === 'profile' ? (
          <ProfileContent
            isAuthorized={Boolean(authToken)}
            onAuthRequired={() => {
              setAuthPrompt('Чтобы открыть профиль, войдите в аккаунт.')
              setAuthOpen(true)
            }}
            onBack={() => {
              setView('home')
              window.history.pushState({}, '', '/')
            }}
            onSaved={(profile) => {
              void profile
              setToastMessage('Профиль сохранён.')
            }}
            onLogout={() => {
              clearAuthToken()
              setAuthToken('')
              window.location.href = '/'
            }}
          />
        ) : (
          <PurchasesContent
            loading={purchasesLoading}
            error={purchasesError}
            purchases={purchases}
            onBack={() => { window.location.href = '/' }}
          />
        )}
      </main>

      <Footer />
      {toastMessage ? <div className="app-toast">{toastMessage}</div> : null}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthSuccess={(token) => setAuthToken(token)}
          promptText={authPrompt}
        />
      )}
      {subscriptionOpen && (
        <SubscriptionModal
          isAuthorized={Boolean(authToken)}
          onClose={() => setSubscriptionOpen(false)}
          onAuthRequired={(message) => {
            setSubscriptionOpen(false)
            setAuthPrompt(message)
            setAuthOpen(true)
          }}
          onSubscriptionPurchased={(created) => {
            setSubscriptions((prev) => [
              created,
              ...prev.filter((item) => item.subscriptionId !== created.subscriptionId),
            ])
            setToastMessage(`Подписка "${created.planName}" активирована. Теперь книги доступны для чтения.`)
          }}
        />
      )}
      {checkoutOpen ? (
        <CheckoutModal
          items={checkoutItems}
          isElectronic={checkoutItems.every((x) => x.isElectronic)}
          initialAddress={deliveryAddress}
          busy={Boolean(cartBuyingBookId) || cartBuyingAll}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={submitCheckout}
        />
      ) : null}
    </>
  )
}
