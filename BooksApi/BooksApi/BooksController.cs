using System.Security.Claims;
using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly AppDbContext _db;
    public BooksController(AppDbContext db) => _db = db;

    private int? CurrentUserId => User.Identity?.IsAuthenticated == true
        ? int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!)
        : null;

    /// <summary>Каталог книг с фильтрами и пагинацией</summary>
    [HttpGet("Books_GetCatalog")]
    public async Task<ActionResult<PagedResult<BookResponse>>> GetCatalog([FromQuery] BookFilterRequest filter)
    {
        var query = _db.Books
            .Include(b => b.Author)
            .Include(b => b.Category)
            .Include(b => b.Subcategory)
            .Where(b => b.IsActive && b.CoverImage != null)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.ToLower();
            query = query.Where(b =>
                b.Title.ToLower().Contains(s) ||
                b.Author.FullName.ToLower().Contains(s) ||
                b.Category.Name.ToLower().Contains(s) ||
                b.Subcategory.Name.ToLower().Contains(s));
        }

        if (filter.CategoryId.HasValue)    query = query.Where(b => b.CategoryId == filter.CategoryId.Value);
        if (filter.SubcategoryId.HasValue) query = query.Where(b => b.SubcategoryId == filter.SubcategoryId.Value);
        if (filter.AuthorId.HasValue)      query = query.Where(b => b.AuthorId == filter.AuthorId.Value);
        if (filter.MinPrice.HasValue)      query = query.Where(b => b.Price >= filter.MinPrice.Value);
        if (filter.MaxPrice.HasValue)      query = query.Where(b => b.Price <= filter.MaxPrice.Value);
        if (filter.MinRating.HasValue)     query = query.Where(b => b.Rating >= filter.MinRating.Value);
        if (filter.PublicationYear.HasValue) query = query.Where(b => b.PublicationYear == filter.PublicationYear.Value);

        query = filter.SortBy switch
        {
            "price_asc"  => query.OrderBy(b => b.Price),
            "price_desc" => query.OrderByDescending(b => b.Price),
            "rating"     => query.OrderByDescending(b => b.Rating),
            "title"      => query.OrderBy(b => b.Title),
            _            => query.OrderByDescending(b => b.BookId)
        };

        var total = await query.CountAsync();
        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return Ok(new PagedResult<BookResponse>(
            items.Select(MapBook).ToList(), total, filter.Page, filter.PageSize));
    }

    /// <summary>Полный список книг, включая архивные [admin, meneger]</summary>
    [HttpGet("Books_GetAllAdmin")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<List<BookResponse>>> GetAllAdmin()
    {
        var items = await _db.Books
            .Include(b => b.Author)
            .Include(b => b.Category)
            .Include(b => b.Subcategory)
            .OrderByDescending(b => b.BookId)
            .ToListAsync();

        return Ok(items.Select(MapBook).ToList());
    }

    /// <summary>Детальная информация о книге с отзывами</summary>
    [HttpGet("{id}/Books_GetById")]
    public async Task<ActionResult<BookDetailResponse>> GetById(int id)
    {
        var book = await _db.Books
            .Include(b => b.Author)
            .Include(b => b.Category)
            .Include(b => b.Subcategory)
            .Include(b => b.Reviews.Where(r => r.IsActive))
                .ThenInclude(r => r.User)
            .FirstOrDefaultAsync(b => b.BookId == id && b.IsActive);

        if (book == null) return NotFound();

        return Ok(new BookDetailResponse(
            book.BookId, book.Title,
            new AuthorResponse(book.Author.AuthorId, book.Author.FullName, book.Author.Biography, book.Author.BirthYear, book.Author.DeathYear),
            book.Category.Name, book.Subcategory.Name,
            book.PublicationYear, book.Publisher, book.Synopsis,
            book.Price, book.Rating, book.StockQuantity,
            book.ContentPdf != null, book.ContentAudio != null,
            book.Reviews.Select(MapReview).ToList()
        ));
    }

    /// <summary>Получить обложку книги</summary>
    [HttpGet("{id}/Books_GetCover")]
    public async Task<IActionResult> GetCover(int id)
    {
        var book = await _db.Books.FindAsync(id);
        if (book?.CoverImage == null) return NotFound();
        return File(book.CoverImage, "image/jpeg");
    }

    private async Task<bool> CheckBookAccess(int bookId)
    {
        var userId = CurrentUserId;
        if (userId == null) return false;

        // Check electronic purchase
        var hasPurchased = await _db.Purchases.AnyAsync(p =>
            p.UserId == userId.Value && p.BookId == bookId && p.Status == "success");
        if (hasPurchased) return true;

        // Check active subscription (direct or via family group)
        var user = await _db.Users.Include(u => u.SubscriptionOwner)
            .FirstOrDefaultAsync(u => u.UserId == userId.Value);
        if (user == null) return false;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (user.SubscriptionOwner != null)
        {
            return user.SubscriptionOwner.SubscriptionStatus == "active" &&
                   user.SubscriptionOwner.SubscriptionEndDate >= today;
        }

        return user.SubscriptionStatus == "active" &&
               user.SubscriptionEndDate >= today;
    }

    /// <summary>Читать PDF книгу во встроенном просмотрщике [Authorized]</summary>
    [HttpGet("{id}/Books_ReadPdf")]
    [Authorize]
    public async Task<IActionResult> GetPdf(int id)
    {
        if (!await CheckBookAccess(id))
            return StatusCode(403, "Доступ запрещен. Требуется активная подписка или покупка книги.");

        var book = await _db.Books.FindAsync(id);
        if (book?.ContentPdf == null) return NotFound("PDF недоступен");

        return File(book.ContentPdf, "application/pdf");
    }

    /// <summary>Скачать PDF книгу для офлайн-чтения [Authorized]</summary>
    [HttpGet("{id}/Books_DownloadPdf")]
    [Authorize]
    public async Task<IActionResult> DownloadPdf(int id)
    {
        if (!await CheckBookAccess(id))
            return StatusCode(403, "Доступ запрещен. Требуется активная подписка или покупка книги.");

        var book = await _db.Books.FindAsync(id);
        if (book?.ContentPdf == null) return NotFound("PDF недоступен");

        return File(book.ContentPdf, "application/pdf", $"book_{id}.pdf", enableRangeProcessing: false);
    }

    /// <summary>Слушать аудиокнигу во встроенном плеере [Authorized]</summary>
    [HttpGet("{id}/Books_StreamAudio")]
    [HttpGet("{id}/Books_ListenAudio")]
    [Authorize]
    public async Task<IActionResult> GetAudio(int id)
    {
        if (!await CheckBookAccess(id))
            return StatusCode(403, "Доступ запрещен. Требуется активная подписка или покупка книги.");

        var book = await _db.Books.FindAsync(id);
        if (book?.ContentAudio == null) return NotFound("Аудио недоступно");

        return File(book.ContentAudio, "audio/mpeg", $"book_{id}.mp3");
    }

    /// <summary>Скачать аудиокнигу для офлайн-прослушивания [Authorized]</summary>
    [HttpGet("{id}/Books_DownloadAudio")]
    [Authorize]
    public async Task<IActionResult> DownloadAudio(int id)
    {
        if (!await CheckBookAccess(id))
            return StatusCode(403, "Доступ запрещен. Требуется активная подписка или покупка книги.");

        var book = await _db.Books.FindAsync(id);
        if (book?.ContentAudio == null) return NotFound("Аудио недоступно");

        return File(book.ContentAudio, "audio/mpeg", $"book_{id}.mp3", enableRangeProcessing: false);
    }

    /// <summary>Добавить книгу [admin, meneger]</summary>
    [HttpPost("Books_Create")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<BookResponse>> Create([FromForm] CreateBookRequest req,
        IFormFile? cover, IFormFile? pdf, IFormFile? audio)
    {
        var book = new Book
        {
            Title = req.Title,
            AuthorId = req.AuthorId,
            CategoryId = req.CategoryId,
            SubcategoryId = req.SubcategoryId,
            PublicationYear = req.PublicationYear,
            Publisher = req.Publisher,
            Synopsis = req.Synopsis,
            Price = req.Price,
            StockQuantity = req.StockQuantity,
            CoverImage   = cover != null ? await ReadBytes(cover) : null,
            ContentPdf   = pdf   != null ? await ReadBytes(pdf)   : null,
            ContentAudio = audio != null ? await ReadBytes(audio) : null
        };

        _db.Books.Add(book);
        await _db.SaveChangesAsync();
        await _db.Entry(book).Reference(b => b.Author).LoadAsync();
        await _db.Entry(book).Reference(b => b.Category).LoadAsync();
        await _db.Entry(book).Reference(b => b.Subcategory).LoadAsync();

        return CreatedAtAction(nameof(GetById), new { id = book.BookId }, MapBook(book));
    }

    /// <summary>Редактировать информацию о книге [admin, meneger]</summary>
    [HttpPut("{id}/Books_Update")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<BookResponse>> Update(int id, [FromForm] UpdateBookRequest req,
        IFormFile? cover, IFormFile? pdf, IFormFile? audio)
    {
        var book = await _db.Books
            .Include(b => b.Author).Include(b => b.Category).Include(b => b.Subcategory)
            .FirstOrDefaultAsync(b => b.BookId == id);
        if (book == null) return NotFound();

        if (req.Title             != null) book.Title             = req.Title;
        if (req.AuthorId          != null) book.AuthorId          = req.AuthorId.Value;
        if (req.CategoryId        != null) book.CategoryId        = req.CategoryId.Value;
        if (req.SubcategoryId     != null) book.SubcategoryId     = req.SubcategoryId.Value;
        if (req.PublicationYear   != null) book.PublicationYear   = req.PublicationYear.Value;
        if (req.Publisher         != null) book.Publisher         = req.Publisher;
        if (req.Synopsis          != null) book.Synopsis          = req.Synopsis;
        if (req.Price             != null) book.Price             = req.Price.Value;
        if (req.StockQuantity     != null) book.StockQuantity     = req.StockQuantity.Value;
        if (req.IsActive          != null) book.IsActive          = req.IsActive.Value;
        if (cover != null) book.CoverImage   = await ReadBytes(cover);
        if (pdf   != null) book.ContentPdf   = await ReadBytes(pdf);
        if (audio != null) book.ContentAudio = await ReadBytes(audio);

        await _db.SaveChangesAsync();
        return Ok(MapBook(book));
    }

    /// <summary>Архивировать книгу из каталога [admin, meneger]</summary>
    [HttpDelete("{id}/Books_Archive")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<IActionResult> Archive(int id)
    {
        var book = await _db.Books.FindAsync(id);
        if (book == null) return NotFound();
        book.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Получить рекомендации по книгам</summary>
    [HttpGet("Books_GetRecommendations")]
    public async Task<ActionResult<List<BookResponse>>> GetRecommendations()
    {
        var userId = CurrentUserId;

        var preferredCategoryIds = new List<int>();
        var preferredSubcategoryIds = new List<int>();
        var preferredAuthorIds = new List<int>();
        var alreadyReadBookIds = new List<int>();

        if (userId.HasValue)
        {
            var libraryBookIds = await _db.UserLibrary
                .Where(l => l.UserId == userId.Value)
                .Select(l => l.BookId)
                .ToListAsync();

            var bookmarkBookIds = await _db.Bookmarks
                .Where(b => b.UserId == userId.Value)
                .Select(b => b.BookId)
                .ToListAsync();

            var progressBookIds = await _db.ReadingProgresses
                .Where(r => r.UserId == userId.Value)
                .Select(r => r.BookId)
                .ToListAsync();

            alreadyReadBookIds.AddRange(libraryBookIds);
            alreadyReadBookIds.AddRange(bookmarkBookIds);
            alreadyReadBookIds.AddRange(progressBookIds);
            alreadyReadBookIds = alreadyReadBookIds.Distinct().ToList();

            if (alreadyReadBookIds.Any())
            {
                var readBooks = await _db.Books
                    .Where(b => alreadyReadBookIds.Contains(b.BookId))
                    .ToListAsync();

                preferredCategoryIds = readBooks.Select(b => b.CategoryId).Distinct().ToList();
                preferredSubcategoryIds = readBooks.Select(b => b.SubcategoryId).Distinct().ToList();
                preferredAuthorIds = readBooks.Select(b => b.AuthorId).Distinct().ToList();
            }
        }

        var query = _db.Books
            .Include(b => b.Author)
            .Include(b => b.Category)
            .Include(b => b.Subcategory)
            .Where(b => b.IsActive && b.CoverImage != null && !alreadyReadBookIds.Contains(b.BookId));

        List<Book> recommendedBooks;

        if (preferredCategoryIds.Any() || preferredSubcategoryIds.Any() || preferredAuthorIds.Any())
        {
            recommendedBooks = await query
                .OrderByDescending(b => (preferredAuthorIds.Contains(b.AuthorId) ? 3 : 0) +
                                        (preferredSubcategoryIds.Contains(b.SubcategoryId) ? 2 : 0) +
                                        (preferredCategoryIds.Contains(b.CategoryId) ? 1 : 0))
                .ThenByDescending(b => b.Rating)
                .Take(6)
                .ToListAsync();
        }
        else
        {
            recommendedBooks = await query
                .OrderByDescending(b => b.Rating)
                .Take(6)
                .ToListAsync();
        }

        if (recommendedBooks.Count < 6)
        {
            var existingIds = recommendedBooks.Select(b => b.BookId).ToList();
            var fallbackBooks = await _db.Books
                .Include(b => b.Author)
                .Include(b => b.Category)
                .Include(b => b.Subcategory)
                .Where(b => b.IsActive && b.CoverImage != null && !alreadyReadBookIds.Contains(b.BookId) && !existingIds.Contains(b.BookId))
                .OrderByDescending(b => b.Rating)
                .Take(6 - recommendedBooks.Count)
                .ToListAsync();

            recommendedBooks.AddRange(fallbackBooks);
        }

        if (recommendedBooks.Count < 6)
        {
            var existingIds = recommendedBooks.Select(b => b.BookId).ToList();
            var fallbackBooks = await _db.Books
                .Include(b => b.Author)
                .Include(b => b.Category)
                .Include(b => b.Subcategory)
                .Where(b => b.IsActive && b.CoverImage != null && !existingIds.Contains(b.BookId))
                .OrderByDescending(b => b.Rating)
                .Take(6 - recommendedBooks.Count)
                .ToListAsync();

            recommendedBooks.AddRange(fallbackBooks);
        }

        return Ok(recommendedBooks.Select(MapBook).ToList());
    }

    // ─── HELPERS ──────────────────────────────

    private static async Task<byte[]> ReadBytes(IFormFile file)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        return ms.ToArray();
    }

    internal static BookResponse MapBook(Book b) => new(
        b.BookId, b.Title, b.Author.FullName, b.Category.Name, b.Subcategory.Name,
        b.PublicationYear, b.Publisher, b.Synopsis, b.Price, b.Rating,
        b.StockQuantity, b.IsActive, b.ContentPdf != null, b.ContentAudio != null,
        b.AuthorId, b.CategoryId, b.SubcategoryId, b.CoverImage != null
    );

    internal static ReviewResponse MapReview(Review r) => new(
        r.ReviewId, r.UserId,
        $"{r.User.FirstName} {r.User.LastName}",
        r.BookId, r.Rating, r.ReviewText, r.CreatedAt, r.IsActive,
        r.HasViolation, r.ViolationReason, r.Book?.Title
    );
}
