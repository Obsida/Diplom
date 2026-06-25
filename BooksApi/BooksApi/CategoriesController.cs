using BookStoreApi.Data;
using BookStoreApi.DTOs;
using BookStoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookStoreApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    public CategoriesController(AppDbContext db) => _db = db;

    /// <summary>Получить все категории с подкатегориями</summary>
    [HttpGet("Categories_GetAll")]
    public async Task<ActionResult<List<CategoryResponse>>> GetAll()
    {
        var cats = await _db.Categories.Include(c => c.Subcategories).ToListAsync();
        return Ok(cats.Select(Map));
    }

    /// <summary>Категория по ID</summary>
    [HttpGet("{id}/Categories_GetById")]
    public async Task<ActionResult<CategoryResponse>> GetById(int id)
    {
        var cat = await _db.Categories.Include(c => c.Subcategories)
            .FirstOrDefaultAsync(c => c.CategoryId == id);
        if (cat == null) return NotFound();
        return Ok(Map(cat));
    }

    /// <summary>Добавить категорию [admin, meneger]</summary>
    [HttpPost("Categories_Create")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<CategoryResponse>> Create([FromBody] CreateCategoryRequest req)
    {
        var cat = new Category { Name = req.Name, Description = req.Description };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync();
        await _db.Entry(cat).Collection(c => c.Subcategories).LoadAsync();
        return CreatedAtAction(nameof(GetById), new { id = cat.CategoryId }, Map(cat));
    }

    /// <summary>Редактировать категорию [admin, meneger]</summary>
    [HttpPut("{id}/Categories_Update")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<CategoryResponse>> Update(int id, [FromBody] UpdateCategoryRequest req)
    {
        var cat = await _db.Categories.Include(c => c.Subcategories)
            .FirstOrDefaultAsync(c => c.CategoryId == id);
        if (cat == null) return NotFound();

        if (req.Name        != null) cat.Name        = req.Name;
        if (req.Description != null) cat.Description = req.Description;
        if (req.IsActive    != null) cat.IsActive     = req.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(Map(cat));
    }

    /// <summary>Удалить категорию [admin, meneger]</summary>
    [HttpDelete("{id}/Categories_Delete")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<IActionResult> Delete(int id)
    {
        var cat = await _db.Categories.FindAsync(id);
        if (cat == null) return NotFound();
        _db.Categories.Remove(cat);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static CategoryResponse Map(Category c) => new(
        c.CategoryId, c.Name, c.Description, c.IsActive,
        c.Subcategories.Select(s => new SubcategoryResponse(
            s.SubcategoryId, s.CategoryId, s.Name, s.Description, s.IsActive)).ToList()
    );
}

[ApiController]
[Route("api/[controller]")]
public class SubcategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    public SubcategoriesController(AppDbContext db) => _db = db;

    /// <summary>Все подкатегории (опционально фильтр по категории)</summary>
    [HttpGet("Subcategories_GetAll")]
    public async Task<ActionResult<List<SubcategoryResponse>>> GetAll([FromQuery] int? categoryId)
    {
        var query = _db.Subcategories.AsQueryable();
        if (categoryId.HasValue) query = query.Where(s => s.CategoryId == categoryId.Value);
        var list = await query.ToListAsync();
        return Ok(list.Select(Map));
    }

    /// <summary>Подкатегория по ID</summary>
    [HttpGet("{id}/Subcategories_GetById")]
    public async Task<ActionResult<SubcategoryResponse>> GetById(int id)
    {
        var s = await _db.Subcategories.FindAsync(id);
        if (s == null) return NotFound();
        return Ok(Map(s));
    }

    /// <summary>Добавить подкатегорию [admin, meneger]</summary>
    [HttpPost("Subcategories_Create")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<SubcategoryResponse>> Create([FromBody] CreateSubcategoryRequest req)
    {
        var sub = new Subcategory { CategoryId = req.CategoryId, Name = req.Name, Description = req.Description };
        _db.Subcategories.Add(sub);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = sub.SubcategoryId }, Map(sub));
    }

    /// <summary>Редактировать подкатегорию [admin, meneger]</summary>
    [HttpPut("{id}/Subcategories_Update")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<ActionResult<SubcategoryResponse>> Update(int id, [FromBody] UpdateSubcategoryRequest req)
    {
        var sub = await _db.Subcategories.FindAsync(id);
        if (sub == null) return NotFound();

        if (req.Name        != null) sub.Name        = req.Name;
        if (req.Description != null) sub.Description = req.Description;
        if (req.IsActive    != null) sub.IsActive     = req.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(Map(sub));
    }

    /// <summary>Удалить подкатегорию [admin, meneger]</summary>
    [HttpDelete("{id}/Subcategories_Delete")]
    [Authorize(Roles = "admin,meneger")]
    public async Task<IActionResult> Delete(int id)
    {
        var sub = await _db.Subcategories.FindAsync(id);
        if (sub == null) return NotFound();
        _db.Subcategories.Remove(sub);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static SubcategoryResponse Map(Subcategory s) =>
        new(s.SubcategoryId, s.CategoryId, s.Name, s.Description, s.IsActive);
}
