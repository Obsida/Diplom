using System.Security.Claims;
using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

// ═══════════════════════════════════════════════
// Личная библиотека
// ═══════════════════════════════════════════════
[ApiController]
[Route("api/library")]
[Authorize]
public class UserLibraryController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserLibraryController(AppDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Моя библиотека — все купленные и доступные по подписке книги</summary>
    [HttpGet("Library_GetMyLibrary")]
    public async Task<ActionResult<List<LibraryItemResponse>>> GetMyLibrary()
    {
        var items = await _db.UserLibrary
            .Include(l => l.Book).ThenInclude(b => b.Author)
            .Include(l => l.Book).ThenInclude(b => b.Category)
            .Include(l => l.Book).ThenInclude(b => b.Subcategory)
            .Where(l => l.UserId == CurrentUserId)
            .OrderByDescending(l => l.AddedDate)
            .ToListAsync();

        return Ok(items.Select(l => new LibraryItemResponse(
            l.LibraryId, BooksController.MapBook(l.Book), l.AddedDate, l.AcquisitionType)));
    }

    /// <summary>Проверить, есть ли книга в библиотеке</summary>
    [HttpGet("{bookId}/Library_HasBook")]
    public async Task<ActionResult<bool>> HasBook(int bookId)
    {
        var exists = await _db.UserLibrary.AnyAsync(l => l.UserId == CurrentUserId && l.BookId == bookId);
        return Ok(exists);
    }

    /// <summary>Удалить книгу из библиотеки (только бесплатные/подписочные)</summary>
    [HttpDelete("{bookId}/Library_RemoveBook")]
    public async Task<IActionResult> RemoveFromLibrary(int bookId)
    {
        var item = await _db.UserLibrary
            .FirstOrDefaultAsync(l => l.UserId == CurrentUserId && l.BookId == bookId);
        if (item == null) return NotFound();
        if (item.AcquisitionType == "purchase")
            return BadRequest("Купленные книги нельзя удалить из библиотеки");

        _db.UserLibrary.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ═══════════════════════════════════════════════
// Закладки
// ═══════════════════════════════════════════════
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BookmarksController : ControllerBase
{
    private readonly AppDbContext _db;
    public BookmarksController(AppDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Мои закладки (опционально фильтр: reading / favorite / completed / later)</summary>
    [HttpGet("Bookmarks_GetMy")]
    public async Task<ActionResult<List<BookmarkResponse>>> GetMyBookmarks([FromQuery] string? type)
    {
        var query = _db.Bookmarks
            .Include(b => b.Book)
            .Include(b => b.Type)
            .Where(b => b.UserId == CurrentUserId);

        if (!string.IsNullOrWhiteSpace(type))
        {
            var normalizedType = type.Trim().ToLower() switch
            {
                "reading" or "читаю" => "Читаю",
                "completed" or "прочитано" => "Прочитано",
                "later" or "позже" => "Позже",
                "favorite" or "любимое" => "Любимое",
                _ => type
            };
            query = query.Where(b => b.Type.Name == normalizedType);
        }
        var bookmarks = await query.OrderByDescending(b => b.AddedDate).ToListAsync();
        return Ok(bookmarks.Select(Map));
    }

    /// <summary>Добавить или обновить категорию чтения книги</summary>
    [HttpPost("Bookmarks_Add")]
    public async Task<ActionResult<BookmarkResponse>> Add([FromBody] AddBookmarkRequest req)
    {
        var normalizedType = req.BookmarkType.Trim().ToLower() switch
        {
            "reading" or "читаю" => "Читаю",
            "completed" or "прочитано" => "Прочитано",
            "later" or "позже" => "Позже",
            "favorite" or "любимое" => "Любимое",
            _ => null
        };

        if (normalizedType == null)
            return BadRequest("bookmark_type должен быть 'Читаю', 'Прочитано' или 'Позже'");

        var typeEntity = await _db.BookmarkTypes.FirstOrDefaultAsync(t => t.Name == normalizedType);
        if (typeEntity == null)
            return BadRequest("Заданный тип категории чтения не поддерживается в системе");

        var bookmark = await _db.Bookmarks
            .Include(b => b.Type)
            .FirstOrDefaultAsync(b => b.UserId == CurrentUserId && b.BookId == req.BookId);

        if (bookmark != null)
        {
            if (bookmark.TypeId == typeEntity.TypeId)
            {
                await _db.Entry(bookmark).Reference(b => b.Book).LoadAsync();
                return Ok(Map(bookmark));
            }
            bookmark.TypeId = typeEntity.TypeId;
            bookmark.AddedDate = DateTime.UtcNow;
        }
        else
        {
            bookmark = new Bookmark { UserId = CurrentUserId, BookId = req.BookId, TypeId = typeEntity.TypeId };
            _db.Bookmarks.Add(bookmark);
        }

        await _db.SaveChangesAsync();
        await _db.Entry(bookmark).Reference(b => b.Book).LoadAsync();
        await _db.Entry(bookmark).Reference(b => b.Type).LoadAsync();
        return CreatedAtAction(nameof(GetMyBookmarks), Map(bookmark));
    }

    /// <summary>Удалить закладку</summary>
    [HttpDelete("{id}/Bookmarks_Remove")]
    public async Task<IActionResult> Remove(int id)
    {
        var bm = await _db.Bookmarks.FirstOrDefaultAsync(b => b.BookmarkId == id && b.UserId == CurrentUserId);
        if (bm == null) return NotFound();
        _db.Bookmarks.Remove(bm);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static BookmarkResponse Map(Bookmark b) =>
        new(b.BookmarkId, b.BookId, b.Book.Title, b.Type.Name, b.AddedDate);
}

// ═══════════════════════════════════════════════
// Прогресс чтения
// ═══════════════════════════════════════════════
[ApiController]
[Route("api/reading-progress")]
[Authorize]
public class ReadingProgressController : ControllerBase
{
    private readonly AppDbContext _db;
    public ReadingProgressController(AppDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Весь прогресс чтения пользователя по всем книгам</summary>
    [HttpGet("ReadingProgress_GetAll")]
    public async Task<ActionResult<List<ProgressResponse>>> GetAll()
    {
        var list = await _db.ReadingProgresses
            .Include(x => x.Book)
            .Where(x => x.UserId == CurrentUserId)
            .ToListAsync();
        return Ok(list.Select(Map));
    }

    /// <summary>Прогресс по конкретной книге</summary>
    [HttpGet("{bookId}", Name = "ReadingProgress_GetByBook")]
    public async Task<ActionResult<ProgressResponse>> GetProgress(int bookId)
    {
        var p = await _db.ReadingProgresses
            .Include(x => x.Book)
            .FirstOrDefaultAsync(x => x.UserId == CurrentUserId && x.BookId == bookId);
        if (p == null) return NotFound();
        return Ok(Map(p));
    }

    /// <summary>Сохранить или обновить прогресс чтения (upsert)</summary>
    [HttpPut("ReadingProgress_Upsert")]
    public async Task<ActionResult<ProgressResponse>> Upsert([FromBody] UpsertProgressRequest req)
    {
        var p = await _db.ReadingProgresses
            .Include(x => x.Book)
            .FirstOrDefaultAsync(x => x.UserId == CurrentUserId && x.BookId == req.BookId);

        if (p == null)
        {
            p = new ReadingProgress { UserId = CurrentUserId, BookId = req.BookId };
            _db.ReadingProgresses.Add(p);
        }

        if (req.LastPage.HasValue) p.LastPage = req.LastPage;
        if (req.TimecodeSeconds.HasValue) p.TimecodeSeconds = req.TimecodeSeconds;
        p.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        if (p.Book == null) await _db.Entry(p).Reference(x => x.Book).LoadAsync();
        return Ok(Map(p));
    }

    private static ProgressResponse Map(ReadingProgress p) =>
        new(p.ProgressId, p.BookId, p.Book.Title, p.LastPage, p.TimecodeSeconds, p.UpdatedAt);
}
