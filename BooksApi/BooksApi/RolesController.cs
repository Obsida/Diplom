using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _db;
    public RolesController(AppDbContext db) => _db = db;

    [HttpGet("Roles_GetAll")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<List<RoleResponse>>> GetAll()
    {
        var roles = await _db.Roles.ToListAsync();
        return Ok(roles.Select(r => new RoleResponse(r.RoleId, r.Name, r.IsActive)));
    }

    [HttpPost("Roles_Create")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<RoleResponse>> Create([FromBody] string name)
    {
        if (await _db.Roles.AnyAsync(r => r.Name == name))
            return Conflict("Роль с таким именем уже существует");

        var role = new Role { Name = name };
        _db.Roles.Add(role);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new RoleResponse(role.RoleId, role.Name, role.IsActive));
    }

    [HttpDelete("{id}/Roles_Deactivate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var role = await _db.Roles.FindAsync(id);
        if (role == null) return NotFound();
        role.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
