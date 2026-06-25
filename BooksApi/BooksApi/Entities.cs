using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BookStoreApi.Models;

[Table("roles")]
public class Role
{
    [Column("role_id")] public int RoleId { get; set; }
    [Column("name")] public string Name { get; set; } = null!;
    [Column("is_active")] public bool IsActive { get; set; } = true;

    public ICollection<User> Users { get; set; } = new List<User>();
}

[Table("users")]
public class User
{
    [Column("user_id")] public int UserId { get; set; }
    [Column("email")] public string Email { get; set; } = null!;
    [Column("password_hash")] public string PasswordHash { get; set; } = null!;
    [Column("first_name")] public string FirstName { get; set; } = null!;
    [Column("last_name")] public string LastName { get; set; } = null!;
    [Column("middle_name")] public string? MiddleName { get; set; }
    [Column("phone")] public string? Phone { get; set; }
    [Column("adress")] public string? Address { get; set; }
    [Column("role_id")] public int RoleId { get; set; }
    [Column("subscription_status")] public string SubscriptionStatus { get; set; } = "none";
    [Column("subscription_end_date")] public DateOnly? SubscriptionEndDate { get; set; }
    [Column("subscription_owner_id")] public int? SubscriptionOwnerId { get; set; }
    [Column("password_reset_code")] public string? PasswordResetCode { get; set; }
    [Column("password_reset_expiry")] public DateTime? PasswordResetExpiry { get; set; }

    public Role Role { get; set; } = null!;
    public User? SubscriptionOwner { get; set; }
    public ICollection<User> FamilyMembers { get; set; } = new List<User>();
    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
    public ICollection<UserLibrary> Library { get; set; } = new List<UserLibrary>();
    public ICollection<Bookmark> Bookmarks { get; set; } = new List<Bookmark>();
    public ICollection<ReadingProgress> ReadingProgresses { get; set; } = new List<ReadingProgress>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<ModerationLog> ModerationLogs { get; set; } = new List<ModerationLog>();
    public ICollection<Purchase> Purchases { get; set; } = new List<Purchase>();
    public ICollection<DeliveryOrder> DeliveryOrders { get; set; } = new List<DeliveryOrder>();
}

[Table("categories")]
public class Category
{
    [Column("category_id")] public int CategoryId { get; set; }
    [Column("name")] public string Name { get; set; } = null!;
    [Column("description")] public string? Description { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;

    public ICollection<Subcategory> Subcategories { get; set; } = new List<Subcategory>();
    public ICollection<Book> Books { get; set; } = new List<Book>();
}

[Table("subcategories")]
public class Subcategory
{
    [Column("subcategory_id")] public int SubcategoryId { get; set; }
    [Column("category_id")] public int CategoryId { get; set; }
    [Column("name")] public string Name { get; set; } = null!;
    [Column("description")] public string? Description { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;

    public Category Category { get; set; } = null!;
    public ICollection<Book> Books { get; set; } = new List<Book>();
}

[Table("authors")]
public class Author
{
    [Column("author_id")] public int AuthorId { get; set; }
    [Column("full_name")] public string FullName { get; set; } = null!;
    [Column("biography")] public string? Biography { get; set; }
    [Column("birth_year")] public DateOnly? BirthYear { get; set; }
    [Column("death_year")] public DateOnly? DeathYear { get; set; }

    public ICollection<Book> Books { get; set; } = new List<Book>();
}

[Table("books")]
public class Book
{
    [Column("book_id")] public int BookId { get; set; }
    [Column("title")] public string Title { get; set; } = null!;
    [Column("author_id")] public int AuthorId { get; set; }
    [Column("category_id")] public int CategoryId { get; set; }
    [Column("subcategory_id")] public int SubcategoryId { get; set; }
    [Column("publication_year")] public int PublicationYear { get; set; }
    [Column("publisher")] public string? Publisher { get; set; }
    [Column("synopsis")] public string? Synopsis { get; set; }
    [Column("price")] public decimal Price { get; set; }
    [Column("rating")] public decimal Rating { get; set; } = 0;
    [Column("cover_image")] public byte[]? CoverImage { get; set; }
    [Column("content_pdf")] public byte[]? ContentPdf { get; set; }
    [Column("content_audio")] public byte[]? ContentAudio { get; set; }
    [Column("stock_quantity")] public int StockQuantity { get; set; } = 0;
    [Column("is_active")] public bool IsActive { get; set; } = true;

