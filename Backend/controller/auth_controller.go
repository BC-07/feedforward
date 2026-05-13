package controller

import (
	"crypto/rand"
	"fmt"
	"intern_template_v1/middleware"
	"intern_template_v1/model"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

type userLoginOTPRequest struct {
	Email      string `json:"email"`
	RememberMe bool   `json:"rememberMe"`
}

type userLoginVerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

type userLoginOTPEntry struct {
	Email      string
	RememberMe bool
	ExpiresAt  time.Time
}

type loginRoleResponse struct {
	Role         string `json:"role"`
	IsSuperAdmin bool   `json:"isSuperAdmin,omitempty"`
}

var (
	userLoginOTPs   = map[string]userLoginOTPEntry{}
	userLoginOTPMux sync.Mutex
)

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeOTP(value string) string {
	var builder strings.Builder
	for _, ch := range strings.TrimSpace(value) {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') {
			builder.WriteRune(ch)
		}
	}
	return strings.ToUpper(builder.String())
}

func generateUserLoginOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func cleanupExpiredUserLoginOTPs(now time.Time) {
	for otp, entry := range userLoginOTPs {
		if now.After(entry.ExpiresAt) {
			delete(userLoginOTPs, otp)
		}
	}
}

func buildUserLoginOTPHTML(otp string) string {
	body := fmt.Sprintf(
		`<p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#111827;">Use this one-time code to sign in to FeedForward:</p>
<div style="margin:20px 0;text-align:center;">
  <div style="display:inline-block;padding:18px 22px;border-radius:14px;background:#fff3e0;font-size:30px;font-weight:800;letter-spacing:0.35em;color:#111827;">%s</div>
</div>
<p style="margin:16px 0 0 0;font-size:13px;line-height:20px;color:#6b7280;">This OTP expires in 5 minutes. If you did not request this login, you can ignore this email.</p>`,
		esc(otp),
	)
	return buildEmailShell("Your FeedForward login OTP", body)
}

func buildUserLoginOTPText(otp string) string {
	return strings.Join([]string{
		"Use this one-time code to sign in to FeedForward:",
		fmt.Sprintf("OTP: %s", otp),
		"This OTP expires in 5 minutes.",
		"If you did not request this login, you can ignore this email.",
	}, "\n")
}

func RegisterUser(c *fiber.Ctx) error {
	db := middleware.DBConn

	//Storage preparation
	var payload model.UserModel

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse user", err)
	}

	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.TrimSpace(payload.Email)
	payload.Password = strings.TrimSpace(payload.Password)
	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" || payload.Password == "" {
		return invalidRequest(c, "missing required user fields")
	}

	inUse, err := emailInUse(payload.Email, "", "")
	if err != nil {
		return serverError(c, "failed to validate email", err)
	}
	if inUse {
		return invalidRequest(c, "email is already in use")
	}

	payload.ID = "USER-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	hashedPassword, err := hashPassword(payload.Password)
	if err != nil {
		return serverError(c, "failed to secure user password", err)
	}
	now := utcNow()
	if err := db.Exec(
		`INSERT INTO `+userTable+` (id, first_name, last_name, email, password, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, hashedPassword, now, now,
	).Error; err != nil {
		return serverError(c, "failed to register user", err)
	}

	user, err := fetchUserByID(payload.ID)
	if err != nil {
		return serverError(c, "failed to fetch user", err)
	}
	return success(c, fiber.StatusCreated, user)
}

func RegisterAdmin(c *fiber.Ctx) error {
	db := middleware.DBConn
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}
	if err := ensureAdminSuperAdminColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	//Storage preparation
	var payload model.AdminModel

	//validating user input in json
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

	payload.ID = "ADMIN-" + fmt.Sprintf("%d", time.Now().UnixMilli())
	hashedPassword, err := hashPassword(payload.Password)
	if err != nil {
		return serverError(c, "failed to secure admin password", err)
	}
	now := utcNow()
	if err := db.Exec(
		`INSERT INTO `+adminTable+` (id, first_name, last_name, email, password, unit, is_disabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		payload.ID, payload.FirstName, payload.LastName, payload.Email, hashedPassword, payload.Unit, false, now, now,
	).Error; err != nil {
		return serverError(c, "failed to register admin", err)
	}

	admin, err := fetchAdminByID(payload.ID)
	if err != nil {
		return serverError(c, "failed to fetch admin", err)
	}
	return success(c, fiber.StatusCreated, admin)
}

