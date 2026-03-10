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
		ID        string `json:"id" gorm:"column:id;primaryKey"`
		FirstName string `json:"firstName" gorm:"column:first_name"`
		LastName  string `json:"lastName" gorm:"column:last_name"`
		Name      string `json:"name" gorm:"column:name;<-:false"`
		Email     string `json:"email" gorm:"column:email"`
		Password  string `json:"-" gorm:"column:password"`
		Unit      string `json:"unit" gorm:"column:unit"`
		CreatedAt string `json:"createdAt" gorm:"column:created_at"`
		UpdatedAt string `json:"updatedAt" gorm:"column:updated_at"`
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
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Password  string `json:"password"`
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

	FeedbackRequest struct {
		Type        string `json:"type"`
		Category    string `json:"category"`
		Subject     string `json:"subject"`
		Message     string `json:"message"`
		UserID      string `json:"userId"`
		UserName    string `json:"userName"`
		IsAnonymous bool   `json:"isAnonymous"`
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
)
