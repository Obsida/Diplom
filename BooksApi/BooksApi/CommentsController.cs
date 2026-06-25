using System.Security.Claims;
using BookStoreApi.Data;
using BookStoreApi.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CommentsController : ControllerBase
{
    private readonly AppDbContext _db;
    public CommentsController(AppDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Все активные комментарии к книге</summary>
    [HttpGet("book/{bookId}/Comments_GetByBook")]
    public async Task<ActionResult<List<CommentResponse>>> GetByBook(int bookId)
    {
        var comments = await _db.Comments
            .Include(c => c.User)
            .Include(c => c.Book)
            .Where(c => c.BookId == bookId && c.IsActive)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return Ok(comments.Select(Map));
    }

    /// <summary>Все комментарии, включая скрытые [moderator/admin]</summary>
    [HttpGet("Comments_GetAll")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<List<CommentResponse>>> GetAll([FromQuery] bool? isActive)
    {
        var query = _db.Comments.Include(c => c.User).Include(c => c.Book).AsQueryable();
        if (isActive.HasValue) query = query.Where(c => c.IsActive == isActive.Value);

        var comments = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
        return Ok(comments.Select(Map));
    }

    /// <summary>Добавить комментарий к книге [authorized]</summary>
    [HttpPost("Comments_Create")]
    [Authorize]
    public async Task<ActionResult<CommentResponse>> Create([FromBody] CreateCommentRequest req)
    {
        var bookExists = await _db.Books.AnyAsync(b => b.BookId == req.BookId && b.IsActive);
        if (!bookExists) return NotFound("Книга не найдена");

        if (string.IsNullOrWhiteSpace(req.CommentText))
            return BadRequest("Текст комментария не может быть пустым");

        var comment = new BookStoreApi.Models.Comment
        {
            UserId = CurrentUserId,
            BookId = req.BookId,
            CommentText = req.CommentText.Trim()
        };

        _db.Comments.Add(comment);
        await _db.SaveChangesAsync();
        await _db.Entry(comment).Reference(c => c.User).LoadAsync();
        await _db.Entry(comment).Reference(c => c.Book).LoadAsync();

        return CreatedAtAction(nameof(GetByBook), new { bookId = req.BookId }, Map(comment));
    }

    /// <summary>Редактировать свой комментарий [authorized]</summary>
    [HttpPut("{id}/Comments_Update")]
    [Authorize]
    public async Task<ActionResult<CommentResponse>> Update(int id, [FromBody] UpdateCommentRequest req)
    {
        var comment = await _db.Comments
            .Include(c => c.User)
            .Include(c => c.Book)
            .FirstOrDefaultAsync(c => c.CommentId == id && c.UserId == CurrentUserId);
        if (comment == null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.CommentText))
            return BadRequest("Текст комментария не может быть пустым");

        comment.CommentText = req.CommentText.Trim();
        await _db.SaveChangesAsync();
        return Ok(Map(comment));
    }

    /// <summary>Удалить свой комментарий [authorized]</summary>
    [HttpDelete("{id}/Comments_Delete")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.CommentId == id && c.UserId == CurrentUserId);
        if (comment == null) return NotFound();

        _db.Comments.Remove(comment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static CommentResponse Map(BookStoreApi.Models.Comment c) => new(
        c.CommentId, c.UserId,
        $"{c.User.FirstName} {c.User.LastName}",
        c.BookId, c.CommentText, c.CreatedAt, c.IsActive,
        c.HasViolation, c.ViolationReason, c.Book?.Title
    );
}
