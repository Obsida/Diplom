using System.Security.Claims;
using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/subscription-plans")]
public class SubscriptionPlansController : ControllerBase
{
    private readonly AppDbContext _db;
    public SubscriptionPlansController(AppDbContext db) => _db = db;

    /// <summary>Получить все тарифные планы подписок</summary>
    [HttpGet("SubscriptionPlans_GetAll")]
    public async Task<ActionResult<List<PlanResponse>>> GetAll()
    {
        var plans = await _db.SubscriptionPlans.Where(p => p.IsActive).ToListAsync();
        return Ok(plans.Select(Map));
    }

    /// <summary>Тарифный план по ID</summary>
    [HttpGet("{id}/SubscriptionPlans_GetById")]
    public async Task<ActionResult<PlanResponse>> GetById(int id)
    {
        var plan = await _db.SubscriptionPlans.FindAsync(id);
        if (plan == null) return NotFound();
        return Ok(Map(plan));
    }

    /// <summary>Добавить тарифный план [admin, meneger]</summary>
    [HttpPost("SubscriptionPlans_Create")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<PlanResponse>> Create([FromBody] CreatePlanRequest req)
    {
        var plan = new SubscriptionPlan
        {
            Name = req.Name,
            DurationDays = req.DurationDays,
            BasePrice = req.BasePrice,
            Description = req.Description,
            MaxUsers = req.MaxUsers ?? 1
        };
        _db.SubscriptionPlans.Add(plan);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = plan.PlanId }, Map(plan));
    }

    /// <summary>Редактировать тарифный план [admin, meneger]</summary>
    [HttpPut("{id}/SubscriptionPlans_Update")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<PlanResponse>> Update(int id, [FromBody] UpdatePlanRequest req)
    {
        var plan = await _db.SubscriptionPlans.FindAsync(id);
        if (plan == null) return NotFound();

        if (req.Name         != null) plan.Name         = req.Name;
        if (req.DurationDays != null) plan.DurationDays = req.DurationDays.Value;
        if (req.BasePrice    != null) plan.BasePrice    = req.BasePrice.Value;
        if (req.Description  != null) plan.Description  = req.Description;
        if (req.IsActive     != null) plan.IsActive     = req.IsActive.Value;
        if (req.MaxUsers     != null) plan.MaxUsers     = req.MaxUsers.Value;

        await _db.SaveChangesAsync();
        return Ok(Map(plan));
    }

    /// <summary>Деактивировать тарифный план [admin, meneger]</summary>
    [HttpDelete("{id}/SubscriptionPlans_Deactivate")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<IActionResult> Delete(int id)
    {
        var plan = await _db.SubscriptionPlans.FindAsync(id);
        if (plan == null) return NotFound();
        plan.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static PlanResponse Map(SubscriptionPlan p) =>
        new(p.PlanId, p.Name, p.DurationDays, p.BasePrice, p.Description, p.IsActive, p.MaxUsers);
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SubscriptionsController : ControllerBase
{
    private readonly AppDbContext _db;
    public SubscriptionsController(AppDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>История подписок текущего пользователя</summary>
    [HttpGet("Subscriptions_GetMy")]
    public async Task<ActionResult<List<SubscriptionResponse>>> GetMy()
    {
        var userId = CurrentUserId;
        var user = await _db.Users.FindAsync(userId);
        if (user?.SubscriptionOwnerId != null)
        {
            userId = user.SubscriptionOwnerId.Value;
        }

        var subs = await _db.Subscriptions
            .Include(s => s.Plan)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.StartDate)
            .ToListAsync();
        return Ok(subs.Select(Map));
    }

    /// <summary>Оформить подписку (месячную или годовую)</summary>
    [HttpPost("Subscriptions_Subscribe")]
    public async Task<ActionResult<SubscriptionResponse>> Subscribe([FromBody] CreateSubscriptionRequest req)
    {
        var plan = await _db.SubscriptionPlans.FindAsync(req.PlanId);
        if (plan == null || !plan.IsActive) return BadRequest("Тарифный план не найден или неактивен");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Проверяем наличие текущей активной подписки у пользователя
        var activeSub = await _db.Subscriptions
            .Include(s => s.Plan)
            .Where(s => s.UserId == CurrentUserId && s.EndDate >= today && s.Status == "success")
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (activeSub != null)
        {
            // Переход с обычной подписки на семейную
            if (activeSub.Plan.MaxUsers == 1 && plan.MaxUsers > 1)
            {
                activeSub.Status = "upgraded";
                activeSub.EndDate = today; // Прекращаем действие старой обычной подписки сегодняшним днем
            }
        }

        var startDate = today;
        var endDate = startDate.AddDays(plan.DurationDays);

        var subscription = new Subscription
        {
            UserId = CurrentUserId,
            PlanId = req.PlanId,
            StartDate = startDate,
            EndDate = endDate,
            PaidAmount = plan.BasePrice,
            PaymentMethod = req.PaymentMethod,
            Status = "success"
        };

        _db.Subscriptions.Add(subscription);

        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user != null)
        {
            // Если пользователь состоял в чужой семейной подписке, отвязываем его
            if (user.SubscriptionOwnerId.HasValue)
            {
                user.SubscriptionOwnerId = null;
            }

            user.SubscriptionStatus = "active";
            user.SubscriptionEndDate = endDate;
        }

        await _db.SaveChangesAsync();
        await _db.Entry(subscription).Reference(s => s.Plan).LoadAsync();
        return CreatedAtAction(nameof(GetMy), Map(subscription));
    }

    /// <summary>Отменить текущую активную подписку</summary>
    [HttpPatch("Subscriptions_CancelMyActive")]
    [HttpPost("Subscriptions_CancelMyActive")]
    [HttpDelete("Subscriptions_CancelMyActive")]
    public async Task<ActionResult<SubscriptionResponse>> CancelMyActive()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var subscription = await _db.Subscriptions
            .Include(s => s.Plan)
            .Where(s => s.UserId == CurrentUserId && s.EndDate >= today && s.Status.ToLower() == "success")
            .OrderByDescending(s => s.EndDate)
            .FirstOrDefaultAsync();

        if (subscription == null) return NotFound("Активная подписка не найдена");

        subscription.Status = "cancelled";
        subscription.EndDate = today;

        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user != null)
        {
            user.SubscriptionStatus = "none";
            user.SubscriptionEndDate = null;
        }

        var members = await _db.Users.Where(u => u.SubscriptionOwnerId == CurrentUserId).ToListAsync();
        foreach (var member in members)
        {
            member.SubscriptionOwnerId = null;
            member.SubscriptionStatus = "none";
            member.SubscriptionEndDate = null;
        }

        await _db.SaveChangesAsync();
        return Ok(Map(subscription));
    }

    /// <summary>Все подписки всех пользователей [admin, meneger]</summary>
    [HttpGet("Subscriptions_GetAll")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<List<SubscriptionResponse>>> GetAll()
    {
        var subs = await _db.Subscriptions
            .Include(s => s.Plan)
            .OrderByDescending(s => s.StartDate)
            .ToListAsync();
        return Ok(subs.Select(Map));
    }

    public record FamilyMemberResponse(int UserId, string Email, string FirstName, string LastName);
    public record AddFamilyMemberRequest(string Email);

    /// <summary>Получить список участников семейной подписки</summary>
    [HttpGet("family-members")]
    public async Task<ActionResult<List<FamilyMemberResponse>>> GetFamilyMembers()
    {
        var members = await _db.Users
            .Where(u => u.SubscriptionOwnerId == CurrentUserId)
            .Select(u => new FamilyMemberResponse(u.UserId, u.Email, u.FirstName, u.LastName))
            .ToListAsync();
        return Ok(members);
    }

    /// <summary>Добавить участника в семейную подписку</summary>
    [HttpPost("family-members")]
    public async Task<ActionResult<FamilyMemberResponse>> AddFamilyMember([FromBody] AddFamilyMemberRequest req)
    {
        var owner = await _db.Users.FindAsync(CurrentUserId);
        if (owner == null) return NotFound("Владелец подписки не найден");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var activeSub = await _db.Subscriptions
            .Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.UserId == CurrentUserId && s.EndDate >= today && s.Status == "success");

        if (activeSub == null || activeSub.Plan.MaxUsers <= 1)
        {
            return BadRequest("У вас нет активного семейного тарифа подписки");
        }

        var currentMemberCount = await _db.Users.CountAsync(u => u.SubscriptionOwnerId == CurrentUserId);
        if (currentMemberCount >= activeSub.Plan.MaxUsers - 1)
        {
            return BadRequest($"Превышен лимит семейной подписки. Максимум участников: {activeSub.Plan.MaxUsers} (включая вас)");
        }

        var member = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower());
        if (member == null)
        {
            return NotFound("Пользователь с такой почтой не зарегистрирован на сайте");
        }

        if (member.UserId == CurrentUserId)
        {
            return BadRequest("Нельзя добавить самого себя в семейную подписку");
        }

        if (member.SubscriptionOwnerId.HasValue)
        {
            return BadRequest("Этот пользователь уже состоит в другой семейной подписке");
        }

        if (member.SubscriptionStatus == "active")
        {
            return BadRequest("У этого пользователя уже есть собственная активная подписка");
        }

        member.SubscriptionOwnerId = CurrentUserId;
        member.SubscriptionStatus = "active";
        member.SubscriptionEndDate = activeSub.EndDate;

        await _db.SaveChangesAsync();

        return Ok(new FamilyMemberResponse(member.UserId, member.Email, member.FirstName, member.LastName));
    }

    /// <summary>Удалить участника из семейной подписки</summary>
    [HttpDelete("family-members/{userId}")]
    public async Task<IActionResult> RemoveFamilyMember(int userId)
    {
        var member = await _db.Users.FindAsync(userId);
        if (member == null) return NotFound("Участник не найден");

        if (member.SubscriptionOwnerId != CurrentUserId)
        {
            return Forbid();
        }

        member.SubscriptionOwnerId = null;
        member.SubscriptionStatus = "none";
        member.SubscriptionEndDate = null;

        await _db.SaveChangesAsync();

        return NoContent();
    }

    private static SubscriptionResponse Map(Subscription s) => new(
        s.SubscriptionId, s.UserId, s.Plan.Name,
        s.StartDate, s.EndDate, s.PaidAmount, s.PaymentMethod, s.Status,
        s.Plan.MaxUsers
    );
}
