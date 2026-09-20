package controllers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

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

	// Result Visibility & Privacy Enforcement
	isAdmin := false
	if role, exists := c.Get("role"); exists && role == "admin" {
		isAdmin = true
	}

	// Make a shallow copy of poll to avoid altering cache
	pollCopy := *poll
	pollCopy.Options = make([]models.PollOption, len(poll.Options))
	copy(pollCopy.Options, poll.Options)

	shouldHideResults := false
	revealCondition := ""

	if !isAdmin {
		switch pollCopy.ResultVisibility {
		case "after_vote":
			if !hasVoted {
				shouldHideResults = true
				revealCondition = "Results will be revealed immediately after you submit your ballot."
			}
		case "after_close":
			if pollCopy.IsActive && (pollCopy.TimerEnd == nil || time.Now().Before(*pollCopy.TimerEnd)) {
				shouldHideResults = true
				revealCondition = "Results will be disclosed when this voting session officially closes."
			}
		case "never":
			shouldHideResults = true
			revealCondition = "Results for this confidential poll are restricted to administrators."
		}
	}

	if shouldHideResults {
		pollCopy.ResultsHidden = true
		pollCopy.ResultsRevealCondition = revealCondition
		pollCopy.TotalVotes = 0
		for i := range pollCopy.Options {
			pollCopy.Options[i].Votes = 0
			pollCopy.Options[i].Percentage = 0
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"poll":            pollCopy,
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

// Mandatory Authenticated Action: Submit a Vote (Single or Multi-Option)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify your option choice(s)"})
		return
	}

	update, err := database.DB.RecordVote(c.Request.Context(), userID, pollID, req.OptionID, req.OptionIDs, req.ReferralSource)
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
	role, exists := c.Get("role")
	if !exists || role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Only administrators can create or edit poll questions"})
		return
	}

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
	if duration == 0 {
		duration = 60
	}

	isEscalated := false
	escalationReason := ""

	if duration < 25 || duration > 120 {
		if req.EscalationCode == "VOXENTRA_OVERRIDE_AUTH" && strings.TrimSpace(req.EscalationReason) != "" {
			isEscalated = true
			escalationReason = strings.TrimSpace(req.EscalationReason)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Poll duration must be between 25 minutes and 2 hours (120 minutes). Override requires authorization code and business justification.",
			})
			return
		}
	}

	selectionType := req.SelectionType
	if selectionType != "multiple" {
		selectionType = "single"
	}

	maxSelections := req.MaxSelections
	if selectionType == "multiple" {
		if maxSelections <= 1 {
			maxSelections = 2
		}
		if maxSelections > len(options) {
			maxSelections = len(options)
		}
	} else {
		maxSelections = 1
	}

	visibility := req.Visibility
	if visibility != "restricted" && visibility != "private" {
		visibility = "public"
	}

	resultVisibility := req.ResultVisibility
	if resultVisibility != "after_vote" && resultVisibility != "after_close" && resultVisibility != "never" {
		resultVisibility = "realtime"
	}

	tz := strings.TrimSpace(req.Timezone)
	if tz == "" {
		tz = "UTC"
	}

	now := time.Now().UTC()
	timerEnd := now.Add(time.Duration(duration) * time.Minute)

	adminNameStr := "Admin"
	if username != nil {
		adminNameStr = username.(string)
	}

	poll := models.Poll{
		CreatorID:         creatorID,
		CreatorName:       adminNameStr,
		Title:             strings.TrimSpace(req.Title),
		Description:       strings.TrimSpace(req.Description),
		Category:          category,
		Options:           options,
		DurationMinutes:   duration,
		MinParticipants:   minP,
		MaxParticipants:   maxP,
		EntryRequirement:  entryReq,
		RewardStructure:   rewardStruct,
		SelectionType:     selectionType,
		MaxSelections:     maxSelections,
		Visibility:        visibility,
		AllowedUserGroups: req.AllowedUserGroups,
		ResultVisibility:  resultVisibility,
		Timezone:          tz,
		IsEscalated:       isEscalated,
		EscalationReason:  escalationReason,
		Status:            "active",
		IsActive:          true,
		TimerStart:        &now,
		TimerEnd:          &timerEnd,
	}

	if err := database.DB.CreatePoll(c.Request.Context(), &poll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create pool"})
		return
	}

	// Record Audit Log
	_ = database.DB.RecordAuditLog(c.Request.Context(), &models.AuditLog{
		PollID:           poll.ID,
		AdminID:          creatorID,
		AdminName:        adminNameStr,
		Action:           "create_poll",
		Details:          fmt.Sprintf("Poll created with %d options, duration: %dm (%s), visibility: %s, selection: %s", len(options), duration, poll.Timezone, poll.Visibility, poll.SelectionType),
		NewValue:         fmt.Sprintf("%dm", duration),
		IsEscalated:      isEscalated,
		EscalationReason: escalationReason,
	})

	c.JSON(http.StatusCreated, poll)
}

