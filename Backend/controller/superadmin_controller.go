package controller

import (
	"fmt"
	"intern_template_v1/middleware"
	"intern_template_v1/model"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func ListCategories(c *fiber.Ctx) error {
	categories, err := listCategories()
	if err != nil {
		return serverError(c, "failed to fetch categories", err)
	}

	filtered := make([]model.CategoryModel, 0, len(categories))
	for _, category := range categories {
		if isDisabledCategory(category.Name) {
			continue
		}
		filtered = append(filtered, category)
	}

	return success(c, fiber.StatusOK, filtered)
}

func CreateCategoryBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}

	if err := ensureCategoryStore(); err != nil {
		return serverError(c, "failed to initialize categories", err)
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse category", err)
	}

	name := strings.TrimSpace(payload.Name)
	if name == "" {
		return invalidRequest(c, "category name is required")
	}
	if isDisabledCategory(name) {
		return invalidRequest(c, "category name is reserved")
	}

	exists, err := categoryExists(name)
	if err != nil {
		return serverError(c, "failed to validate category", err)
	}
	if exists {
		return invalidRequest(c, "category already exists")
	}

	if err := middleware.DBConn.Exec(
		`INSERT INTO `+categoryTable+` (name, created_at, updated_at) VALUES (?, ?, ?)`,
		name, utcNow(), utcNow(),
	).Error; err != nil {
		return serverError(c, "failed to create category", err)
	}

	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	categories, err := listCategories()
	if err != nil {
		return serverError(c, "failed to fetch categories", err)
	}

	return success(c, fiber.StatusCreated, categories)
}

func UpdateCategoryBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}

	if err := ensureCategoryStore(); err != nil {
		return serverError(c, "failed to initialize categories", err)
	}

	categoryID, err := strconv.Atoi(strings.TrimSpace(c.Params("id")))
	if err != nil || categoryID <= 0 {
		return invalidRequest(c, "invalid category id")
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse category update", err)
	}

	newName := strings.TrimSpace(payload.Name)
	if newName == "" {
		return invalidRequest(c, "category name is required")
	}
	if isDisabledCategory(newName) {
		return invalidRequest(c, "category name is reserved")
	}

	var existing model.CategoryModel
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Scan(&existing).Error; err != nil {
		return serverError(c, "failed to fetch category", err)
	}
	if existing.ID == 0 {
		return notFound(c, "category not found", nil)
	}

	if strings.EqualFold(existing.Name, newName) {
		categories, listErr := listCategories()
		if listErr != nil {
			return serverError(c, "failed to fetch categories", listErr)
		}
		return success(c, fiber.StatusOK, categories)
	}

	exists, err := categoryExists(newName)
	if err != nil {
		return serverError(c, "failed to validate category", err)
	}
	if exists {
		return invalidRequest(c, "category already exists")
	}

	tx := middleware.DBConn.Begin()
	if tx.Error != nil {
		return serverError(c, "failed to start category update", tx.Error)
	}

	if err := tx.Exec(
		`UPDATE `+categoryTable+` SET name = ?, updated_at = ? WHERE id = ?`,
		newName, utcNow(), categoryID,
	).Error; err != nil {
		tx.Rollback()
		return serverError(c, "failed to update category", err)
	}

	if err := tx.Exec(
		`UPDATE `+adminTable+` SET unit = ?, updated_at = ? WHERE unit = ?`,
		newName, utcNow(), existing.Name,
	).Error; err != nil {
		tx.Rollback()
		return serverError(c, "failed to sync admin units", err)
	}

	if err := tx.Exec(
		`UPDATE `+feedbackTable+` SET category = ?, updated_at = ? WHERE category = ?`,
		newName, utcNow(), existing.Name,
	).Error; err != nil {
		tx.Rollback()
		return serverError(c, "failed to sync feedback categories", err)
	}

	if err := tx.Commit().Error; err != nil {
		return serverError(c, "failed to finalize category update", err)
	}

	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	categories, listErr := listCategories()
	if listErr != nil {
		return serverError(c, "failed to fetch categories", listErr)
	}

	return success(c, fiber.StatusOK, categories)
}

func DeleteCategoryBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}

	if err := ensureCategoryStore(); err != nil {
		return serverError(c, "failed to initialize categories", err)
	}

	categoryID, err := strconv.Atoi(strings.TrimSpace(c.Params("id")))
	if err != nil || categoryID <= 0 {
		return invalidRequest(c, "invalid category id")
	}

	var existing model.CategoryModel
	if err := middleware.DBConn.Raw(
		`SELECT id, name, created_at, updated_at FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Scan(&existing).Error; err != nil {
		return serverError(c, "failed to fetch category", err)
	}
	if existing.ID == 0 {
		return notFound(c, "category not found", nil)
	}

	inUse, err := categoryInUse(existing.Name)
	if err != nil {
		return serverError(c, "failed to validate category usage", err)
	}
	if inUse {
		return invalidRequest(c, "category is in use by admin accounts or feedbacks")
	}

	var categoryCount int64
	if err := middleware.DBConn.Raw(`SELECT COUNT(*) FROM ` + categoryTable).Scan(&categoryCount).Error; err != nil {
		return serverError(c, "failed to validate category count", err)
	}
	if categoryCount <= 1 {
		return invalidRequest(c, "at least one category is required")
	}

	if err := middleware.DBConn.Exec(
		`DELETE FROM `+categoryTable+` WHERE id = ?`,
		categoryID,
	).Error; err != nil {
		return serverError(c, "failed to delete category", err)
	}

	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	categories, err := listCategories()
	if err != nil {
		return serverError(c, "failed to fetch categories", err)
	}

	return success(c, fiber.StatusOK, categories)
}

func ListAdmins(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}
	if err := ensureAdminSuperAdminColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	var admins []model.AdminModel
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, COALESCE(is_superadmin, FALSE) AS is_superadmin, created_at, updated_at
		FROM ` + adminTable + ` WHERE COALESCE(is_superadmin, FALSE) = FALSE ORDER BY unit ASC, first_name ASC, last_name ASC`,
	).Scan(&admins).Error; err != nil {
		return serverError(c, "failed to fetch admins", err)
	}

	return success(c, fiber.StatusOK, admins)
}

