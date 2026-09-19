package controllers

import (
	"net/http"

	"live-polling-backend/database"
	"live-polling-backend/models"
	"live-polling-backend/websocket"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type GameController struct{}

func NewGameController() *GameController {
	return &GameController{}
}

// Public: Get global platform leaderboard
func (gc *GameController) GetGlobalLeaderboard(c *gin.Context) {
	leaderboard, err := database.DB.GetGlobalLeaderboard(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard"})
		return
	}

	// If user is authenticated, mark is_you
	if userIDHex, exists := c.Get("userID"); exists {
		if uID, err := primitive.ObjectIDFromHex(userIDHex.(string)); err == nil {
			if u, err := database.DB.GetUserByID(c.Request.Context(), uID); err == nil && u != nil {
				for i := range leaderboard {
					if leaderboard[i].Username == u.Username {
						leaderboard[i].IsYou = true
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, leaderboard)
}

// Public: Get game-specific leaderboard
func (gc *GameController) GetGameLeaderboard(c *gin.Context) {
	gameName := c.DefaultQuery("game", "color_match")
	leaderboard, err := database.DB.GetGameLeaderboard(c.Request.Context(), gameName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch game leaderboard"})
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}

// Authenticated: Submit a game score (Color Match or Snake Classic)
func (gc *GameController) SubmitScore(c *gin.Context) {
	userIDHex, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required. Please sign in to save your game score."})
		return
	}

	userID, err := primitive.ObjectIDFromHex(userIDHex.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user account"})
		return
	}

	username, _ := c.Get("username")

	var req models.SubmitGameScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid game score submission"})
		return
	}

	score := models.GameScore{
		UserID:   userID,
		Username: username.(string),
		GameName: req.GameName,
		Score:    req.Score,
		Accuracy: req.Accuracy,
	}

	if err := database.DB.RecordGameScore(c.Request.Context(), &score); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record game score"})
		return
	}

	// Broadcast live score update via WebSocket
	websocket.BroadcastEvent("game_score", gin.H{
		"game_name": req.GameName,
		"username":  username,
		"score":     req.Score,
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Game score recorded successfully",
		"score":   score,
	})
}
