namespace BookStoreApi.DTOs;

// ─── AUTH ───────────────────────────────────────
public record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone
);

public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, string Role, int UserId, string Email);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Code, string NewPassword);

// ─── USERS ──────────────────────────────────────
public record UpdateProfileRequest(
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone
);

public record ChangePasswordRequest(string OldPassword, string NewPassword);
public record AssignRoleRequest(int RoleId);
public record BlockUserRequest(bool IsActive);

public record UserResponse(
    int UserId,
    string Email,
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone,
    string RoleName,
    string SubscriptionStatus,
    DateOnly? SubscriptionEndDate,
    int? SubscriptionOwnerId,
    string? SubscriptionOwnerEmail
);

// ─── BOOKS ──────────────────────────────────────
public record BookFilterRequest(
    string? Search,
    int? CategoryId,
    int? SubcategoryId,
    int? AuthorId,
    decimal? MinPrice,
    decimal? MaxPrice,
    decimal? MinRating,
    int? PublicationYear,
    string? SortBy,      // price_asc, price_desc, rating, title
    int Page = 1,
    int PageSize = 20
);

public record CreateBookRequest(
    string Title,
    int AuthorId,
    int CategoryId,
    int SubcategoryId,
    int PublicationYear,
    string? Publisher,
    string? Synopsis,
    decimal Price,
    int StockQuantity
);

public record UpdateBookRequest(
    string? Title,
    int? AuthorId,
    int? CategoryId,
    int? SubcategoryId,
    int? PublicationYear,
    string? Publisher,
    string? Synopsis,
    decimal? Price,
    int? StockQuantity,
    bool? IsActive
);

public record BookResponse(
    int BookId,
    string Title,
    string AuthorName,
    string CategoryName,
    string SubcategoryName,
    int PublicationYear,
    string? Publisher,
    string? Synopsis,
    decimal Price,
    decimal Rating,
    int StockQuantity,
    bool IsActive,
    bool HasPdf,
    bool HasAudio,
    int AuthorId,
    int CategoryId,
    int SubcategoryId,
    bool HasCover
);

public record BookDetailResponse(
    int BookId,
    string Title,
    AuthorResponse Author,
    string CategoryName,
    string SubcategoryName,
    int PublicationYear,
    string? Publisher,
    string? Synopsis,
    decimal Price,
    decimal Rating,
    int StockQuantity,
    bool HasPdf,
    bool HasAudio,
    List<ReviewResponse> Reviews
);

// ─── AUTHORS ────────────────────────────────────
public record CreateAuthorRequest(
    string FullName,
    string? Biography,
    DateOnly? BirthYear,
    DateOnly? DeathYear
);

public record AuthorResponse(
    int AuthorId,
    string FullName,
    string? Biography,
    DateOnly? BirthYear,
    DateOnly? DeathYear
);

// ─── CATEGORIES ─────────────────────────────────
public record CreateCategoryRequest(string Name, string? Description);
public record UpdateCategoryRequest(string? Name, string? Description, bool? IsActive);

public record CategoryResponse(
    int CategoryId,
    string Name,
    string? Description,
    bool IsActive,
    List<SubcategoryResponse> Subcategories
);

// ─── SUBCATEGORIES ──────────────────────────────
public record CreateSubcategoryRequest(int CategoryId, string Name, string? Description);
public record UpdateSubcategoryRequest(string? Name, string? Description, bool? IsActive);
public record SubcategoryResponse(int SubcategoryId, int CategoryId, string Name, string? Description, bool IsActive);

// ─── SUBSCRIPTION PLANS ─────────────────────────
public record CreatePlanRequest(string Name, int DurationDays, decimal BasePrice, string? Description, int? MaxUsers);
public record UpdatePlanRequest(string? Name, int? DurationDays, decimal? BasePrice, string? Description, bool? IsActive, int? MaxUsers);
public record PlanResponse(int PlanId, string Name, int DurationDays, decimal BasePrice, string? Description, bool IsActive, int MaxUsers);

// ─── SUBSCRIPTIONS ──────────────────────────────
public record CreateSubscriptionRequest(int PlanId, string PaymentMethod);
public record SubscriptionResponse(
    int SubscriptionId,
    int UserId,
    string PlanName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal PaidAmount,
    string PaymentMethod,
    string Status,
    int MaxUsers
);

// ─── LIBRARY ────────────────────────────────────
public record LibraryItemResponse(
    int LibraryId,
    BookResponse Book,
    DateTime AddedDate,
    string AcquisitionType
);

// ─── BOOKMARKS ──────────────────────────────────
public record AddBookmarkRequest(int BookId, string BookmarkType);
public record BookmarkResponse(int BookmarkId, int BookId, string BookTitle, string BookmarkType, DateTime AddedDate);

// ─── READING PROGRESS ───────────────────────────
// LastPage: в читалке — индекс последней открытой главы (0-based); иначе прежний смысл поля.
public record UpsertProgressRequest(int BookId, int? LastPage, int? TimecodeSeconds);
public record ProgressResponse(int ProgressId, int BookId, string BookTitle, int? LastPage, int? TimecodeSeconds, DateTime UpdatedAt);

// ─── REVIEWS ────────────────────────────────────
public record CreateReviewRequest(int BookId, int Rating, string? ReviewText);
public record UpdateReviewRequest(int? Rating, string? ReviewText);
public record ReviewResponse(
    int ReviewId,
    int UserId,
    string UserName,
    int BookId,
    int Rating,
    string? ReviewText,
    DateTime CreatedAt,
    bool IsActive,
    bool HasViolation,
    string? ViolationReason,
    string? BookTitle = null
)
{
    public bool IsHidden => !IsActive;
}
public record ModerationReviewRequest(bool IsActive, string? Reason = null);
public record ModerationActionRequest(string? Reason);
public record MarkViolationRequest(bool? HasViolation, string? Reason);

// COMMENTS
public record CreateCommentRequest(int BookId, string CommentText);
public record UpdateCommentRequest(string CommentText);
public record CommentResponse(
    int CommentId,
    int UserId,
    string UserName,
    int BookId,
    string CommentText,
    DateTime CreatedAt,
    bool IsActive,
    bool HasViolation,
    string? ViolationReason,
    string? BookTitle = null
)
{
    public bool IsHidden => !IsActive;
}

// MODERATION
public record ModerationLogResponse(
    int Id,
    int ModeratorUserId,
    string ModeratorName,
    string TargetType,
    int TargetId,
    int? ReviewId,
    int? CommentId,
    string Action,
    string? Reason,
    DateTime CreatedAt
);

// ─── PURCHASES ──────────────────────────────────
public record CreatePurchaseRequest(int BookId, string PaymentMethod);
public record PurchaseResponse(
    int PurchaseId,
    int BookId,
    string BookTitle,
    decimal Amount,
    string PaymentMethod,
    DateTime PurchaseDate,
    string Status
);

// ─── DELIVERY ORDERS ────────────────────────────
public record CreateDeliveryOrderRequest(int BookId, string DeliveryAddress, string PaymentMethod);
public record UpdateDeliveryOrderRequest(string? Status, string? TrackingNumber);
public record DeliveryOrderResponse(
    int OrderId,
    int BookId,
    string BookTitle,
    string DeliveryAddress,
    decimal TotalAmount,
    DateTime OrderDate,
    string Status,
    string? TrackingNumber,
    string PaymentMethod
);

// ─── ROLES ──────────────────────────────────────
public record RoleResponse(int RoleId, string Name, bool IsActive);

// ─── PAGINATION ─────────────────────────────────
public record PagedResult<T>(List<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
