using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthorsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuthorsController(AppDbContext db) => _db = db;

    /// <summary>Список всех авторов</summary>
    [HttpGet("Authors_GetAll")]
    public async Task<ActionResult<List<AuthorResponse>>> GetAll()
    {
        var authors = await _db.Authors.ToListAsync();
        return Ok(authors.Select(Map));
    }

    /// <summary>Автор по ID</summary>
    [HttpGet("{id}/Authors_GetById")]
    public async Task<ActionResult<AuthorResponse>> GetById(int id)
    {
        var author = await _db.Authors.FindAsync(id);
        if (author == null) return NotFound();
        return Ok(Map(author));
    }

    /// <summary>Добавить автора [admin, meneger]</summary>
    [HttpPost("Authors_Create")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<AuthorResponse>> Create([FromBody] CreateAuthorRequest req)
    {
        var author = new Author
        {
            FullName = req.FullName,
            Biography = req.Biography,
            BirthYear = req.BirthYear,
            DeathYear = req.DeathYear
        };
        _db.Authors.Add(author);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = author.AuthorId }, Map(author));
    }

    /// <summary>Редактировать автора [admin, meneger]</summary>
    [HttpPut("{id}/Authors_Update")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<AuthorResponse>> Update(int id, [FromBody] CreateAuthorRequest req)
    {
        var author = await _db.Authors.FindAsync(id);
        if (author == null) return NotFound();

        author.FullName = req.FullName;
        author.Biography = req.Biography;
        author.BirthYear = req.BirthYear;
        author.DeathYear = req.DeathYear;

        await _db.SaveChangesAsync();
        return Ok(Map(author));
    }

    /// <summary>Удалить автора [admin, meneger]</summary>
    [HttpDelete("{id}/Authors_Delete")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<IActionResult> Delete(int id)
    {
        var author = await _db.Authors.FindAsync(id);
        if (author == null) return NotFound();
        _db.Authors.Remove(author);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static AuthorResponse Map(Author a) => new(a.AuthorId, a.FullName, a.Biography, a.BirthYear, a.DeathYear);
}
