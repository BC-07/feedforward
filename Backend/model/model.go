package model

import "time"

type (
	SampleModel struct {
		Name string `json:"name"`
	}

	FeedbackModel struct {
		ID          string    `json:"id" gorm:"column:id;primaryKey"`
		Type        string    `json:"type" gorm:"column:type"`
		Category    string    `json:"category" gorm:"column:category"`
		Subject     string    `json:"subject" gorm:"column:subject"`
		Message     string    `json:"message" gorm:"column:message"`
		Status      string    `json:"status" gorm:"column:status"`
		Priority    string    `json:"priority" gorm:"column:priority"`
		UserID      *string   `json:"userId" gorm:"column:user_id"`
		UserName    *string   `json:"userName" gorm:"column:user_name"`
		UserEmail   *string   `json:"userEmail" gorm:"column:user_email"`
		IsAnonymous bool      `json:"isAnonymous" gorm:"column:is_anonymous"`
		Response    *string   `json:"response" gorm:"column:response"`
		CreatedAt   time.Time `json:"createdAt" gorm:"column:created_at"`
		UpdatedAt   time.Time `json:"updatedAt" gorm:"column:updated_at"`
	}

	UserModel struct {
		ID        string    `json:"id" gorm:"column:id;primaryKey"`
		FirstName string    `json:"firstName" gorm:"column:first_name"`
		LastName  string    `json:"lastName" gorm:"column:last_name"`
		Name      string    `json:"name" gorm:"column:name;->"`
		Email     string    `json:"email" gorm:"column:email"`
		Password  string    `json:"password,omitempty" gorm:"column:password"`
		CreatedAt time.Time `json:"createdAt" gorm:"column:created_at"`
		UpdatedAt time.Time `json:"updatedAt" gorm:"column:updated_at"`
	}

	AdminModel struct {
		ID         string    `json:"id" gorm:"column:id;primaryKey"`
		FirstName  string    `json:"firstName" gorm:"column:first_name"`
		LastName   string    `json:"lastName" gorm:"column:last_name"`
		Name       string    `json:"name" gorm:"column:name;->"`
		Email      string    `json:"email" gorm:"column:email"`
		Password   string    `json:"password,omitempty" gorm:"column:password"`
		Unit       string    `json:"unit" gorm:"column:unit"`
		IsDisabled bool      `json:"isDisabled" gorm:"column:is_disabled"`
		IsSuperAdmin bool    `json:"isSuperAdmin" gorm:"column:is_superadmin"`
		CreatedAt  time.Time `json:"createdAt" gorm:"column:created_at"`
		UpdatedAt  time.Time `json:"updatedAt" gorm:"column:updated_at"`
	}

	CategoryModel struct {
		ID        int       `json:"id" gorm:"column:id;primaryKey"`
		Name      string    `json:"name" gorm:"column:name"`
		CreatedAt time.Time `json:"createdAt" gorm:"column:created_at"`
		UpdatedAt time.Time `json:"updatedAt" gorm:"column:updated_at"`
	}
)

func (FeedbackModel) TableName() string {
	return "public.feedbacks"
}

func (UserModel) TableName() string {
	return "public.users"
}

func (AdminModel) TableName() string {
	return "public.admins"
}

func (CategoryModel) TableName() string {
	return "public.categories"
}
