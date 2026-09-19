package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"live-polling-backend/database"
	"live-polling-backend/models"
	"live-polling-backend/websocket"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollController struct{}

func NewPollController() *PollController {
	return &PollController{}
}

// Public: Get all active/recent polls
func (p *PollController) GetPolls(c *gin.Context) {
	polls, err := database.DB.GetPolls(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch polls"})
		return
	}

	c.JSON(http.StatusOK, polls)
}

// Public: Get currently active poll
func (p *PollController) GetActivePoll(c *gin.Context) {
	polls, err := database.DB.GetPolls(c.Request.Context())
	if err != nil || len(polls) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active poll found"})
		return
	}

	var activePoll *models.Poll
	for i := range polls {
		if polls[i].IsActive && polls[i].Status != "archived" && polls[i].Status != "ended" {
			activePoll = &polls[i]
			break
		}
	}
	if activePoll == nil && len(polls) > 0 {
		activePoll = &polls[0]
	}

	c.JSON(http.StatusOK, gin.H{
		"poll": activePoll,
	})
}

// Public / Authenticated: Get single poll details + whether current user has voted
func (p *PollController) GetPoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	poll, err := database.DB.GetPollByID(c.Request.Context(), pollID)
	if err != nil || poll == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	// Increment views
	_ = database.DB.IncrementPollViews(c.Request.Context(), pollID)

	hasVoted := false
	votedOptionID := ""

	// If user is authenticated, check if they have already cast a vote
	if userIDHex, exists := c.Get("userID"); exists {
		if uID, err := primitive.ObjectIDFromHex(userIDHex.(string)); err == nil {
			hasVoted, votedOptionID, _ = database.DB.HasUserVoted(c.Request.Context(), uID, pollID)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"poll":            poll,
		"has_voted":       hasVoted,
		"voted_option_id": votedOptionID,
	})
}

// Public / Authenticated: Upvote or Downvote Question
func (p *PollController) ReactToPoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	var req models.PollReactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upvotes, downvotes, err := database.DB.RecordPollReaction(c.Request.Context(), pollID, req.Type)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upvotes":   upvotes,
		"downvotes": downvotes,
		"type":      req.Type,
	})
}

// Mandatory Authenticated Action: Submit a Vote
func (p *PollController) Vote(c *gin.Context) {
	userIDHex, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required. You must register or log in before voting."})
		return
	}

	userID, err := primitive.ObjectIDFromHex(userIDHex.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user account"})
		return
	}

	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	var req models.VoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify a valid option"})
		return
	}

	update, err := database.DB.RecordVote(c.Request.Context(), userID, pollID, req.OptionID, req.ReferralSource)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Broadcast live vote update via WebSockets to all connected participants
	websocket.BroadcastPollUpdate(update)

	c.JSON(http.StatusOK, gin.H{
		"message": "Vote recorded successfully",
		"update":  update,
	})
}

// Track Referral Clicks
func (p *PollController) TrackReferral(c *gin.Context) {
	source := strings.ToLower(strings.TrimSpace(c.Param("source")))
	if source != "" {
		_ = database.DB.RecordReferralClick(c.Request.Context(), source)
	}
	c.JSON(http.StatusOK, gin.H{"status": "tracked"})
}