func CreateAdminBySuperAdmin(c *fiber.Ctx) error {
	if _, err := requireSuperAdminSession(c); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	var payload model.AdminModel
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse admin", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Password = strings.TrimSpace(payload.Password)
	payload.Unit = strings.TrimSpace(payload.Unit)

	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" || payload.Password == "" || payload.Unit == "" {
		return invalidRequest(c, "missing required admin fields")
	}
	if isDisabledCategory(payload.Unit) {
		return invalidRequest(c, "invalid admin unit")
	}

	inUse, err := emailInUse(payload.Email, "", "")
	if err != nil {
		return serverError(c, "failed to validate email", err)
	}
	if inUse {
		return invalidRequest(c, "email is already in use")
	}

	unitExists, err := categoryExists(payload.Unit)
	if err != nil {
		return serverError(c, "failed to validate admin unit", err)
	}
	if !unitExists {
		return invalidRequest(c, "invalid admin unit")
	}

	taken, err := adminUnitTaken(payload.Unit, "")
	if err != nil {
		return serverError(c, "failed to validate admin unit", err)
	}
	if taken {
		return invalidRequest(c, "selected unit already has an admin")
	}

	payload.ID = "ADMIN-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	hashedPassword, err := hashPassword(payload.Password)
	if err != nil {
		return serverError(c, "failed to secure admin password", err)
	}
	now := utcNow()
	if err := middleware.DBConn.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, is_disabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, hashedPassword, payload.Unit, false, now, now,
	).Error; err != nil {
		return serverError(c, "failed to create admin", err)
	}

	admin, err := fetchAdminByID(payload.ID)
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}
	return success(c, fiber.StatusCreated, admin)
}

func UpdateAdminBySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	if err := requireReauth(c, session); err != nil {
		return err
	}

	var payload struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Unit      string `json:"unit"`
		Password  string `json:"password"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse admin update", err)
	}

	var sets []string
	var args []any

	if value := strings.TrimSpace(payload.FirstName); value != "" {
		sets = append(sets, "first_name = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.LastName); value != "" {
		sets = append(sets, "last_name = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.Email); value != "" {
		inUse, err := emailInUse(value, "", c.Params("id"))
		if err != nil {
			return serverError(c, "failed to validate email", err)
		}
		if inUse {
			return invalidRequest(c, "email is already in use")
		}
		sets = append(sets, "email = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.Unit); value != "" {
		if isDisabledCategory(value) {
			return invalidRequest(c, "invalid admin unit")
		}
		unitExists, err := categoryExists(value)
		if err != nil {
			return serverError(c, "failed to validate admin unit", err)
		}
		if !unitExists {
			return invalidRequest(c, "invalid admin unit")
		}
		taken, err := adminUnitTaken(value, c.Params("id"))
		if err != nil {
			return serverError(c, "failed to validate admin unit", err)
		}
		if taken {
			return invalidRequest(c, "selected unit already has an admin")
		}
		sets = append(sets, "unit = ?")
		args = append(args, value)
	}
	if value := strings.TrimSpace(payload.Password); value != "" {
		hashedPassword, err := hashPassword(value)
		if err != nil {
			return serverError(c, "failed to secure admin password", err)
		}
		sets = append(sets, "password = ?")
		args = append(args, hashedPassword)
	}

	if len(sets) == 0 {
		return invalidRequest(c, "no fields provided for admin update")
	}

	sets = append(sets, "updated_at = ?")
	args = append(args, utcNow())
	if err := execUpdateByID(adminTable, c.Params("id"), "failed to update admin", "admin not found", sets, args...); err != nil {
		return respondDBResult(c, err)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}
	return success(c, fiber.StatusOK, admin)
}

func DisableAdminBySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	if err := requireReauth(c, session); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}
	if err := ensureDisabledCategory(); err != nil {
		return serverError(c, "failed to initialize disabled admin unit", err)
	}
	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	result := middleware.DBConn.Exec(
		`UPDATE `+adminTable+` SET is_disabled = TRUE, unit = ?, updated_at = ? WHERE id = ?`,
		disabledCategoryName,
		utcNow(),
		c.Params("id"),
	)
	if result.Error != nil {
		return serverError(c, "failed to disable admin account", result.Error)
	}
	if result.RowsAffected == 0 {
		return notFound(c, "admin not found", nil)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}

	return success(c, fiber.StatusOK, admin)
}

func EnableAdminBySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	if err := requireReauth(c, session); err != nil {
		return err
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}
	if err := ensureInactiveCategory(); err != nil {
		return serverError(c, "failed to initialize inactive admin unit", err)
	}
	if err := syncCategoryConstraints(); err != nil {
		return serverError(c, "failed to sync category constraints", err)
	}

	result := middleware.DBConn.Exec(
		`UPDATE `+adminTable+` SET is_disabled = FALSE, unit = ?, updated_at = ? WHERE id = ?`,
		inactiveCategoryName,
		utcNow(),
		c.Params("id"),
	)
	if result.Error != nil {
		return serverError(c, "failed to enable admin account", result.Error)
	}
	if result.RowsAffected == 0 {
		return notFound(c, "admin not found", nil)
	}

	admin, err := fetchAdminByID(c.Params("id"))
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}

	return success(c, fiber.StatusOK, admin)
}
