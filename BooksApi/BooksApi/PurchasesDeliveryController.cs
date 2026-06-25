using System.Security.Claims;
using BooksApi;
using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

// ═══════════════════════════════════════════════
// Покупки цифрового контента
// ═══════════════════════════════════════════════
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PurchasesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmailService _emailService;
    private readonly ILogger<PurchasesController> _logger;

    public PurchasesController(AppDbContext db, IEmailService emailService, ILogger<PurchasesController> logger)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>История покупок текущего пользователя</summary>
    [HttpGet("Purchases_GetMy")]
    public async Task<ActionResult<List<PurchaseResponse>>> GetMy()
    {
        var purchases = await _db.Purchases
            .Include(p => p.Book)
            .Where(p => p.UserId == CurrentUserId)
            .OrderByDescending(p => p.PurchaseDate)
            .ToListAsync();
        return Ok(purchases.Select(Map));
    }

    // Добавь в конструктор контроллера:
    // private readonly IEmailService _emailService;

    [HttpPost("Purchases_Buy")]
    public async Task<ActionResult<PurchaseResponse>> Buy([FromBody] CreatePurchaseRequest req)
    {
        var book = await _db.Books
            .Include(b => b.Author)
            .FirstOrDefaultAsync(b => b.BookId == req.BookId);

        if (book == null || !book.IsActive) return NotFound("Книга не найдена");

        var alreadyOwned = await _db.UserLibrary.AnyAsync(l =>
            l.UserId == CurrentUserId && l.BookId == req.BookId && l.AcquisitionType == "purchase");
        if (alreadyOwned) return Conflict("Книга уже куплена");

        var purchase = new Purchase
        {
            UserId = CurrentUserId,
            BookId = req.BookId,
            Amount = book.Price,
            PaymentMethod = req.PaymentMethod,
            Status = "success"
        };
        _db.Purchases.Add(purchase);

        var inLibrary = await _db.UserLibrary.AnyAsync(l => l.UserId == CurrentUserId && l.BookId == req.BookId);
        if (!inLibrary)
        {
            _db.UserLibrary.Add(new UserLibrary
            {
                UserId = CurrentUserId,
                BookId = req.BookId,
                AcquisitionType = "purchase"
            });
        }

        await _db.SaveChangesAsync();

        // Загружаем пользователя для email
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user != null)
        {
            var receipt = new ReceiptData
            {
                PurchaseId = purchase.PurchaseId,
                BookTitle = book.Title,
                Author = book.Author.FullName,
                Amount = purchase.Amount,
                PaymentMethod = purchase.PaymentMethod,
                PurchaseDate = purchase.PurchaseDate
            };

            // Отправляем в фоне — не блокируем ответ
            _ = _emailService.SendPurchaseReceiptAsync(user.Email, user.FirstName, receipt)
                .ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        _logger.LogError(t.Exception, "Ошибка отправки чека для purchase {Id}", purchase.PurchaseId);
                });
        }

        await _db.Entry(purchase).Reference(p => p.Book).LoadAsync();
        return CreatedAtAction(nameof(GetMy), Map(purchase));
    }

    /// <summary>Все покупки всех пользователей [admin, meneger]</summary>
    [HttpGet("Purchases_GetAll")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<List<PurchaseResponse>>> GetAll()
    {
        var purchases = await _db.Purchases
            .Include(p => p.Book)
            .OrderByDescending(p => p.PurchaseDate)
            .ToListAsync();
        return Ok(purchases.Select(Map));
    }

    private static PurchaseResponse Map(Purchase p) => new(
        p.PurchaseId, p.BookId, p.Book.Title,
        p.Amount, p.PaymentMethod, p.PurchaseDate, p.Status
    );
}