// ADMIN EXCLUSIVE: Create Poll
func (p *PollController) AdminCreatePoll(c *gin.Context) {
	userIDHex, _ := c.Get("userID")
	username, _ := c.Get("username")

	creatorID, _ := primitive.ObjectIDFromHex(userIDHex.(string))

	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uniqueOpts := make(map[string]bool)
	var options []models.PollOption

	for i, optText := range req.Options {
		trimmed := strings.TrimSpace(optText)
		if trimmed == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Options cannot be empty"})
			return
		}
		lower := strings.ToLower(trimmed)
		if uniqueOpts[lower] {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Duplicate option: '%s'", trimmed)})
			return
		}
		uniqueOpts[lower] = true

		options = append(options, models.PollOption{
			ID:         fmt.Sprintf("opt_%d", i+1),
			Text:       trimmed,
			Votes:      0,
			Percentage: 0,
		})
	}

	category := req.Category
	if category == "" {
		category = "General"
	}

	minP := req.MinParticipants
	if minP < 0 {
		minP = 0
	}
	maxP := req.MaxParticipants
	if maxP < 0 {
		maxP = 0
	}
	if maxP > 0 && maxP < minP {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maximum participants cannot be less than minimum participants"})
		return
	}

	entryReq := strings.TrimSpace(req.EntryRequirement)
	if entryReq == "" {
		entryReq = "Free / Open to All"
	}

	rewardStruct := strings.TrimSpace(req.RewardStructure)
	if rewardStruct == "" {
		rewardStruct = "Winner Takes All XP"
	}

	duration := req.DurationMinutes
	if duration != 0 && (duration < 25 || duration > 120) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll duration must be between 25 minutes and 2 hours (120 minutes)"})
		return
	}
	if duration == 0 {
		duration = 60
	}

	poll := models.Poll{
		CreatorID:        creatorID,
		CreatorName:      username.(string),
		Title:            strings.TrimSpace(req.Title),
		Description:      strings.TrimSpace(req.Description),
		Category:         category,
		Options:          options,
		DurationMinutes:  duration,
		MinParticipants:  minP,
		MaxParticipants:  maxP,
		EntryRequirement: entryReq,
		RewardStructure:  rewardStruct,
		Status:           "active",
	}

	if err := database.DB.CreatePoll(c.Request.Context(), &poll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create pool"})
		return
	}

	c.JSON(http.StatusCreated, poll)
}

// ADMIN EXCLUSIVE: Edit / Update Poll
func (p *PollController) AdminUpdatePoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	var req models.UpdatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing, err := database.DB.GetPollByID(c.Request.Context(), pollID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	existing.Title = strings.TrimSpace(req.Title)
	existing.Description = strings.TrimSpace(req.Description)
	if req.Category != "" {
		existing.Category = req.Category
	}
	if req.DurationMinutes > 0 {
		if req.DurationMinutes < 25 || req.DurationMinutes > 120 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Poll duration must be between 25 minutes and 2 hours (120 minutes)"})
			return
		}
		existing.DurationMinutes = req.DurationMinutes
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
		if *req.IsActive {
			existing.Status = "active"
		} else {
			existing.Status = "paused"
		}
	}

	if len(req.Options) >= 2 {
		var updatedOptions []models.PollOption
		for i, optText := range req.Options {
			optID := fmt.Sprintf("opt_%d", i+1)
			var oldVotes int64 = 0
			for _, oldOpt := range existing.Options {
				if oldOpt.Text == optText || oldOpt.ID == optID {
					oldVotes = oldOpt.Votes
					break
				}
			}
			updatedOptions = append(updatedOptions, models.PollOption{
				ID:    optID,
				Text:  optText,
				Votes: oldVotes,
			})
		}
		existing.Options = updatedOptions
	}

	if err := database.DB.UpdatePoll(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update poll"})
		return
	}

	websocket.BroadcastEvent("poll_update", existing)

	c.JSON(http.StatusOK, existing)
}

// ADMIN EXCLUSIVE: Delete / Archive Poll (Soft Delete)
func (p *PollController) AdminDeletePoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	if err := database.DB.DeletePoll(c.Request.Context(), pollID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to archive poll"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll archived successfully"})
}

// ADMIN EXCLUSIVE: Permanent Delete Poll
func (p *PollController) AdminPermanentDeletePoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	if err := database.DB.PermanentDeletePoll(c.Request.Context(), pollID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete poll"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll permanently removed"})
}

// ADMIN EXCLUSIVE: Pause Poll
func (p *PollController) AdminPausePoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	if err := database.DB.PausePoll(c.Request.Context(), pollID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll paused", "status": "paused"})
}

// ADMIN EXCLUSIVE: Resume Poll
func (p *PollController) AdminResumePoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	if err := database.DB.ResumePoll(c.Request.Context(), pollID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll resumed", "status": "active"})
}

// ADMIN EXCLUSIVE: End Poll
func (p *PollController) AdminEndPoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	if err := database.DB.EndPoll(c.Request.Context(), pollID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll ended", "status": "ended"})
}

// ADMIN EXCLUSIVE: Open / Close Poll Manually
func (p *PollController) AdminTogglePoll(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	isActive, err := database.DB.TogglePollStatus(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Poll status toggled",
		"is_active": isActive,
	})
}

// ADMIN EXCLUSIVE: Analytics Dashboard
func (p *PollController) AdminGetAnalytics(c *gin.Context) {
	analytics, err := database.DB.GetAdminAnalytics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch analytics"})
		return
	}

	c.JSON(http.StatusOK, analytics)
}
