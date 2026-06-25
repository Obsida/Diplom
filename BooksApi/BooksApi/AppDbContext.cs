using Microsoft.EntityFrameworkCore;
using BookStoreApi.Models;

namespace BookStoreApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Subcategory> Subcategories => Set<Subcategory>();
    public DbSet<Author> Authors => Set<Author>();
    public DbSet<Book> Books => Set<Book>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<UserLibrary> UserLibrary => Set<UserLibrary>();
    public DbSet<BookmarkType> BookmarkTypes => Set<BookmarkType>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();
    public DbSet<ReadingProgress> ReadingProgresses => Set<ReadingProgress>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<ModerationLog> ModerationLogs => Set<ModerationLog>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<DeliveryOrder> DeliveryOrders => Set<DeliveryOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("books");
        base.OnModelCreating(modelBuilder);

        // Role
        modelBuilder.Entity<Role>(e =>
        {
            e.HasKey(x => x.RoleId);
            e.Property(x => x.RoleId).UseIdentityAlwaysColumn();
        });

        // User
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).UseIdentityAlwaysColumn();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.SubscriptionStatus)
                .HasDefaultValue("none")
                .HasConversion<string>();
            e.HasOne(x => x.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.SubscriptionOwner)
                .WithMany(u => u.FamilyMembers)
                .HasForeignKey(x => x.SubscriptionOwnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Category
        modelBuilder.Entity<Category>(e =>
        {
            e.HasKey(x => x.CategoryId);
            e.Property(x => x.CategoryId).UseIdentityAlwaysColumn();
        });

        // Subcategory
        modelBuilder.Entity<Subcategory>(e =>
        {
            e.HasKey(x => x.SubcategoryId);
            e.Property(x => x.SubcategoryId).UseIdentityAlwaysColumn();
            e.HasIndex(x => new { x.CategoryId, x.Name }).IsUnique();
            e.HasOne(x => x.Category)
                .WithMany(c => c.Subcategories)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Author
        modelBuilder.Entity<Author>(e =>
        {
            e.HasKey(x => x.AuthorId);
            e.Property(x => x.AuthorId).UseIdentityAlwaysColumn();
        });

        // Book
        modelBuilder.Entity<Book>(e =>
        {
            e.HasKey(x => x.BookId);
            e.Property(x => x.BookId).UseIdentityAlwaysColumn();
            e.Property(x => x.Rating).HasDefaultValue(0.00m);
            e.HasOne(x => x.Author)
                .WithMany(a => a.Books)
                .HasForeignKey(x => x.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Category)
                .WithMany(c => c.Books)
                .HasForeignKey(x => x.CategoryId);
            e.HasOne(x => x.Subcategory)
                .WithMany(s => s.Books)
                .HasForeignKey(x => x.SubcategoryId);
        });

        // SubscriptionPlan
        modelBuilder.Entity<SubscriptionPlan>(e =>
        {
            e.HasKey(x => x.PlanId);
            e.Property(x => x.PlanId).UseIdentityAlwaysColumn();
        });

        // Subscription
        modelBuilder.Entity<Subscription>(e =>
        {
            e.HasKey(x => x.SubscriptionId);
            e.Property(x => x.SubscriptionId).UseIdentityAlwaysColumn();
            e.HasOne(x => x.User)
                .WithMany(u => u.Subscriptions)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Plan)
                .WithMany(p => p.Subscriptions)
                .HasForeignKey(x => x.PlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // UserLibrary
        modelBuilder.Entity<UserLibrary>(e =>
        {
            e.HasKey(x => x.LibraryId);
            e.Property(x => x.LibraryId).UseIdentityAlwaysColumn();
            e.HasIndex(x => new { x.UserId, x.BookId }).IsUnique();
            e.HasOne(x => x.User)
                .WithMany(u => u.Library)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book)
                .WithMany(b => b.LibraryEntries)
                .HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // BookmarkType
        modelBuilder.Entity<BookmarkType>(e =>
        {
            e.HasKey(x => x.TypeId);
            e.Property(x => x.TypeId).UseIdentityAlwaysColumn();
        });

        // Bookmark
        modelBuilder.Entity<Bookmark>(e =>
        {
            e.HasKey(x => x.BookmarkId);
            e.Property(x => x.BookmarkId).UseIdentityAlwaysColumn();
            e.HasIndex(x => new { x.UserId, x.BookId, x.TypeId }).IsUnique();
            e.HasOne(x => x.User)
                .WithMany(u => u.Bookmarks)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book)
                .WithMany(b => b.Bookmarks)
                .HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Type)
                .WithMany(t => t.Bookmarks)
                .HasForeignKey(x => x.TypeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ReadingProgress
        modelBuilder.Entity<ReadingProgress>(e =>
        {
            e.HasKey(x => x.ProgressId);
            e.Property(x => x.ProgressId).UseIdentityAlwaysColumn();
            e.HasIndex(x => new { x.UserId, x.BookId }).IsUnique();
            e.HasOne(x => x.User)
                .WithMany(u => u.ReadingProgresses)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book)
                .WithMany(b => b.ReadingProgresses)
                .HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Review
        modelBuilder.Entity<Review>(e =>
        {
            e.HasKey(x => x.ReviewId);
            e.Property(x => x.ReviewId).UseIdentityAlwaysColumn();
            e.Property(x => x.HasViolation).HasDefaultValue(false);
            e.HasIndex(x => new { x.UserId, x.BookId }).IsUnique();
            e.HasOne(x => x.User)
                .WithMany(u => u.Reviews)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book)
                .WithMany(b => b.Reviews)
                .HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Comment
        modelBuilder.Entity<Comment>(e =>
        {
            e.HasKey(x => x.CommentId);
            e.Property(x => x.CommentId).UseIdentityAlwaysColumn();
            e.Property(x => x.HasViolation).HasDefaultValue(false);
            e.HasOne(x => x.User)
                .WithMany(u => u.Comments)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book)
                .WithMany(b => b.Comments)
                .HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ModerationLog
        modelBuilder.Entity<ModerationLog>(e =>
        {
            e.HasKey(x => x.ModerationLogId);
            e.Property(x => x.ModerationLogId).UseIdentityAlwaysColumn();
            e.HasOne(x => x.Moderator)
                .WithMany(u => u.ModerationLogs)
                .HasForeignKey(x => x.ModeratorUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Purchase
        modelBuilder.Entity<Purchase>(e =>
        {
            e.HasKey(x => x.PurchaseId);
            e.Property(x => x.PurchaseId).UseIdentityAlwaysColumn();
            e.HasOne(x => x.User)
                .WithMany(u => u.Purchases)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book)
                .WithMany(b => b.Purchases)
                .HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // DeliveryOrder
        modelBuilder.Entity<DeliveryOrder>(e =>
        {
            e.HasKey(x => x.OrderId);
            e.Property(x => x.OrderId).UseIdentityAlwaysColumn();
            e.Property(x => x.Status).HasDefaultValue("created");
            e.HasOne(x => x.User)
                .WithMany(u => u.DeliveryOrders)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Book)
                .WithMany(b => b.DeliveryOrders)
                .HasForeignKey(x => x.BookId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
