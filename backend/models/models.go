package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username     string             `bson:"username" json:"username"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"password_hash" json:"-"`
	Role         string             `bson:"role" json:"role"` // "admin" or "user"
	Points       int64              `bson:"points" json:"points"`
	Avatar       string             `bson:"avatar" json:"avatar"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
}

type PollOption struct {
	ID         string  `bson:"id" json:"id"`
	Text       string  `bson:"text" json:"text"`
	Votes      int64   `bson:"votes" json:"votes"`
	Percentage float64 `bson:"percentage" json:"percentage"`
}

type Poll struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatorID       primitive.ObjectID `bson:"creator_id" json:"creator_id"`
	CreatorName     string             `bson:"creator_name" json:"creator_name"`
	Title           string             `bson:"title" json:"title"`
	Description     string             `bson:"description" json:"description"`
	Category        string             `bson:"category" json:"category"`
	Options         []PollOption       `bson:"options" json:"options"`
	IsActive         bool               `bson:"is_active" json:"is_active"`
	IsArchived       bool               `bson:"is_archived" json:"is_archived"`
	Status           string             `bson:"status" json:"status"` // "active", "paused", "ended", "archived"
	MinParticipants  int                `bson:"min_participants" json:"min_participants"`
	MaxParticipants  int                `bson:"max_participants" json:"max_participants"`
	EntryRequirement string             `bson:"entry_requirement" json:"entry_requirement"`
	RewardStructure  string             `bson:"reward_structure" json:"reward_structure"`
	TotalVotes       int64              `bson:"total_votes" json:"total_votes"`
	Views            int64              `bson:"views" json:"views"`
	Upvotes          int64              `bson:"upvotes" json:"upvotes"`
	Downvotes        int64              `bson:"downvotes" json:"downvotes"`
	TimerStart       *time.Time         `bson:"timer_start,omitempty" json:"timer_start,omitempty"`
	TimerEnd         *time.Time         `bson:"timer_end,omitempty" json:"timer_end,omitempty"`
	DurationMinutes          int                `bson:"duration_minutes" json:"duration_minutes"`
	RemainingSec             int64              `bson:"-" json:"remaining_seconds"`
	SelectionType            string             `bson:"selection_type" json:"selection_type"`                       // "single" or "multiple"
	MaxSelections            int                `bson:"max_selections" json:"max_selections"`                       // Maximum options allowed in multi-selection
	Visibility               string             `bson:"visibility" json:"visibility"`                               // "public", "restricted", "private"
	AllowedUserGroups        []string           `bson:"allowed_user_groups" json:"allowed_user_groups"`             // e.g. ["all"], ["verified"], ["vip"]
	ResultVisibility         string             `bson:"result_visibility" json:"result_visibility"`                 // "realtime", "after_vote", "after_close", "never"
	Timezone                 string             `bson:"timezone" json:"timezone"`                                   // e.g. "UTC"
	IsEscalated              bool               `bson:"is_escalated" json:"is_escalated"`                           // True if created/edited with special duration override
	EscalationReason         string             `bson:"escalation_reason,omitempty" json:"escalation_reason,omitempty"`
	ResultsHidden            bool               `bson:"-" json:"results_hidden"`                                    // Injected during view if caller cannot yet see results
	ResultsRevealCondition   string             `bson:"-" json:"results_reveal_condition,omitempty"`               // Explanation for when results will be disclosed
	CreatedAt                time.Time          `bson:"created_at" json:"created_at"`
}

type AuditLog struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PollID           primitive.ObjectID `bson:"poll_id" json:"poll_id"`
	AdminID          primitive.ObjectID `bson:"admin_id" json:"admin_id"`
	AdminEmail       string             `bson:"admin_email" json:"admin_email"`
	AdminName        string             `bson:"admin_name,omitempty" json:"admin_name,omitempty"`
	Action           string             `bson:"action" json:"action"` // "create", "update_details", "update_duration", "update_options", "update_settings", "escalation_override", "pause", "resume", "end"
	OldDuration      int                `bson:"old_duration" json:"old_duration"`
	NewDuration      int                `bson:"new_duration" json:"new_duration"`
	OldValue         string             `bson:"old_value,omitempty" json:"old_value,omitempty"`
	NewValue         string             `bson:"new_value,omitempty" json:"new_value,omitempty"`
	Details          string             `bson:"details,omitempty" json:"details,omitempty"`
	Reason           string             `bson:"reason,omitempty" json:"reason,omitempty"`
	IsEscalated      bool               `bson:"is_escalated" json:"is_escalated"`
	EscalationReason string             `bson:"escalation_reason,omitempty" json:"escalation_reason,omitempty"`
	Timestamp        time.Time          `bson:"timestamp" json:"timestamp"`
	Timezone         string             `bson:"timezone" json:"timezone"`
}

type PollReactionRequest struct {
	Type string `json:"type" binding:"required"` // "upvote" or "downvote"
}

type VoteRecord struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID         primitive.ObjectID `bson:"user_id" json:"user_id"`
	PollID         primitive.ObjectID `bson:"poll_id" json:"poll_id"`
	OptionID       string             `bson:"option_id" json:"option_id"`
	ReferralSource string             `bson:"referral_source" json:"referral_source"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
}

type Comment struct {
	ID        string    `bson:"_id" json:"id"`
	TargetID  string    `bson:"target_id" json:"target_id"` // poll ID or game name (e.g. "trivia_rush", "word_blitz")
	UserID    string    `bson:"user_id" json:"user_id"`
	Username  string    `bson:"username" json:"username"`
	Avatar    string    `bson:"avatar" json:"avatar"`
	Content   string    `bson:"content" json:"content"`
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	IsDeleted bool      `bson:"is_deleted" json:"is_deleted"`
}