func LoginUser(c *fiber.Ctx) error {
	//Storage preparation
	var payload struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		RememberMe bool   `json:"rememberMe"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse login", err)
	}

	email := strings.TrimSpace(payload.Email)
	password := strings.TrimSpace(payload.Password)
	if email == "" || password == "" {
		return invalidRequest(c, "email and password are required")
	}

	var credential struct {
		ID       string `json:"id"`
		Password string `json:"password"`
	}
	if err := middleware.DBConn.Raw(
		`SELECT id, password FROM `+userTable+` WHERE email = ?`,
		email,
	).Scan(&credential).Error; err != nil {
		return serverError(c, "failed to login user", err)
	}
	if credential.ID == "" {
		return unauthorized(c, "invalid email or password")
	}

	matched, needsUpgrade := verifyPassword(credential.Password, password)
	if !matched {
		return unauthorized(c, "invalid email or password")
	}
	if needsUpgrade {
		if err := upgradePasswordHash(userTable, credential.ID, password); err != nil {
			return serverError(c, "failed to secure user password", err)
		}
	}

	user, err := fetchUserByID(credential.ID)
	if err != nil {
		return serverError(c, "failed to load user profile", err)
	}

	ttl := userSessionTTL
	if payload.RememberMe {
		ttl = rememberMeSessionTTL
	}
	session, err := createSession(sessionRoleUser, &user.ID, nil, nil, ttl, payload.RememberMe)
	if err != nil {
		return serverError(c, "failed to create user session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, user)
}

func RequestUserLoginOTP(c *fiber.Ctx) error {
	var payload userLoginOTPRequest
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse request", err)
	}

	email := normalizeEmail(payload.Email)
	if email == "" {
		return invalidRequest(c, "email is required")
	}

	user, err := fetchUserByEmail(email)
	if err != nil {
		return serverError(c, "failed to check user account", err)
	}
	if strings.TrimSpace(user.ID) == "" {
		return unauthorized(c, "invalid email or password")
	}

	otp, err := generateUserLoginOTP()
	if err != nil {
		return serverError(c, "failed to generate OTP", err)
	}

	now := utcNow()
	userLoginOTPMux.Lock()
	cleanupExpiredUserLoginOTPs(now)
	userLoginOTPs[otp] = userLoginOTPEntry{
		Email:      email,
		RememberMe: payload.RememberMe,
		ExpiresAt:  now.Add(5 * time.Minute),
	}
	userLoginOTPMux.Unlock()

	if err := sendEmail(email, "Your FeedForward login OTP", buildUserLoginOTPText(otp), buildUserLoginOTPHTML(otp)); err != nil {
		return serverError(c, "failed to send OTP", err)
	}

	return success(c, fiber.StatusOK, map[string]any{"sent": true})
}

func VerifyUserLoginOTP(c *fiber.Ctx) error {
	var payload userLoginVerifyOTPRequest
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse request", err)
	}

	email := normalizeEmail(payload.Email)
	otp := normalizeOTP(payload.OTP)
	if email == "" || otp == "" {
		return invalidRequest(c, "email and OTP are required")
	}

	now := utcNow()
	userLoginOTPMux.Lock()
	cleanupExpiredUserLoginOTPs(now)
	entry, exists := userLoginOTPs[otp]
	if exists && entry.Email == email {
		delete(userLoginOTPs, otp)
	}
	userLoginOTPMux.Unlock()

	if !exists || entry.Email != email {
		return invalidRequest(c, "invalid or expired OTP")
	}

	user, err := fetchUserByEmail(email)
	if err != nil {
		return serverError(c, "failed to load user profile", err)
	}
	if strings.TrimSpace(user.ID) == "" {
		return unauthorized(c, "invalid email or password")
	}

	ttl := userSessionTTL
	if entry.RememberMe {
		ttl = rememberMeSessionTTL
	}
	session, err := createSession(sessionRoleUser, &user.ID, nil, nil, ttl, entry.RememberMe)
	if err != nil {
		return serverError(c, "failed to create user session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, user)
}

func GetLoginRole(c *fiber.Ctx) error {
	email := normalizeEmail(c.Query("email"))
	if email == "" {
		return invalidRequest(c, "email is required")
	}

	admin, err := fetchAdminByEmail(email)
	if err != nil {
		return serverError(c, "failed to check login role", err)
	}
	if strings.TrimSpace(admin.ID) != "" {
		role := sessionRoleAdmin
		if admin.IsSuperAdmin {
			role = sessionRoleSuperAdmin
		}
		return success(c, fiber.StatusOK, loginRoleResponse{
			Role:         role,
			IsSuperAdmin: admin.IsSuperAdmin,
		})
	}

	user, err := fetchUserByEmail(email)
	if err != nil {
		return serverError(c, "failed to check login role", err)
	}
	if strings.TrimSpace(user.ID) != "" {
		return success(c, fiber.StatusOK, loginRoleResponse{Role: sessionRoleUser})
	}

	return success(c, fiber.StatusOK, loginRoleResponse{Role: "none"})
}

func LoginAdmin(c *fiber.Ctx) error {
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}
	if err := ensureAdminSuperAdminColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	//Storage preparation
	var payload struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		RememberMe bool   `json:"rememberMe"`
	}

	//validating user input in json
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse login", err)
	}

	email := strings.TrimSpace(payload.Email)
	password := strings.TrimSpace(payload.Password)
	if email == "" || password == "" {
		return invalidRequest(c, "email and password are required")
	}

	var credential struct {
		ID       string `json:"id"`
		Password string `json:"password"`
	}
	if err := middleware.DBConn.Raw(
		`SELECT id, password FROM `+adminTable+` WHERE email = ?`,
		email,
	).Scan(&credential).Error; err != nil {
		return serverError(c, "failed to load admin credentials", err)
	}
	if credential.ID == "" {
		return unauthorized(c, "invalid email or password")
	}

	matched, needsUpgrade := verifyPassword(credential.Password, password)
	if !matched {
		return unauthorized(c, "invalid email or password")
	}
	if needsUpgrade {
		if err := upgradePasswordHash(adminTable, credential.ID, password); err != nil {
			return serverError(c, "failed to secure admin password", err)
		}
	}

	var admin model.AdminModel
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, COALESCE(is_superadmin, FALSE) AS is_superadmin, created_at, updated_at
		FROM `+adminTable+` WHERE id = ?`,
		credential.ID,
	).Scan(&admin).Error; err != nil {
		return serverError(c, "failed to login admin", err)
	}
	if admin.ID == "" {
		return unauthorized(c, "invalid email or password")
	}
	if admin.IsDisabled {
		if admin.IsSuperAdmin {
			return unauthorized(c, "superadmin account is disabled")
		}
		return unauthorized(c, "admin account is disabled")
	}

	if admin.IsSuperAdmin {
		displayName := strings.TrimSpace(admin.Name)
		if displayName == "" {
			displayName = strings.TrimSpace(admin.Email)
		}
		if displayName == "" {
			displayName = "superadmin"
		}
		ttl := superAdminTTL
		if payload.RememberMe {
			ttl = rememberMeSessionTTL
		}
		session, err := createSession(sessionRoleSuperAdmin, nil, &admin.ID, &displayName, ttl, payload.RememberMe)
		if err != nil {
			return serverError(c, "failed to create superadmin session", err)
		}
		setSessionCookie(c, session)
		return success(c, fiber.StatusOK, admin)
	}

	ttl := adminSessionTTL
	if payload.RememberMe {
		ttl = rememberMeSessionTTL
	}
	session, err := createSession(sessionRoleAdmin, nil, &admin.ID, nil, ttl, payload.RememberMe)
	if err != nil {
		return serverError(c, "failed to create admin session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, admin)
}

func LoginSuperAdmin(c *fiber.Ctx) error {
	var payload struct {
		Email      string `json:"email"`
		Username   string `json:"username"`
		Password   string `json:"password"`
		RememberMe bool   `json:"rememberMe"`
	}

	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse superadmin login", err)
	}

	if err := ensureAdminSuperAdminColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}
	if err := ensureAdminDisableColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}

	identifier := strings.TrimSpace(payload.Email)
	if identifier == "" {
		identifier = strings.TrimSpace(payload.Username)
	}
	password := strings.TrimSpace(payload.Password)
	if identifier == "" || password == "" {
		return invalidRequest(c, "email and password are required")
	}

	var credential struct {
		ID       string `json:"id"`
		Password string `json:"password"`
	}
	if err := middleware.DBConn.Raw(
		`SELECT id, password FROM `+adminTable+` WHERE LOWER(email) = LOWER(?) AND COALESCE(is_superadmin, FALSE) = TRUE`,
		identifier,
	).Scan(&credential).Error; err != nil {
		return serverError(c, "failed to load superadmin credentials", err)
	}
	if credential.ID == "" {
		return unauthorized(c, "invalid superadmin credentials")
	}

	matched, needsUpgrade := verifyPassword(credential.Password, password)
	if !matched {
		return unauthorized(c, "invalid superadmin credentials")
	}
	if needsUpgrade {
		if err := upgradePasswordHash(adminTable, credential.ID, password); err != nil {
			return serverError(c, "failed to secure superadmin password", err)
		}
	}

	var admin model.AdminModel
	if err := middleware.DBConn.Raw(
		`SELECT id, first_name, last_name, first_name || ' ' || last_name AS name, email, unit, COALESCE(is_disabled, FALSE) AS is_disabled, COALESCE(is_superadmin, FALSE) AS is_superadmin, created_at, updated_at
		FROM `+adminTable+` WHERE id = ?`,
		credential.ID,
	).Scan(&admin).Error; err != nil {
		return serverError(c, "failed to login superadmin", err)
	}

	if admin.ID == "" || !admin.IsSuperAdmin {
		return unauthorized(c, "invalid superadmin credentials")
	}
	if admin.IsDisabled {
		return unauthorized(c, "superadmin account is disabled")
	}

	username := strings.TrimSpace(admin.Name)
	if username == "" {
		username = strings.TrimSpace(admin.Email)
	}
	if username == "" {
		username = superAdminUsername()
	}
	ttl := superAdminTTL
	if payload.RememberMe {
		ttl = rememberMeSessionTTL
	}
	session, err := createSession(sessionRoleSuperAdmin, nil, &admin.ID, &username, ttl, payload.RememberMe)
	if err != nil {
		return serverError(c, "failed to create superadmin session", err)
	}
	setSessionCookie(c, session)

	return success(c, fiber.StatusOK, superAdminSession{
		Username:  username,
		ExpiresAt: session.ExpiresAt,
	})
}

