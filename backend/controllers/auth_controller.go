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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	cleanUsername := strings.TrimSpace(req.Username)

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Username, user.Role, a.jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func (a *AuthController) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

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

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  *user,
	})
}

// Exclusive Admin Login Endpoint
func (a *AuthController) AdminLogin(c *gin.Context) {
	var req models.AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Designate swetha4110@gmail.com with password segu7624 as the sole admin account
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

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  *adminUser,
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

	c.JSON(http.StatusOK, user)
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