type GameScore struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	Username  string             `bson:"username" json:"username"`
	GameName  string             `bson:"game_name" json:"game_name"`
	Score     int64              `bson:"score" json:"score"`
	Accuracy  float64            `bson:"accuracy" json:"accuracy"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type LeaderboardEntry struct {
	Rank     int      `json:"rank"`
	Username string   `json:"username"`
	Points   int64    `json:"points"`
	Badges   []string `json:"badges"`
	Avatar   string   `json:"avatar"`
	IsYou    bool     `json:"is_you"`
}

type ReferralStat struct {
	Source string `json:"source"`
	Clicks int64  `json:"clicks"`
	Votes  int64  `json:"votes"`
}

type AdminAnalytics struct {
	TotalUsers     int64                   `json:"total_users"`
	TotalPolls     int64                   `json:"total_polls"`
	TotalVotes     int64                   `json:"total_votes"`
	TotalComments  int64                   `json:"total_comments"`
	ReferralStats  []ReferralStat          `json:"referral_stats"`
	PollBreakdowns []PollBreakdownAnalytics `json:"poll_breakdowns"`
}

type PollBreakdownAnalytics struct {
	PollID     string       `json:"poll_id"`
	Title      string       `json:"title"`
	TotalVotes int64        `json:"total_votes"`
	IsActive   bool         `json:"is_active"`
	Options    []PollOption `json:"options"`
}

// DTOs & Request Payloads
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=30"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreatePollRequest struct {
	Title             string   `json:"title" binding:"required,min=3,max=200"`
	Description       string   `json:"description" binding:"max=500"`
	Category          string   `json:"category"`
	Options           []string `json:"options" binding:"required,min=2,max=10,dive,min=1,max=100"`
	DurationMinutes   int      `json:"duration_minutes"`
	MinParticipants   int      `json:"min_participants"`
	MaxParticipants   int      `json:"max_participants"`
	EntryRequirement  string   `json:"entry_requirement"`
	RewardStructure   string   `json:"reward_structure"`
	SelectionType     string   `json:"selection_type"`      // "single" or "multiple"
	MaxSelections     int      `json:"max_selections"`      // max choices for multiple
	Visibility        string   `json:"visibility"`          // "public", "restricted", "private"
	AllowedUserGroups []string `json:"allowed_user_groups"` // e.g. ["all"], ["verified"], ["vip"]
	ResultVisibility  string   `json:"result_visibility"`   // "realtime", "after_vote", "after_close", "never"
	Timezone          string   `json:"timezone"`            // e.g. "UTC"
	EscalationCode    string   `json:"escalation_code"`     // "VOXENTRA_OVERRIDE_AUTH"
	EscalationReason  string   `json:"escalation_reason"`
}

type UpdatePollRequest struct {
	Title             string   `json:"title" binding:"required,min=3,max=200"`
	Description       string   `json:"description" binding:"max=500"`
	Category          string   `json:"category"`
	Options           []string `json:"options"` // allowed only if total_votes == 0
	DurationMinutes   int      `json:"duration_minutes"`
	IsActive          *bool    `json:"is_active"`
	SelectionType     string   `json:"selection_type"`
	MaxSelections     int      `json:"max_selections"`
	Visibility        string   `json:"visibility"`
	AllowedUserGroups []string `json:"allowed_user_groups"`
	ResultVisibility  string   `json:"result_visibility"`
	Timezone          string   `json:"timezone"`
	EscalationCode    string   `json:"escalation_code"`
	EscalationReason  string   `json:"escalation_reason"`
}

type VoteRequest struct {
	OptionID       string   `json:"option_id"`  // for single selection
	OptionIDs      []string `json:"option_ids"` // for multiple selection
	ReferralSource string   `json:"referral_source"`
}

type CreateCommentRequest struct {
	TargetID string `json:"target_id" binding:"required"`
	Content  string `json:"content" binding:"required,min=1,max=500"`
}

type SubmitGameScoreRequest struct {
	GameName string  `json:"game_name" binding:"required"`
	Score    int64   `json:"score" binding:"required"`
	Accuracy float64 `json:"accuracy"`
}

type LivePollUpdate struct {
	PollID          string           `json:"poll_id"`
	TotalVotes      int64            `json:"total_votes"`
	OptionVotes     map[string]int64 `json:"option_votes"`
	LastVotedOption string           `json:"last_voted_option,omitempty"`
	Timestamp       int64            `json:"timestamp"`
}

type LiveCommentUpdate struct {
	Type    string  `json:"type"` // "comment_add", "comment_delete"
	Comment Comment `json:"comment"`
}

type UserDashboardData struct {
	User             User               `json:"user"`
	VotedPolls       []VotedPollSummary `json:"voted_polls"`
	Comments         []Comment          `json:"comments"`
	GameScores       []GameScore        `json:"game_scores"`
	ReferralCount    int64              `json:"referral_count"`
	LeaderboardEntry *LeaderboardEntry  `json:"leaderboard_entry"`
}

type VotedPollSummary struct {
	PollID     string    `json:"poll_id"`
	Title      string    `json:"title"`
	OptionID   string    `json:"option_id"`
	OptionText string    `json:"option_text"`
	VotedAt    time.Time `json:"voted_at"`
	IsActive   bool      `json:"is_active"`
}