func Logout(c *fiber.Ctx) error {
	sessionID := strings.TrimSpace(c.Cookies(sessionCookieName))
	if sessionID != "" {
		deleteSessionByID(sessionID)
	}
	clearSessionCookie(c)
	return success(c, fiber.StatusOK, map[string]string{"message": "logged out"})
}

func ReverifyAdmin(c *fiber.Ctx) error {
	session, err := requireAdminSession(c)
	if err != nil {
		return err
	}
	var payload struct {
		Password string `json:"password"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse reverify request", err)
	}
	password := strings.TrimSpace(payload.Password)
	if password == "" {
		return invalidRequest(c, "password is required")
	}

	adminID := ""
	if session.AdminID != nil {
		adminID = strings.TrimSpace(*session.AdminID)
	}
	var credential struct {
		Password string `json:"password"`
	}
	if err := middleware.DBConn.Raw(
		`SELECT password FROM `+adminTable+` WHERE id = ?`,
		adminID,
	).Scan(&credential).Error; err != nil {
		return serverError(c, "failed to load admin credentials", err)
	}
	if strings.TrimSpace(credential.Password) == "" {
		return unauthorized(c, "invalid admin session")
	}
	matched, needsUpgrade := verifyPassword(credential.Password, password)
	if !matched {
		return unauthorized(c, "invalid credentials")
	}
	if needsUpgrade {
		if err := upgradePasswordHash(adminTable, adminID, password); err != nil {
			return serverError(c, "failed to secure admin password", err)
		}
	}

	expiresAt := utcNow().Add(reauthTTL)
	if err := middleware.DBConn.Exec(
		`UPDATE `+sessionTable+` SET reauth_expires_at = ? WHERE id = ?`,
		expiresAt, session.ID,
	).Error; err != nil {
		return serverError(c, "failed to update reauth session", err)
	}

	return success(c, fiber.StatusOK, map[string]string{"expiresAt": expiresAt.Format(time.RFC3339)})
}

func ReverifySuperAdmin(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}
	if err := ensureAdminSuperAdminColumn(); err != nil {
		return serverError(c, "failed to initialize admin access state", err)
	}
	var payload struct {
		Password string `json:"password"`
	}
	if err := parseBody(c, &payload); err != nil {
		return parseError(c, "failed to parse reverify request", err)
	}
	password := strings.TrimSpace(payload.Password)
	if password == "" {
		return invalidRequest(c, "password is required")
	}

	adminID := ""
	if session.AdminID != nil {
		adminID = strings.TrimSpace(*session.AdminID)
	}
	if adminID != "" {
		var credential struct {
			Password string `json:"password"`
		}
		if err := middleware.DBConn.Raw(
			`SELECT password FROM `+adminTable+` WHERE id = ? AND COALESCE(is_superadmin, FALSE) = TRUE`,
			adminID,
		).Scan(&credential).Error; err != nil {
			return serverError(c, "failed to load superadmin credentials", err)
		}
		if strings.TrimSpace(credential.Password) == "" {
			return unauthorized(c, "invalid superadmin session")
		}
		matched, needsUpgrade := verifyPassword(credential.Password, password)
		if !matched {
			return unauthorized(c, "invalid credentials")
		}
		if needsUpgrade {
			if err := upgradePasswordHash(adminTable, adminID, password); err != nil {
				return serverError(c, "failed to secure superadmin password", err)
			}
		}
	} else if password != superAdminPassword() {
		return unauthorized(c, "invalid credentials")
	}

	expiresAt := utcNow().Add(reauthTTL)
	if err := middleware.DBConn.Exec(
		`UPDATE `+sessionTable+` SET reauth_expires_at = ? WHERE id = ?`,
		expiresAt, session.ID,
	).Error; err != nil {
		return serverError(c, "failed to update reauth session", err)
	}

	return success(c, fiber.StatusOK, map[string]string{"expiresAt": expiresAt.Format(time.RFC3339)})
}

func GetSessionInfo(c *fiber.Ctx) error {
	sessionID := strings.TrimSpace(c.Cookies(sessionCookieName))
	if sessionID == "" {
		return unauthorized(c, "session is required")
	}

	session, err := fetchSessionByID(sessionID)
	if err != nil {
		return serverError(c, "failed to load session", err)
	}
	if session.ID == "" {
		return unauthorized(c, "invalid session")
	}
	if utcNow().After(session.ExpiresAt) {
		deleteSessionByID(session.ID)
		clearSessionCookie(c)
		return unauthorized(c, "session expired")
	}
	if session.Role == sessionRoleSuperAdmin && utcNow().Sub(session.LastActivityAt) >= superAdminIdleTimeout {
		deleteSessionByID(session.ID)
		clearSessionCookie(c)
		return unauthorized(c, "session expired")
	}

	return success(c, fiber.StatusOK, map[string]any{
		"role":           session.Role,
		"userId":         session.UserID,
		"adminId":        session.AdminID,
		"lastActivityAt": session.LastActivityAt,
		"expiresAt":      session.ExpiresAt,
	})
}

func PingSuperAdminSession(c *fiber.Ctx) error {
	session, err := requireSuperAdminSession(c)
	if err != nil {
		return err
	}

	return success(c, fiber.StatusOK, map[string]any{
		"role":           session.Role,
		"adminId":        session.AdminID,
		"lastActivityAt": session.LastActivityAt,
		"expiresAt":      session.ExpiresAt,
	})
}

func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func verifyPassword(storedPassword string, plainPassword string) (matched bool, needsUpgrade bool) {
	stored := strings.TrimSpace(storedPassword)
	if stored == "" {
		return false, false
	}
	if strings.HasPrefix(stored, "$2a$") || strings.HasPrefix(stored, "$2b$") || strings.HasPrefix(stored, "$2y$") {
		return bcrypt.CompareHashAndPassword([]byte(stored), []byte(plainPassword)) == nil, false
	}
	return stored == plainPassword, stored == plainPassword
}

func upgradePasswordHash(table string, id string, plainPassword string) error {
	hashedPassword, err := hashPassword(plainPassword)
	if err != nil {
		return err
	}
	return middleware.DBConn.Exec(
		`UPDATE `+table+` SET password = ?, updated_at = ? WHERE id = ?`,
		hashedPassword,
		utcNow(),
		id,
	).Error
}