// ADMIN EXCLUSIVE: Edit / Update Poll
func (p *PollController) AdminUpdatePoll(c *gin.Context) {
	role, exists := c.Get("role")
	if !exists || role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: Only administrators can create or edit poll questions"})
		return
	}

	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	userIDHex, _ := c.Get("userID")
	username, _ := c.Get("username")
	adminID, _ := primitive.ObjectIDFromHex(userIDHex.(string))
	adminNameStr := "Admin"
	if username != nil {
		adminNameStr = username.(string)
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

	var auditDetails []string

	// 1. Basic Details
	if req.Title != "" && req.Title != existing.Title {
		auditDetails = append(auditDetails, fmt.Sprintf("Title changed from '%s' to '%s'", existing.Title, req.Title))
		existing.Title = strings.TrimSpace(req.Title)
	}
	if req.Description != "" && req.Description != existing.Description {
		auditDetails = append(auditDetails, "Description updated")
		existing.Description = strings.TrimSpace(req.Description)
	}
	if req.Category != "" && req.Category != existing.Category {
		auditDetails = append(auditDetails, fmt.Sprintf("Category changed to '%s'", req.Category))
		existing.Category = req.Category
	}

	// 2. Settings: Selection Type & Max Selections
	if req.SelectionType != "" && req.SelectionType != existing.SelectionType {
		if existing.TotalVotes > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Selection type cannot be changed after voting has commenced"})
			return
		}
		auditDetails = append(auditDetails, fmt.Sprintf("Selection type changed from '%s' to '%s'", existing.SelectionType, req.SelectionType))
		existing.SelectionType = req.SelectionType
	}
	if req.MaxSelections > 0 && req.MaxSelections != existing.MaxSelections {
		auditDetails = append(auditDetails, fmt.Sprintf("Max selections changed from %d to %d", existing.MaxSelections, req.MaxSelections))
		existing.MaxSelections = req.MaxSelections
	}

	// 3. Visibility & Allowed User Groups
	if req.Visibility != "" && req.Visibility != existing.Visibility {
		auditDetails = append(auditDetails, fmt.Sprintf("Visibility changed from '%s' to '%s'", existing.Visibility, req.Visibility))
		existing.Visibility = req.Visibility
	}
	if req.AllowedUserGroups != nil {
		existing.AllowedUserGroups = req.AllowedUserGroups
		auditDetails = append(auditDetails, "Allowed user groups updated")
	}

	// 4. Result Visibility
	if req.ResultVisibility != "" && req.ResultVisibility != existing.ResultVisibility {
		auditDetails = append(auditDetails, fmt.Sprintf("Result visibility changed from '%s' to '%s'", existing.ResultVisibility, req.ResultVisibility))
		existing.ResultVisibility = req.ResultVisibility
	}

	// 5. Timezone
	if req.Timezone != "" && req.Timezone != existing.Timezone {
		existing.Timezone = req.Timezone
		auditDetails = append(auditDetails, fmt.Sprintf("Timezone set to %s", req.Timezone))
	}

	// 6. Option Editing Guard (Zero-vote constraint)
	if len(req.Options) > 0 {
		optionsChanged := false
		if len(req.Options) != len(existing.Options) {
			optionsChanged = true
		} else {
			for i, opt := range req.Options {
				if strings.TrimSpace(opt) != existing.Options[i].Text {
					optionsChanged = true
					break
				}
			}
		}

		if optionsChanged {
			if existing.TotalVotes > 0 {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("Answer options cannot be modified after voting has commenced. Total votes recorded: %d", existing.TotalVotes),
				})
				return
			}

			if len(req.Options) < 2 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "A poll must have at least 2 options"})
				return
			}

			uniqueOpts := make(map[string]bool)
			var updatedOptions []models.PollOption
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
				updatedOptions = append(updatedOptions, models.PollOption{
					ID:         fmt.Sprintf("opt_%d", i+1),
					Text:       trimmed,
					Votes:      0,
					Percentage: 0,
				})
			}
			existing.Options = updatedOptions
			auditDetails = append(auditDetails, fmt.Sprintf("Options modified (%d options)", len(updatedOptions)))
		}
	}

	// 7. Duration Modification & Active Poll Countdown Recalculation
	isEscalated := false
	escalationReason := ""
	if req.DurationMinutes > 0 && req.DurationMinutes != existing.DurationMinutes {
		oldDur := existing.DurationMinutes
		newDur := req.DurationMinutes

		// Hard constraint: 25 to 120 minutes, unless valid escalation
		if newDur < 25 || newDur > 120 {
			if req.EscalationCode == "VOXENTRA_OVERRIDE_AUTH" && strings.TrimSpace(req.EscalationReason) != "" {
				isEscalated = true
				escalationReason = strings.TrimSpace(req.EscalationReason)
				existing.IsEscalated = true
				existing.EscalationReason = escalationReason
			} else {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Poll duration must be between 25 minutes and 2 hours (120 minutes). Override requires authorization code and business justification.",
				})
				return
			}
		}

		// Active Poll Recalculation Check: cannot shorten below elapsed time
		if existing.TimerStart != nil {
			elapsedMinutes := time.Since(*existing.TimerStart).Minutes()
			if float64(newDur) < elapsedMinutes {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("Duration (%d min) cannot be shorter than time already elapsed (%.1f min)", newDur, elapsedMinutes),
				})
				return
			}
			// Adjust countdown timer end dynamically
			newEnd := existing.TimerStart.Add(time.Duration(newDur) * time.Minute)
			existing.TimerEnd = &newEnd
		}

		existing.DurationMinutes = newDur
		auditDetails = append(auditDetails, fmt.Sprintf("Duration changed from %dm to %dm", oldDur, newDur))

		// Log duration change specifically
		_ = database.DB.RecordAuditLog(c.Request.Context(), &models.AuditLog{
			PollID:           existing.ID,
			AdminID:          adminID,
			AdminName:        adminNameStr,
			Action:           "duration_change",
			Details:          fmt.Sprintf("Duration adjusted from %dm to %dm", oldDur, newDur),
			OldValue:         fmt.Sprintf("%dm", oldDur),
			NewValue:         fmt.Sprintf("%dm", newDur),
			IsEscalated:      isEscalated,
			EscalationReason: escalationReason,
		})
	}

	// 8. Active/Pause Status
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
		if *req.IsActive {
			existing.Status = "active"
		} else {
			existing.Status = "paused"
		}
		auditDetails = append(auditDetails, fmt.Sprintf("Status set to %s", existing.Status))
	}

	if err := database.DB.UpdatePoll(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// General audit log if other settings changed
	if len(auditDetails) > 0 {
		_ = database.DB.RecordAuditLog(c.Request.Context(), &models.AuditLog{
			PollID:           existing.ID,
			AdminID:          adminID,
			AdminName:        adminNameStr,
			Action:           "poll_edit",
			Details:          strings.Join(auditDetails, "; "),
			IsEscalated:      isEscalated,
			EscalationReason: escalationReason,
		})
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

// ADMIN EXCLUSIVE: Get Audit Logs for a Poll
func (p *PollController) GetPollAuditLogs(c *gin.Context) {
	idHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	logs, err := database.DB.GetAuditLogsByPollID(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"audit_logs": logs,
	})
}

