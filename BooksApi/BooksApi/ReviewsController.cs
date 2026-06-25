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
public class ReviewsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ReviewsController(AppDbContext db) => _db = db;

    private int? CurrentUserId => User.Identity?.IsAuthenticated == true
        ? int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!)
        : null;

    private async Task<bool> HasActiveSubscription(int userId)
    {
        var todayUtc = DateOnly.FromDateTime(DateTime.UtcNow);

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return false;

        var targetUserId = user.SubscriptionOwnerId ?? userId;

        return await _db.Subscriptions.AnyAsync(s =>
            s.UserId == targetUserId &&
            s.EndDate >= todayUtc &&
            s.Status != null &&
            s.Status.ToLower() == "success"
        );
    }

    /// <summary>Все активные отзывы на книгу</summary>
    [HttpGet("book/{bookId}/Reviews_GetByBook")]
    public async Task<ActionResult<List<ReviewResponse>>> GetByBook(int bookId)
    {
        var reviews = await _db.Reviews
            .Include(r => r.User)
            .Where(r => r.BookId == bookId && r.IsActive)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();
        return Ok(reviews.Select(Map));
    }

    /// <summary>Все отзывы включая скрытые [meneger/admin]</summary>
    [HttpGet("Reviews_GetAll")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<List<ReviewResponse>>> GetAll([FromQuery] bool? isActive)
    {
        var query = _db.Reviews.Include(r => r.User).Include(r => r.Book).AsQueryable();
        if (isActive.HasValue) query = query.Where(r => r.IsActive == isActive.Value);
        var reviews = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();
        return Ok(reviews.Select(Map));
    }

    /// <summary>Оставить оценку и рецензию на книгу [Client]</summary>
    [HttpPost("Reviews_Create")]
    [Authorize]
    public async Task<ActionResult<ReviewResponse>> Create([FromBody] CreateReviewRequest req)
    {
        var userId = CurrentUserId!.Value;

        if (!await HasActiveSubscription(userId))
            return BadRequest("Оставлять отзывы можно только при активной подписке.");

        var exists = await _db.Reviews.AnyAsync(r => r.UserId == userId && r.BookId == req.BookId);
        if (exists) return Conflict("Вы уже оставляли отзыв на эту книгу");

        var review = new Review
        {
            UserId = userId,
            BookId = req.BookId,
            Rating = req.Rating,
            ReviewText = req.ReviewText
        };
        _db.Reviews.Add(review);
        await _db.SaveChangesAsync();
        await RecalcBookRating(req.BookId);
        await _db.Entry(review).Reference(r => r.User).LoadAsync();
        return CreatedAtAction(nameof(GetByBook), new { bookId = req.BookId }, Map(review));
    }

    /// <summary>Редактировать свой отзыв [Client]</summary>
    [HttpPut("{id}/Reviews_Update")]
    [Authorize]
    public async Task<ActionResult<ReviewResponse>> Update(int id, [FromBody] UpdateReviewRequest req)
    {
        var userId = CurrentUserId!.Value;

        var review = await _db.Reviews.Include(r => r.User)
            .FirstOrDefaultAsync(r => r.ReviewId == id && r.UserId == userId);
        if (review == null) return NotFound();

        if (req.Rating     != null) review.Rating     = req.Rating.Value;
        if (req.ReviewText != null) review.ReviewText = req.ReviewText;

        await _db.SaveChangesAsync();
        await RecalcBookRating(review.BookId);
        return Ok(Map(review));
    }

    /// <summary>Удалить свой отзыв [Client]</summary>
    [HttpDelete("{id}/Reviews_Delete")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = CurrentUserId!.Value;

        var review = await _db.Reviews.FirstOrDefaultAsync(r => r.ReviewId == id && r.UserId == userId);
        if (review == null) return NotFound();
        _db.Reviews.Remove(review);
        await _db.SaveChangesAsync();
        await RecalcBookRating(review.BookId);
        return NoContent();
    }

    /// <summary>Показать или скрыть отзыв [meneger/admin]</summary>
    [HttpPatch("{id}/moderation/Reviews_Moderate")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<ReviewResponse>> Moderate(int id, [FromBody] ModerationReviewRequest req)
    {
        var review = await _db.Reviews.Include(r => r.User).Include(r => r.Book).FirstOrDefaultAsync(r => r.ReviewId == id);
        if (review == null) return NotFound();

        review.IsActive = req.IsActive;
        AddModerationLog("review", id, req.IsActive ? "show" : "hide", req.Reason);
        await _db.SaveChangesAsync();
        await RecalcBookRating(review.BookId);
        return Ok(Map(review));
    }

    /// <summary>Скрыть отзыв [meneger/admin]</summary>
    [HttpPatch("{id}/Reviews_Hide")]
    [HttpPost("{id}/Reviews_Hide")]
    [HttpPut("{id}/Reviews_Hide")]
    [HttpPatch("{id}/hide")]
    [HttpPost("{id}/hide")]
    [HttpPut("{id}/hide")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<ReviewResponse>> Hide(int id, [FromBody] ModerationActionRequest req)
    {
        var review = await _db.Reviews.Include(r => r.User).Include(r => r.Book).FirstOrDefaultAsync(r => r.ReviewId == id);
        if (review == null) return NotFound();

        review.IsActive = false;
        AddModerationLog("review", id, "hide", req.Reason);
        await _db.SaveChangesAsync();
        await RecalcBookRating(review.BookId);
        return Ok(Map(review));
    }

    /// <summary>Пометить отзыв как нарушение [meneger/admin]</summary>
    [HttpPatch("{id}/Reviews_MarkViolation")]
    [HttpPost("{id}/Reviews_MarkViolation")]
    [HttpPut("{id}/Reviews_MarkViolation")]
    [HttpPatch("{id}/violation")]
    [HttpPost("{id}/violation")]
    [HttpPut("{id}/violation")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<ReviewResponse>> MarkViolation(int id, [FromBody] MarkViolationRequest req)
    {
        var review = await _db.Reviews.Include(r => r.User).Include(r => r.Book).FirstOrDefaultAsync(r => r.ReviewId == id);
        if (review == null) return NotFound();

        review.HasViolation = req.HasViolation ?? true;
        review.ViolationReason = req.Reason;
        AddModerationLog("review", id, review.HasViolation ? "violation" : "violation_removed", req.Reason);
        await _db.SaveChangesAsync();
        return Ok(Map(review));
    }

    /// <summary>Удалить любой отзыв [meneger/admin]</summary>
    [HttpDelete("{id}/moderation/Reviews_Delete")]
    [HttpDelete("{id}/Reviews_DeleteByModerator")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<IActionResult> DeleteByModerator(int id, [FromBody] ModerationActionRequest? req = null)
    {
        var review = await _db.Reviews.FirstOrDefaultAsync(r => r.ReviewId == id);
        if (review == null) return NotFound();

        var bookId = review.BookId;
        _db.Reviews.Remove(review);
        AddModerationLog("review", id, "delete", req?.Reason);
        await _db.SaveChangesAsync();
        await RecalcBookRating(bookId);
        return NoContent();
    }

    private async Task RecalcBookRating(int bookId)
    {
        var avg = await _db.Reviews
            .Where(r => r.BookId == bookId && r.IsActive)
            .AverageAsync(r => (double?)r.Rating) ?? 0;

        var book = await _db.Books.FindAsync(bookId);
        if (book != null)
        {
            book.Rating = Math.Round((decimal)avg, 2);
            await _db.SaveChangesAsync();
        }
    }

    private void AddModerationLog(string targetType, int targetId, string action, string? reason)
    {
        _db.ModerationLogs.Add(new ModerationLog
        {
            ModeratorUserId = CurrentUserId!.Value,
            TargetType = targetType,
            TargetId = targetId,
            Action = action,
            Reason = reason
        });
    }

    private static ReviewResponse Map(Review r) => new(
        r.ReviewId, r.UserId,
        $"{r.User.FirstName} {r.User.LastName}",
        r.BookId, r.Rating, r.ReviewText, r.CreatedAt, r.IsActive,
        r.HasViolation, r.ViolationReason, r.Book?.Title
    );
}