    public Author Author { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public Subcategory Subcategory { get; set; } = null!;
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<UserLibrary> LibraryEntries { get; set; } = new List<UserLibrary>();
    public ICollection<Bookmark> Bookmarks { get; set; } = new List<Bookmark>();
    public ICollection<ReadingProgress> ReadingProgresses { get; set; } = new List<ReadingProgress>();
    public ICollection<Purchase> Purchases { get; set; } = new List<Purchase>();
    public ICollection<DeliveryOrder> DeliveryOrders { get; set; } = new List<DeliveryOrder>();
}

[Table("subscription_plans")]
public class SubscriptionPlan
{
    [Column("plan_id")] public int PlanId { get; set; }
    [Column("name")] public string Name { get; set; } = null!;
    [Column("duration_days")] public int DurationDays { get; set; }
    [Column("base_price")] public decimal BasePrice { get; set; }
    [Column("description")] public string? Description { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("max_users")] public int MaxUsers { get; set; } = 1;

    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}

[Table("subscriptions")]
public class Subscription
{
    [Column("subscription_id")] public int SubscriptionId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("plan_id")] public int PlanId { get; set; }
    [Column("start_date")] public DateOnly StartDate { get; set; }
    [Column("end_date")] public DateOnly EndDate { get; set; }
    [Column("paid_amount")] public decimal PaidAmount { get; set; }
    [Column("payment_method")] public string PaymentMethod { get; set; } = null!;
    [Column("status")] public string Status { get; set; } = null!;

    public User User { get; set; } = null!;
    public SubscriptionPlan Plan { get; set; } = null!;
}

[Table("user_library")]
public class UserLibrary
{
    [Column("library_id")] public int LibraryId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("book_id")] public int BookId { get; set; }
    [Column("added_date")] public DateTime AddedDate { get; set; } = DateTime.UtcNow;
    [Column("acquisition_type")] public string AcquisitionType { get; set; } = null!;

    public User User { get; set; } = null!;
    public Book Book { get; set; } = null!;
}

[Table("bookmark_types")]
public class BookmarkType
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("type_id")] public int TypeId { get; set; }
    [Column("name")] public string Name { get; set; } = null!;

    public ICollection<Bookmark> Bookmarks { get; set; } = new List<Bookmark>();
}

[Table("bookmarks")]
public class Bookmark
{
    [Column("bookmark_id")] public int BookmarkId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("book_id")] public int BookId { get; set; }
    [Column("type_id")] public int TypeId { get; set; }
    [Column("added_date")] public DateTime AddedDate { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Book Book { get; set; } = null!;
    public BookmarkType Type { get; set; } = null!;
}

[Table("reading_progress")]
public class ReadingProgress
{
    [Column("progress_id")] public int ProgressId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("book_id")] public int BookId { get; set; }
    /// <summary>Для читалки: индекс последней открытой главы (0-based), не номер страницы PDF.</summary>
    [Column("last_page")] public int? LastPage { get; set; }
    [Column("timecode_seconds")] public int? TimecodeSeconds { get; set; }
    [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Book Book { get; set; } = null!;
}

[Table("reviews")]
public class Review
{
    [Column("review_id")] public int ReviewId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("book_id")] public int BookId { get; set; }
    [Column("rating")] public int Rating { get; set; }
    [Column("review_text")] public string? ReviewText { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("has_violation")] public bool HasViolation { get; set; } = false;
    [Column("violation_reason")] public string? ViolationReason { get; set; }

    public User User { get; set; } = null!;
    public Book Book { get; set; } = null!;
}

[Table("comments")]
public class Comment
{
    [Column("comment_id")] public int CommentId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("book_id")] public int BookId { get; set; }
    [Column("comment_text")] public string CommentText { get; set; } = null!;
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("has_violation")] public bool HasViolation { get; set; } = false;
    [Column("violation_reason")] public string? ViolationReason { get; set; }

    public User User { get; set; } = null!;
    public Book Book { get; set; } = null!;
}

[Table("moderation_logs")]
public class ModerationLog
{
    [Column("moderation_log_id")] public int ModerationLogId { get; set; }
    [Column("moderator_user_id")] public int ModeratorUserId { get; set; }
    [Column("target_type")] public string TargetType { get; set; } = null!;
    [Column("target_id")] public int TargetId { get; set; }
    [Column("action")] public string Action { get; set; } = null!;
    [Column("reason")] public string? Reason { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Moderator { get; set; } = null!;
}

[Table("purchases")]
public class Purchase
{
    [Column("purchase_id")] public int PurchaseId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("book_id")] public int BookId { get; set; }
    [Column("amount")] public decimal Amount { get; set; }
    [Column("payment_method")] public string PaymentMethod { get; set; } = null!;
    [Column("purchase_date")] public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
    [Column("status")] public string Status { get; set; } = null!;

    public User User { get; set; } = null!;
    public Book Book { get; set; } = null!;
}

[Table("delivery_orders")]
public class DeliveryOrder
{
    [Column("order_id")] public int OrderId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("book_id")] public int BookId { get; set; }
    [Column("delivery_address")] public string DeliveryAddress { get; set; } = null!;
    [Column("total_amount")] public decimal TotalAmount { get; set; }
    [Column("order_date")] public DateTime OrderDate { get; set; } = DateTime.UtcNow;
    [Column("status")] public string Status { get; set; } = "created";
    [Column("tracking_number")] public string? TrackingNumber { get; set; }
    [Column("payment_method")] public string PaymentMethod { get; set; } = null!;

    public User User { get; set; } = null!;
    public Book Book { get; set; } = null!;
}