// ═══════════════════════════════════════════════
// Заказы на доставку
// ═══════════════════════════════════════════════
[ApiController]
[Route("api/delivery-orders")]
[Authorize]
public class DeliveryOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEmailService _emailService;
    private readonly ILogger<DeliveryOrdersController> _logger;

    public DeliveryOrdersController(
        AppDbContext db,
        IEmailService emailService,
        ILogger<DeliveryOrdersController> logger)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Мои заказы на доставку печатных книг</summary>
    [HttpGet("DeliveryOrders_GetMy")]
    public async Task<ActionResult<List<DeliveryOrderResponse>>> GetMy()
    {
        var orders = await _db.DeliveryOrders
            .Include(o => o.Book)
            .Where(o => o.UserId == CurrentUserId)
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync();
        return Ok(orders.Select(Map));
    }

    /// <summary>Отследить заказ по трек-номеру</summary>
    [HttpGet("track/{trackingNumber}/DeliveryOrders_Track")]
    public async Task<ActionResult<DeliveryOrderResponse>> TrackOrder(string trackingNumber)
    {
        var order = await _db.DeliveryOrders
            .Include(o => o.Book)
            .FirstOrDefaultAsync(o => o.TrackingNumber == trackingNumber && o.UserId == CurrentUserId);
        if (order == null) return NotFound("Заказ не найден");
        return Ok(Map(order));
    }

    /// <summary>Заказать копию книги</summary>
    [HttpPost("DeliveryOrders_Create")]
    public async Task<ActionResult<DeliveryOrderResponse>> Create([FromBody] CreateDeliveryOrderRequest req)
    {
        var book = await _db.Books
            .Include(b => b.Author)
            .FirstOrDefaultAsync(b => b.BookId == req.BookId);

        if (book == null || !book.IsActive) return NotFound("Книга не найдена");

        bool isElectronic = req.DeliveryAddress == "Электронная версия";

        if (!isElectronic)
        {
            if (book.StockQuantity <= 0) return BadRequest("Нет в наличии");
            book.StockQuantity--;
        }

        var order = new DeliveryOrder
        {
            UserId = CurrentUserId,
            BookId = req.BookId,
            DeliveryAddress = req.DeliveryAddress,
            TotalAmount = book.Price,
            PaymentMethod = req.PaymentMethod,
            Status = isElectronic ? "delivered" : "created"
        };
        _db.DeliveryOrders.Add(order);

        if (isElectronic)
        {
            var alreadyOwned = await _db.UserLibrary.AnyAsync(l =>
                l.UserId == CurrentUserId && l.BookId == req.BookId && l.AcquisitionType == "purchase");
            if (!alreadyOwned)
            {
                var inLibrary = await _db.UserLibrary.FirstOrDefaultAsync(l => l.UserId == CurrentUserId && l.BookId == req.BookId);
                if (inLibrary != null)
                {
                    inLibrary.AcquisitionType = "purchase";
                }
                else
                {
                    _db.UserLibrary.Add(new UserLibrary
                    {
                        UserId = CurrentUserId,
                        BookId = req.BookId,
                        AcquisitionType = "purchase"
                    });
                }
            }
        }

        await _db.SaveChangesAsync();
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user != null)
        {
            var receipt = new DeliveryReceiptData
            {
                OrderId = order.OrderId,
                BookTitle = book.Title,
                Author = book.Author.FullName,
                Amount = order.TotalAmount,
                PaymentMethod = order.PaymentMethod,
                DeliveryAddress = order.DeliveryAddress,
                OrderDate = order.OrderDate,
                TrackingNumber = order.TrackingNumber
            };

            _ = _emailService.SendDeliveryReceiptAsync(user.Email, user.FirstName, receipt)
                .ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        _logger.LogError(t.Exception, "Ошибка отправки чека доставки для order {Id}", order.OrderId);
                });
        }

        await _db.Entry(order).Reference(o => o.Book).LoadAsync();
        return CreatedAtAction(nameof(GetMy), Map(order));
    }

    /// <summary>Все заказы всех пользователей [admin, meneger]</summary>
    [HttpGet("DeliveryOrders_GetAll")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<List<DeliveryOrderResponse>>> GetAll([FromQuery] string? status)
    {
        var query = _db.DeliveryOrders.Include(o => o.Book).Where(o => o.DeliveryAddress != "Электронная версия").AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(o => o.Status == status);
        var orders = await query.OrderByDescending(o => o.OrderDate).ToListAsync();
        return Ok(orders.Select(Map));
    }

    /// <summary>Обновить статус заказа и добавить трек-номер [admin, meneger]</summary>
    [HttpPatch("{id}/DeliveryOrders_UpdateStatus")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<DeliveryOrderResponse>> UpdateStatus(int id, [FromBody] UpdateDeliveryOrderRequest req)
    {
        var order = await _db.DeliveryOrders.Include(o => o.Book).FirstOrDefaultAsync(o => o.OrderId == id);
        if (order == null) return NotFound();

        var validStatuses = new[] { "created", "shipped", "delivered", "cancelled" };
        if (req.Status != null)
        {
            if (!validStatuses.Contains(req.Status))
                return BadRequest($"Допустимые статусы: {string.Join(", ", validStatuses)}");

            if (req.Status == "cancelled" && order.Status != "cancelled")
            {
                var book = await _db.Books.FindAsync(order.BookId);
                if (book != null) book.StockQuantity++;
            }

            order.Status = req.Status;
        }

        if (req.TrackingNumber != null) order.TrackingNumber = req.TrackingNumber;

        await _db.SaveChangesAsync();
        return Ok(Map(order));
    }

    private static DeliveryOrderResponse Map(DeliveryOrder o) => new(
        o.OrderId, o.BookId, o.Book.Title,
        o.DeliveryAddress, o.TotalAmount, o.OrderDate,
        o.Status, o.TrackingNumber, o.PaymentMethod
    );
}