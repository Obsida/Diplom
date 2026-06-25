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
[Authorize(Roles = "admin,meneger")]
public class ModerationController : ControllerBase
{
    private readonly AppDbContext _db;
    public ModerationController(AppDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Все отзывы пользователей [moderator/admin]</summary>
    [HttpGet("reviews/Moderation_GetReviews")]
    [HttpGet("reviews")]
    public async Task<ActionResult<List<ReviewResponse>>> GetReviews([FromQuery] bool? isActive)
    {
        var query = _db.Reviews.Include(r => r.User).Include(r => r.Book).AsQueryable();
        if (isActive.HasValue) query = query.Where(r => r.IsActive == isActive.Value);

        var reviews = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();
        return Ok(reviews.Select(MapReview));
    }

    /// <summary>Все комментарии пользователей [moderator/admin]</summary>
    [HttpGet("comments/Moderation_GetComments")]
    [HttpGet("comments")]
    public async Task<ActionResult<List<CommentResponse>>> GetComments([FromQuery] bool? isActive)
    {
        var query = _db.Comments.Include(c => c.User).Include(c => c.Book).AsQueryable();
        if (isActive.HasValue) query = query.Where(c => c.IsActive == isActive.Value);

        var comments = await query.OrderByDescending(c => c.CreatedAt).ToListAsync();
        return Ok(comments.Select(MapComment));
    }

    /// <summary>Скрыть отзыв [moderator/admin]</summary>
    [HttpPatch("reviews/{id}/Moderation_HideReview")]
    [HttpPost("reviews/{id}/Moderation_HideReview")]
    [HttpPut("reviews/{id}/Moderation_HideReview")]
    [HttpPatch("reviews/{id}/hide")]
    [HttpPost("reviews/{id}/hide")]
    [HttpPut("reviews/{id}/hide")]
    public async Task<ActionResult<ReviewResponse>> HideReview(int id, [FromBody] ModerationActionRequest req)
    {
        var review = await _db.Reviews.Include(r => r.User).Include(r => r.Book).FirstOrDefaultAsync(r => r.ReviewId == id);
        if (review == null) return NotFound();

        review.IsActive = false;
        AddLog("review", id, "hide", req.Reason);
        await _db.SaveChangesAsync();
        await RecalcBookRating(review.BookId);
        return Ok(MapReview(review));
    }

    /// <summary>Пометить отзыв как нарушение [moderator/admin]</summary>
    [HttpPatch("reviews/{id}/Moderation_MarkViolation")]
    [HttpPost("reviews/{id}/Moderation_MarkViolation")]
    [HttpPut("reviews/{id}/Moderation_MarkViolation")]
    [HttpPatch("reviews/{id}/violation")]
    [HttpPost("reviews/{id}/violation")]
    [HttpPut("reviews/{id}/violation")]
    public async Task<ActionResult<ReviewResponse>> MarkReviewViolation(int id, [FromBody] MarkViolationRequest req)
    {
        var review = await _db.Reviews.Include(r => r.User).Include(r => r.Book).FirstOrDefaultAsync(r => r.ReviewId == id);
        if (review == null) return NotFound();

        review.HasViolation = req.HasViolation ?? true;
        review.ViolationReason = req.Reason;
        AddLog("review", id, review.HasViolation ? "violation" : "violation_removed", req.Reason);
        await _db.SaveChangesAsync();
        return Ok(MapReview(review));
    }

    /// <summary>Удалить отзыв [moderator/admin]</summary>
    [HttpDelete("reviews/{id}/Moderation_DeleteReview")]
    [HttpDelete("reviews/{id}/delete")]
    public async Task<IActionResult> DeleteReview(int id, [FromBody] ModerationActionRequest? req = null)
    {
        var review = await _db.Reviews.FirstOrDefaultAsync(r => r.ReviewId == id);
        if (review == null) return NotFound();

        var bookId = review.BookId;
        _db.Reviews.Remove(review);
        AddLog("review", id, "delete", req?.Reason);
        await _db.SaveChangesAsync();
        await RecalcBookRating(bookId);
        return NoContent();
    }

    /// <summary>Скрыть комментарий [moderator/admin]</summary>
    [HttpPatch("comments/{id}/Moderation_HideComment")]
    [HttpPost("comments/{id}/Moderation_HideComment")]
    [HttpPut("comments/{id}/Moderation_HideComment")]
    [HttpPatch("comments/{id}/hide")]
    [HttpPost("comments/{id}/hide")]
    [HttpPut("comments/{id}/hide")]
    public async Task<ActionResult<CommentResponse>> HideComment(int id, [FromBody] ModerationActionRequest req)
    {
        var comment = await _db.Comments.Include(c => c.User).Include(c => c.Book).FirstOrDefaultAsync(c => c.CommentId == id);
        if (comment == null) return NotFound();

        comment.IsActive = false;
        AddLog("comment", id, "hide", req.Reason);
        await _db.SaveChangesAsync();
        return Ok(MapComment(comment));
    }

    /// <summary>Пометить комментарий как нарушение [moderator/admin]</summary>
    [HttpPatch("comments/{id}/Moderation_MarkViolation")]
    [HttpPost("comments/{id}/Moderation_MarkViolation")]
    [HttpPut("comments/{id}/Moderation_MarkViolation")]
    [HttpPatch("comments/{id}/violation")]
    [HttpPost("comments/{id}/violation")]
    [HttpPut("comments/{id}/violation")]
    public async Task<ActionResult<CommentResponse>> MarkCommentViolation(int id, [FromBody] MarkViolationRequest req)
    {
        var comment = await _db.Comments.Include(c => c.User).Include(c => c.Book).FirstOrDefaultAsync(c => c.CommentId == id);
        if (comment == null) return NotFound();

        comment.HasViolation = req.HasViolation ?? true;
        comment.ViolationReason = req.Reason;
        AddLog("comment", id, comment.HasViolation ? "violation" : "violation_removed", req.Reason);
        await _db.SaveChangesAsync();
        return Ok(MapComment(comment));
    }

    /// <summary>Удалить комментарий [moderator/admin]</summary>
    [HttpDelete("comments/{id}/Moderation_DeleteComment")]
    [HttpDelete("comments/{id}/delete")]
    public async Task<IActionResult> DeleteComment(int id, [FromBody] ModerationActionRequest? req = null)
    {
        var comment = await _db.Comments.FirstOrDefaultAsync(c => c.CommentId == id);
        if (comment == null) return NotFound();

        _db.Comments.Remove(comment);
        AddLog("comment", id, "delete", req?.Reason);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>История действий текущего модератора [moderator/admin]</summary>
    [HttpGet("log/Moderation_GetMyLog")]
    [HttpGet("log")]
    public async Task<ActionResult<List<ModerationLogResponse>>> GetMyLog()
    {
        var logs = await _db.ModerationLogs
            .Include(l => l.Moderator)
            .Where(l => l.ModeratorUserId == CurrentUserId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return Ok(logs.Select(MapLog));
    }

    private void AddLog(string targetType, int targetId, string action, string? reason)
    {
        _db.ModerationLogs.Add(new ModerationLog
        {
            ModeratorUserId = CurrentUserId,
            TargetType = targetType,
            TargetId = targetId,
            Action = action,
            Reason = reason
        });
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

    private static ReviewResponse MapReview(Review r) => new(
        r.ReviewId, r.UserId,
        $"{r.User.FirstName} {r.User.LastName}",
        r.BookId, r.Rating, r.ReviewText, r.CreatedAt, r.IsActive,
        r.HasViolation, r.ViolationReason, r.Book?.Title
    );

    private static CommentResponse MapComment(Comment c) => new(
        c.CommentId, c.UserId,
        $"{c.User.FirstName} {c.User.LastName}",
        c.BookId, c.CommentText, c.CreatedAt, c.IsActive,
        c.HasViolation, c.ViolationReason, c.Book?.Title
    );

    private static ModerationLogResponse MapLog(ModerationLog l) => new(
        l.ModerationLogId,
        l.ModeratorUserId,
        $"{l.Moderator.FirstName} {l.Moderator.LastName}",
        l.TargetType,
        l.TargetId,
        l.TargetType == "review" ? l.TargetId : null,
        l.TargetType == "comment" ? l.TargetId : null,
        l.Action,
        l.Reason,
        l.CreatedAt
    );
}
