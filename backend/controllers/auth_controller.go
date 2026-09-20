package controllers

import (
	"net/http"
	"strings"

	"live-polling-backend/database"
	"live-polling-backend/middleware"
	"live-polling-backend/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

type AuthController struct {
	jwtSecret string
}

func NewAuthController(jwtSecret string) *AuthController {
	return &AuthController{jwtSecret: jwtSecret}
}

func (a *AuthController) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid registration request parameters"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	cleanUsername := strings.TrimSpace(req.Username)

	// Strictly reject any demo voter or demo accounts
	if cleanEmail == "voter@voxentra.com" ||
		strings.Contains(cleanEmail, "demo") ||
		strings.Contains(strings.ToLower(cleanUsername), "demo") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Demo voter accounts are permanently disabled"})
		return
	}

	// Check if email already registered
	existingUser, _ := database.DB.GetUserByEmail(c.Request.Context(), cleanEmail)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An account with this email address already exists. Please login instead."})
		return
	}

	// Restrict admin email from standard registration
	if cleanEmail == "swetha4110@gmail.com" {
		c.JSON(http.StatusForbidden, gin.H{"error": "This email address is reserved for administrative services."})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to securely hash credentials"})
		return
	}

	user := models.User{
		Username:     cleanUsername,
		Email:        cleanEmail,
		PasswordHash: string(hashedPassword),
		Role:         "user",
		Points:       50, // Welcome bonus points!
		Avatar:       "https://api.dicebear.com/7.x/identicon/svg?seed=" + cleanUsername,
	}

	if err := database.DB.CreateUser(c.Request.Context(), &user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user account"})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Username, user.Role, a.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	// Strictly zero out PasswordHash before returning
	userSafe := user
	userSafe.PasswordHash = ""

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  userSafe,
	})
}

func (a *AuthController) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or password format"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Explicitly reject any demo voter account attempts
	if cleanEmail == "voter@voxentra.com" || strings.Contains(cleanEmail, "demo") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	user, err := database.DB.GetUserByEmail(c.Request.Context(), cleanEmail)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Username, user.Role, a.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Strictly zero out PasswordHash before returning
	userSafe := *user
	userSafe.PasswordHash = ""

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  userSafe,
	})
}

// Exclusive Admin Login Endpoint
func (a *AuthController) AdminLogin(c *gin.Context) {
	var req models.AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid administrator login credentials"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Designate swetha4110@gmail.com as the sole admin account
	if cleanEmail != "swetha4110@gmail.com" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Access denied: Unauthorized administrator credentials"})
		return
	}

	adminUser, err := database.DB.GetUserByEmail(c.Request.Context(), cleanEmail)
	if err != nil || adminUser == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Administrator account not configured"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(adminUser.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid administrator security credentials"})
		return
	}

	token, err := middleware.GenerateToken(adminUser.ID, adminUser.Username, "admin", a.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate administrative token"})
		return
	}

	// Strictly zero out PasswordHash before returning
	adminSafe := *adminUser
	adminSafe.PasswordHash = ""

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  adminSafe,
	})
}

func (a *AuthController) GetMe(c *gin.Context) {
	userIDHex, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	objID, err := primitive.ObjectIDFromHex(userIDHex.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := database.DB.GetUserByID(c.Request.Context(), objID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	userSafe := *user
	userSafe.PasswordHash = ""

	c.JSON(http.StatusOK, userSafe)
}

func (a *AuthController) ResetPassword(c *gin.Context) {
	var req models.PasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid password reset request parameters"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Strict Protection: Admin password can NEVER be reset or revealed through public reset interfaces
	if cleanEmail == "swetha4110@gmail.com" {
		c.JSON(http.StatusOK, models.PasswordResetResponse{
			Status:  "masked",
			Message: "If an eligible account exists, a secure verification token has been processed. Administrator credentials cannot be accessed or reset via public interfaces.",
			Masked:  "••••••••••••",
		})
		return
	}

	// Strictly block demo voter or demo accounts
	if cleanEmail == "voter@voxentra.com" || strings.Contains(cleanEmail, "demo") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Demo voter accounts cannot be reset"})
		return
	}

	cleanToken := strings.TrimSpace(req.Token)
	if len(cleanToken) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset verification token"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to securely process credentials"})
		return
	}

	if err := database.DB.ResetUserPassword(c.Request.Context(), cleanEmail, string(hashedPassword)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found or ineligible for reset"})
		return
	}

	c.JSON(http.StatusOK, models.PasswordResetResponse{
		Status:  "success",
		Message: "Password has been successfully updated. Please sign in with your new credentials.",
		Masked:  "••••••••••••",
	})
}

func (a *AuthController) GetUserDashboard(c *gin.Context) {
	userIDHex, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	objID, err := primitive.ObjectIDFromHex(userIDHex.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	dashData, err := database.DB.GetUserDashboardData(c.Request.Context(), objID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load dashboard data"})
		return
	}

	c.JSON(http.StatusOK, dashData)
}
