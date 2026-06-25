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
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    public UsersController(AppDbContext db) => _db = db;

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("Users_GetMyProfile")]
    public async Task<ActionResult<UserResponse>> GetMe()
    {
        var user = await _db.Users
            .Include(u => u.Role)
            .Include(u => u.SubscriptionOwner)
            .FirstOrDefaultAsync(u => u.UserId == CurrentUserId);
        if (user == null) return NotFound();
        return Ok(MapUser(user));
    }

    [HttpPut("Users_UpdateMyProfile")]
    public async Task<ActionResult<UserResponse>> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == CurrentUserId);
        if (user == null) return NotFound();

        user.FirstName = req.FirstName;
        user.LastName = req.LastName;
        user.MiddleName = req.MiddleName;
        user.Phone = req.Phone;

        await _db.SaveChangesAsync();
        return Ok(MapUser(user));
    }

    [HttpPut("Users_ChangePassword")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user == null) return NotFound();

        if (!BCrypt.Net.BCrypt.Verify(req.OldPassword, user.PasswordHash))
            return BadRequest("Старый пароль неверный");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("Users_GetAll")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<List<UserResponse>>> GetAll()
    {
        var users = await _db.Users
            .Include(u => u.Role)
            .Include(u => u.SubscriptionOwner)
            .ToListAsync();
        return Ok(users.Select(MapUser));
    }

    [HttpGet("{id}/Users_GetById")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<UserResponse>> GetById(int id)
    {
        var user = await _db.Users
            .Include(u => u.Role)
            .Include(u => u.SubscriptionOwner)
            .FirstOrDefaultAsync(u => u.UserId == id);
        if (user == null) return NotFound();
        return Ok(MapUser(user));
    }

    [HttpPut("{id}/role/Users_AssignRole")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AssignRole(int id, [FromBody] AssignRoleRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        var role = await _db.Roles.FindAsync(req.RoleId);
        if (role == null) return BadRequest("Роль не найдена");

        user.RoleId = req.RoleId;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}/Users_Delete")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        if (id == CurrentUserId) return BadRequest("Нельзя удалить себя");
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static UserResponse MapUser(User u)
    {
        var status = u.SubscriptionStatus;
        var endDate = u.SubscriptionEndDate;
        var ownerId = u.SubscriptionOwnerId;
        var ownerEmail = u.SubscriptionOwner?.Email;

        if (u.SubscriptionOwner != null)
        {
            status = u.SubscriptionOwner.SubscriptionStatus;
            endDate = u.SubscriptionOwner.SubscriptionEndDate;
        }

        return new UserResponse(
            u.UserId, u.Email, u.FirstName, u.LastName, u.MiddleName,
            u.Phone, u.Role.Name, status, endDate, ownerId, ownerEmail
        );
    }
}
