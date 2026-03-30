package model

type (
	SampleModel struct {
		Name string `json:"name"`
	}

	// User represents a registered user
	User struct {
		ID        string `json:"id" gorm:"column:id;primaryKey"`
		FirstName string `json:"firstName" gorm:"column:first_name"`
		LastName  string `json:"lastName" gorm:"column:last_name"`
		Name      string `json:"name" gorm:"column:name;<-:false"`
		Email     string `json:"email" gorm:"column:email"`
		Password  string `json:"-" gorm:"column:password"`
		CreatedAt string `json:"createdAt" gorm:"column:created_at"`
	}

	// Admin represents a registered admin account
	Admin struct {
		ID           string `json:"id" gorm:"column:id;primaryKey"`
		FirstName    string `json:"firstName" gorm:"column:first_name"`
		LastName     string `json:"lastName" gorm:"column:last_name"`
		Name         string `json:"name" gorm:"column:name;<-:false"`
		Email        string `json:"email" gorm:"column:email"`
		Password     string `json:"-" gorm:"column:password"`
		Unit         string `json:"unit" gorm:"column:unit"`
		IsDisabled   bool   `json:"isDisabled" gorm:"column:is_disabled"`
		IsSuperAdmin bool   `json:"isSuperAdmin" gorm:"column:is_superadmin"`
		CreatedAt    string `json:"createdAt" gorm:"column:created_at"`
		UpdatedAt    string `json:"updatedAt" gorm:"column:updated_at"`
	}

	// Feedback represents a submitted feedback entry
	Feedback struct {
		ID          string  `json:"id" gorm:"column:id;primaryKey"`
		Type        string  `json:"type" gorm:"column:type"`
		Category    string  `json:"category" gorm:"column:category"`
		Subject     string  `json:"subject" gorm:"column:subject"`
		Message     string  `json:"message" gorm:"column:message"`
		Status      string  `json:"status" gorm:"column:status"`
		Priority    string  `json:"priority" gorm:"column:priority"`
		UserID      *string `json:"userId" gorm:"column:user_id"`
		UserName    string  `json:"userName" gorm:"column:user_name"`
		IsAnonymous bool    `json:"isAnonymous" gorm:"column:is_anonymous"`
		Response    string  `json:"response" gorm:"column:response"`
		CreatedAt   string  `json:"createdAt" gorm:"column:created_at"`
		UpdatedAt   string  `json:"updatedAt" gorm:"column:updated_at"`
	}

	// Request models
	RegisterUserRequest struct {
		FirstName     string `json:"firstName"`
		LastName      string `json:"lastName"`
		Email         string `json:"email"`
		Password      string `json:"password"`
		TermsAccepted bool   `json:"termsAccepted"`
	}

	RegisterAdminRequest struct {
		AdminKey  string `json:"adminKey"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		Unit      string `json:"unit"`
	}

	LoginRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	ChangeUserPasswordRequest struct {
		Email           string `json:"email"`
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	FeedbackRequest struct {
		Type        string `json:"type"`
		Category    string `json:"category"`
		Priority    string `json:"priority"`
		Subject     string `json:"subject"`
		Message     string `json:"message"`
		UserID      string `json:"userId"`
		UserName    string `json:"userName"`
		IsAnonymous bool   `json:"isAnonymous"`
	}

	FeedbackModerationRequest struct {
		Subject string `json:"subject"`
		Message string `json:"message"`
	}

	ForgotPasswordRequest struct {
		Email string `json:"email"`
	}

	VerifyResetOTPRequest struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}

	ResetPasswordRequest struct {
		Email       string `json:"email"`
		NewPassword string `json:"newPassword"`
	}

	UpdateFeedbackRequest struct {
		Status   string `json:"status"`
		Priority string `json:"priority"`
		Response string `json:"response"`
	}

	// Category represents a feedback/unit category managed by the superadmin
	Category struct {
		ID   int    `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
		Name string `json:"name" gorm:"column:name"`
	}

	Session struct {
		ID                 string  `json:"id" gorm:"column:id;primaryKey"`
		Role               string  `json:"role" gorm:"column:role"`
		UserID             *string `json:"userId,omitempty" gorm:"column:user_id"`
		AdminID            *string `json:"adminId,omitempty" gorm:"column:admin_id"`
		SuperadminUsername *string `json:"superadminUsername,omitempty" gorm:"column:superadmin_username"`
		CreatedAt          string  `json:"createdAt" gorm:"column:created_at"`
		LastActivityAt     string  `json:"lastActivityAt" gorm:"column:last_activity_at"`
		ExpiresAt          string  `json:"expiresAt" gorm:"column:expires_at"`
		ReauthExpiresAt    *string `json:"reauthExpiresAt,omitempty" gorm:"column:reauth_expires_at"`
	}
)
