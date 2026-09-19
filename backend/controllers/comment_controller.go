package controllers

import (
	"net/http"
	"strings"

	"live-polling-backend/database"
	"live-polling-backend/models"
	"live-polling-backend/websocket"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type CommentController struct{}

func NewCommentController() *CommentController {
	return &CommentController{}
}

// Public: Get comments for a poll or game
func (cc *CommentController) GetComments(c *gin.Context) {
	targetID := c.DefaultQuery("target_id", "global")
	comments, err := database.DB.GetComments(c.Request.Context(), targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch commentary"})
		return
	}

	c.JSON(http.StatusOK, comments)
}

// Authenticated: Post a new comment
func (cc *CommentController) PostComment(c *gin.Context) {
	userIDHex, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required. Please sign in to join the conversation."})
		return
	}

	username, _ := c.Get("username")
	var req models.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment text cannot be empty"})
		return
	}

	cleanContent := strings.TrimSpace(req.Content)
	if cleanContent == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment content cannot be empty"})
		return
	}

	avatar := "https://api.dicebear.com/7.x/identicon/svg?seed=" + username.(string)
	if uID, err := primitive.ObjectIDFromHex(userIDHex.(string)); err == nil {
		if u, err := database.DB.GetUserByID(c.Request.Context(), uID); err == nil && u != nil && u.Avatar != "" {
			avatar = u.Avatar
		}
	}

	comment := models.Comment{
		TargetID: req.TargetID,
		UserID:   userIDHex.(string),
		Username: username.(string),
		Avatar:   avatar,
		Content:  cleanContent,
	}

	if err := database.DB.AddComment(c.Request.Context(), &comment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to post comment"})
		return
	}

	// Broadcast live commentary over WebSockets
	websocket.BroadcastCommentUpdate(&models.LiveCommentUpdate{
		Type:    "comment_add",
		Comment: comment,
	})

	c.JSON(http.StatusCreated, comment)
}

// ADMIN EXCLUSIVE: Moderate / Remove Inappropriate Comment
func (cc *CommentController) AdminDeleteComment(c *gin.Context) {
	commentID := c.Param("id")
	if commentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment ID required"})
		return
	}

	if err := database.DB.DeleteComment(c.Request.Context(), commentID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Broadcast live comment deletion to all participants
	websocket.BroadcastCommentUpdate(&models.LiveCommentUpdate{
		Type: "comment_delete",
		Comment: models.Comment{
			ID: commentID,
		},
	})

	c.JSON(http.StatusOK, gin.H{"message": "Comment removed by administrator"})
}

// ADMIN EXCLUSIVE: Get all comments across the entire platform
func (cc *CommentController) AdminGetAllComments(c *gin.Context) {
	comments, err := database.DB.GetAllComments(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch moderation stream"})
		return
	}

	c.JSON(http.StatusOK, comments)
}
