package database

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"live-polling-backend/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

type Storage interface {
	// Users
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	GetUserByID(ctx context.Context, id primitive.ObjectID) (*models.User, error)
	GetAllUsers(ctx context.Context) ([]models.User, error)

	// Polls
	CreatePoll(ctx context.Context, poll *models.Poll) error
	GetPollByID(ctx context.Context, id primitive.ObjectID) (*models.Poll, error)
	GetPolls(ctx context.Context) ([]models.Poll, error)
	GetPollsByCreator(ctx context.Context, creatorID primitive.ObjectID) ([]models.Poll, error)
	UpdatePoll(ctx context.Context, poll *models.Poll) error
	DeletePoll(ctx context.Context, id primitive.ObjectID) error
	PermanentDeletePoll(ctx context.Context, id primitive.ObjectID) error
	TogglePollStatus(ctx context.Context, id primitive.ObjectID) (bool, error)
	PausePoll(ctx context.Context, id primitive.ObjectID) error
	ResumePoll(ctx context.Context, id primitive.ObjectID) error
	EndPoll(ctx context.Context, id primitive.ObjectID) error
	ArchivePoll(ctx context.Context, id primitive.ObjectID) error
	UpdatePollVotes(ctx context.Context, pollID primitive.ObjectID, optionVotes map[string]int64, totalVotes int64) error

	// Voting & Reactions
	RecordVote(ctx context.Context, userID primitive.ObjectID, pollID primitive.ObjectID, optionID string, optionIDs []string, referralSource string) (*models.LivePollUpdate, error)
	HasUserVoted(ctx context.Context, userID primitive.ObjectID, pollID primitive.ObjectID) (bool, string, error)
	RecordPollReaction(ctx context.Context, pollID primitive.ObjectID, reactionType string) (int64, int64, error)
	IncrementPollViews(ctx context.Context, pollID primitive.ObjectID) error

	// Audit Logs
	RecordAuditLog(ctx context.Context, log *models.AuditLog) error
	GetAuditLogsByPollID(ctx context.Context, pollID primitive.ObjectID) ([]models.AuditLog, error)

	// Comments
	AddComment(ctx context.Context, comment *models.Comment) error
	GetComments(ctx context.Context, targetID string) ([]models.Comment, error)
	GetAllComments(ctx context.Context) ([]models.Comment, error)
	DeleteComment(ctx context.Context, commentID string) error

	// Games & Leaderboard
	RecordGameScore(ctx context.Context, score *models.GameScore) error
	GetGameLeaderboard(ctx context.Context, gameName string) ([]models.LeaderboardEntry, error)
	GetGlobalLeaderboard(ctx context.Context) ([]models.LeaderboardEntry, error)

	// Analytics & Dashboard
	GetUserDashboardData(ctx context.Context, userID primitive.ObjectID) (*models.UserDashboardData, error)
	GetAdminAnalytics(ctx context.Context) (*models.AdminAnalytics, error)
	RecordReferralClick(ctx context.Context, source string) error

	IsRealDB() bool
}

type InMemoryStorage struct {
	mu            sync.RWMutex
	users         map[string]models.User          // email -> User
	usersByID     map[string]models.User          // hex ID -> User
	polls         map[string]models.Poll          // hex ID -> Poll
	votes         []models.VoteRecord             // list of all cast votes
	userVotes     map[string]map[string]string    // userID -> pollID -> optionID
	comments      []models.Comment                // list of all comments
	gameScores    []models.GameScore              // list of all game scores
	referralStats map[string]*models.ReferralStat // source -> stats
	auditLogs     []models.AuditLog               // audit logs for poll actions
}

var DB Storage

func InitMongo(uri string) {
	// Initialize high-performance thread-safe memory storage
	log.Println("[Storage] Initializing Voxentra high-performance data store...")
	DB = NewInMemoryStorage()
	log.Println("[Storage] Voxentra data store ready with pre-loaded official polls, comments, and admin account.")
}

func NewInMemoryStorage() *InMemoryStorage {
	s := &InMemoryStorage{
		users:         make(map[string]models.User),
		usersByID:     make(map[string]models.User),
		polls:         make(map[string]models.Poll),
		votes:         make([]models.VoteRecord, 0),
		userVotes:     make(map[string]map[string]string),
		comments:      make([]models.Comment, 0),
		gameScores:    make([]models.GameScore, 0),
		referralStats: make(map[string]*models.ReferralStat),
		auditLogs:     make([]models.AuditLog, 0),
	}

	s.seedData()
	return s
}

func (s *InMemoryStorage) seedData() {
	now := time.Now()

	// 1. Seed Designated Sole Admin Account
	// swetha4110@gmail.com with password segu7624
	adminPassHash, _ := bcrypt.GenerateFromPassword([]byte("segu7624"), bcrypt.DefaultCost)
	adminID := primitive.NewObjectID()
	adminUser := models.User{
		ID:           adminID,
		Username:     "Swetha",
		Email:        "swetha4110@gmail.com",
		PasswordHash: string(adminPassHash),
		Role:         "admin",
		Points:       980,
		Avatar:       "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
		CreatedAt:    now.Add(-48 * time.Hour),
	}
	s.users[adminUser.Email] = adminUser
	s.usersByID[adminUser.ID.Hex()] = adminUser

	// 2. Seed Community Participants for Leaderboard & Commentary
	mockUsers := []struct {
		username string
		email    string
		points   int64
		avatar   string
	}{
		{"Aarav", "aarav@voxentra.io", 1240, "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"},
		{"Priya", "priya@voxentra.io", 860, "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"},
		{"Rahul", "rahul@voxentra.io", 620, "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80"},
		{"Sneha", "sneha@voxentra.io", 590, "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80"},
		{"Arun", "arun@voxentra.io", 450, "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"},
		{"Kavin", "kavin@voxentra.io", 380, "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"},
		{"Meera", "meera@voxentra.io", 310, "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80"},
	}

	passHash, _ := bcrypt.GenerateFromPassword([]byte("voxentra123"), bcrypt.DefaultCost)
	for _, mu := range mockUsers {
		uID := primitive.NewObjectID()
		u := models.User{
			ID:           uID,
			Username:     mu.username,
			Email:        mu.email,
			PasswordHash: string(passHash),
			Role:         "user",
			Points:       mu.points,
			Avatar:       mu.avatar,
			CreatedAt:    now.Add(-24 * time.Hour),
		}
		s.users[u.Email] = u
		s.usersByID[u.ID.Hex()] = u
	}

	// 3. Pre-load Exact Required Voting Questions:
	// Question 1: "Which AI technology is used to generate human-like text?"
	// Options: A. Computer Vision, B. Natural Language Processing (NLP), C. Blockchain, D. Cloud Computing, E. IoT
	// Initial visual distributions: 12%, 64%, 8%, 10%, 6% (~1,248 votes)
	poll1ID := primitive.NewObjectID()
	timer1End := now.Add(2*time.Hour + 34*time.Minute)
	poll1 := models.Poll{
		ID:              poll1ID,
		CreatorID:       adminID,
		CreatorName:     "Voxentra Official",
		Title:           "Which AI technology is used to generate human-like text?",
		Description:     "Explore the cutting-edge foundations of generative artificial intelligence and large language models.",
		Category:        "Artificial Intelligence",
		IsActive:        true,
		IsArchived:      false,
		TotalVotes:      1248,
		Views:           14500,
		Upvotes:         210,
		Downvotes:       12,
		TimerStart:      &now,
		TimerEnd:        &timer1End,
		DurationMinutes: 180,
		CreatedAt:       now.Add(-1 * time.Hour),
		Options: []models.PollOption{
			{ID: "opt_1", Text: "Computer Vision", Votes: 150, Percentage: 12.0},
			{ID: "opt_2", Text: "Natural Language Processing (NLP)", Votes: 799, Percentage: 64.0},
			{ID: "opt_3", Text: "Blockchain", Votes: 100, Percentage: 8.0},
			{ID: "opt_4", Text: "Cloud Computing", Votes: 125, Percentage: 10.0},
			{ID: "opt_5", Text: "IoT", Votes: 74, Percentage: 6.0},
		},
	}
	s.polls[poll1.ID.Hex()] = poll1

	// Question 2: "Web Development: Which technology is mainly used to make a website interactive?"
	// Options: A. HTML, B. CSS, C. JavaScript, D. SQL, E. Python
	// Initial visual distributions: 15%, 18%, 54%, 7%, 6% (~892 votes)
	poll2ID := primitive.NewObjectID()
	timer2End := now.Add(4*time.Hour + 12*time.Minute)
	poll2 := models.Poll{
		ID:              poll2ID,
		CreatorID:       adminID,
		CreatorName:     "Voxentra Official",
		Title:           "Web Development: Which technology is mainly used to make a website interactive?",
		Description:     "A fundamental test for frontend engineers and web developers crafting modern user experiences.",
		Category:        "Web Development",
		IsActive:        true,
		IsArchived:      false,
		TotalVotes:      892,
		Views:           10420,
		Upvotes:         142,
		Downvotes:       8,
		TimerStart:      &now,
		TimerEnd:        &timer2End,
		DurationMinutes: 240,
		CreatedAt:       now.Add(-30 * time.Minute),
		Options: []models.PollOption{
			{ID: "opt_1", Text: "HTML", Votes: 134, Percentage: 15.0},
			{ID: "opt_2", Text: "CSS", Votes: 161, Percentage: 18.0},
			{ID: "opt_3", Text: "JavaScript", Votes: 482, Percentage: 54.0},
			{ID: "opt_4", Text: "SQL", Votes: 62, Percentage: 7.0},
			{ID: "opt_5", Text: "Python", Votes: 53, Percentage: 6.0},
		},
	}
	s.polls[poll2.ID.Hex()] = poll2

	// 4. Pre-load Live Commentary stream matching screenshot:
	mockComments := []struct {
		username string
		content  string
		minutes  int
	}{
		{"Priya", "NLP is the correct answer! ✅", 25},
		{"Arun", "Let's go! JavaScript 💙", 23},
		{"Sneha", "This is getting interesting!", 21},
		{"Kavin", "I think option B will win!", 18},
		{"Meera", "Wow! So many people voting!", 15},
		{"Rahul", "Can't wait for the next question!", 10},
	}

	for i, mc := range mockComments {
		commID := fmt.Sprintf("comm_%d", i+1)
		avatar := fmt.Sprintf("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150")
		if u, ok := s.users[mc.username+"@voxentra.io"]; ok {
			avatar = u.Avatar
		}
		s.comments = append(s.comments, models.Comment{
			ID:        commID,
			TargetID:  "global", // available globally or for poll 1
			UserID:    "user_" + mc.username,
			Username:  mc.username,
			Avatar:    avatar,
			Content:   mc.content,
			CreatedAt: now.Add(-time.Duration(mc.minutes) * time.Minute),
			IsDeleted: false,
		})
	}

	// 5. Pre-load Referral Analytics
	s.referralStats["whatsapp"] = &models.ReferralStat{Source: "whatsapp", Clicks: 248, Votes: 96}
	s.referralStats["telegram"] = &models.ReferralStat{Source: "telegram", Clicks: 174, Votes: 62}
	s.referralStats["x_twitter"] = &models.ReferralStat{Source: "x_twitter", Clicks: 312, Votes: 114}
	s.referralStats["instagram"] = &models.ReferralStat{Source: "instagram", Clicks: 135, Votes: 47}
	s.referralStats["direct"] = &models.ReferralStat{Source: "direct", Clicks: 520, Votes: 180}

	// 6. Pre-load Game Scores for Color Match and Snake
	s.gameScores = append(s.gameScores,
		models.GameScore{ID: primitive.NewObjectID(), UserID: adminUser.ID, Username: "Priya", GameName: "color_match", Score: 480, Accuracy: 96.0, CreatedAt: now.Add(-10 * time.Minute)},
		models.GameScore{ID: primitive.NewObjectID(), UserID: adminUser.ID, Username: "Arun", GameName: "color_match", Score: 420, Accuracy: 91.0, CreatedAt: now.Add(-15 * time.Minute)},
		models.GameScore{ID: primitive.NewObjectID(), UserID: adminUser.ID, Username: "Sneha", GameName: "color_match", Score: 390, Accuracy: 88.0, CreatedAt: now.Add(-25 * time.Minute)},
		models.GameScore{ID: primitive.NewObjectID(), UserID: adminUser.ID, Username: "Kavin", GameName: "snake", Score: 360, Accuracy: 100.0, CreatedAt: now.Add(-8 * time.Minute)},
		models.GameScore{ID: primitive.NewObjectID(), UserID: adminUser.ID, Username: "Meera", GameName: "snake", Score: 290, Accuracy: 100.0, CreatedAt: now.Add(-18 * time.Minute)},
		models.GameScore{ID: primitive.NewObjectID(), UserID: adminUser.ID, Username: "Rahul", GameName: "snake", Score: 220, Accuracy: 100.0, CreatedAt: now.Add(-35 * time.Minute)},
	)
}

// User Implementations
func (s *InMemoryStorage) IsRealDB() bool { return false }

func (s *InMemoryStorage) CreateUser(ctx context.Context, user *models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[user.Email]; exists {
		return errors.New("a user with this email address already exists")
	}

	user.ID = primitive.NewObjectID()
	user.CreatedAt = time.Now()
	if user.Role == "" {
		user.Role = "user"
	}
	if user.Avatar == "" {
		user.Avatar = fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%s", user.Username)
	}

	s.users[user.Email] = *user
	s.usersByID[user.ID.Hex()] = *user
	return nil
}

func (s *InMemoryStorage) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.users[email]
	if !exists {
		return nil, errors.New("user not found")
	}
	return &user, nil
}

func (s *InMemoryStorage) GetUserByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.usersByID[id.Hex()]
	if !exists {
		return nil, errors.New("user not found")
	}
	return &user, nil
}

func (s *InMemoryStorage) GetAllUsers(ctx context.Context) ([]models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	users := make([]models.User, 0, len(s.users))
	for _, u := range s.users {
		users = append(users, u)
	}
	return users, nil
}

// Poll Implementations
func (s *InMemoryStorage) CreatePoll(ctx context.Context, poll *models.Poll) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll.ID = primitive.NewObjectID()
	now := time.Now().UTC()
	poll.CreatedAt = now
	poll.IsActive = true
	poll.IsArchived = false
	poll.Status = "active"
	poll.TotalVotes = 0
	poll.TimerStart = &now

	if poll.DurationMinutes <= 0 {
		poll.DurationMinutes = 60 // 60 minutes default suggested duration
	}
	timerEnd := now.Add(time.Duration(poll.DurationMinutes) * time.Minute)
	poll.TimerEnd = &timerEnd

	if poll.SelectionType == "" {
		poll.SelectionType = "single"
	}
	if poll.SelectionType == "multiple" && poll.MaxSelections < 2 {
		poll.MaxSelections = len(poll.Options)
	}
	if poll.Visibility == "" {
		poll.Visibility = "public"
	}
	if len(poll.AllowedUserGroups) == 0 {
		poll.AllowedUserGroups = []string{"all"}
	}
	if poll.ResultVisibility == "" {
		poll.ResultVisibility = "realtime"
	}
	if poll.Timezone == "" {
		poll.Timezone = "UTC"
	}
	if poll.EntryRequirement == "" {
		poll.EntryRequirement = "Free / Open to All"
	}
	if poll.RewardStructure == "" {
		poll.RewardStructure = "Winner Takes All XP"
	}

	for i := range poll.Options {
		poll.Options[i].Votes = 0
		poll.Options[i].Percentage = 0
	}

	s.polls[poll.ID.Hex()] = *poll
	return nil
}

func (s *InMemoryStorage) GetPollByID(ctx context.Context, id primitive.ObjectID) (*models.Poll, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	poll, exists := s.polls[id.Hex()]
	if !exists || poll.IsArchived {
		return nil, errors.New("poll not found")
	}

	calculatePollPercentages(&poll)
	return &poll, nil
}

func (s *InMemoryStorage) GetPolls(ctx context.Context) ([]models.Poll, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	polls := make([]models.Poll, 0, len(s.polls))
	for _, p := range s.polls {
		if !p.IsArchived {
			calculatePollPercentages(&p)
			polls = append(polls, p)
		}
	}

	// Sort active first, then newest
	sort.Slice(polls, func(i, j int) bool {
		if polls[i].IsActive != polls[j].IsActive {
			return polls[i].IsActive
		}
		return polls[i].CreatedAt.After(polls[j].CreatedAt)
	})

	return polls, nil
}

func (s *InMemoryStorage) GetPollsByCreator(ctx context.Context, creatorID primitive.ObjectID) ([]models.Poll, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	polls := make([]models.Poll, 0)
	for _, p := range s.polls {
		if p.CreatorID == creatorID && !p.IsArchived {
			calculatePollPercentages(&p)
			polls = append(polls, p)
		}
	}
	return polls, nil
}

func (s *InMemoryStorage) UpdatePoll(ctx context.Context, updated *models.Poll) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.polls[updated.ID.Hex()]
	if !exists {
		return errors.New("poll not found")
	}

	// CRITICAL RULE: Options can ONLY be added, removed, or modified if no votes have been cast!
	if updated.Options != nil && len(updated.Options) > 0 {
		optionsChanged := false
		if len(existing.Options) != len(updated.Options) {
			optionsChanged = true
		} else {
			for i := range existing.Options {
				if existing.Options[i].Text != updated.Options[i].Text || existing.Options[i].ID != updated.Options[i].ID {
					optionsChanged = true
					break
				}
			}
		}

		if optionsChanged {
			if existing.TotalVotes > 0 {
				return errors.New("cannot add, remove, or modify answer options after votes have already been cast")
			}
			existing.Options = updated.Options
			var total int64 = 0
			for _, o := range existing.Options {
				total += o.Votes
			}
			existing.TotalVotes = total
			calculatePollPercentages(&existing)
		}
	}

	existing.Title = updated.Title
	existing.Description = updated.Description
	existing.Category = updated.Category
	existing.IsActive = updated.IsActive
	if updated.Status != "" {
		existing.Status = updated.Status
	}
	if updated.SelectionType != "" {
		existing.SelectionType = updated.SelectionType
	}
	if updated.MaxSelections > 0 {
		existing.MaxSelections = updated.MaxSelections
	}
	if updated.Visibility != "" {
		existing.Visibility = updated.Visibility
	}
	if updated.AllowedUserGroups != nil {
		existing.AllowedUserGroups = updated.AllowedUserGroups
	}
	if updated.ResultVisibility != "" {
		existing.ResultVisibility = updated.ResultVisibility
	}
	if updated.Timezone != "" {
		existing.Timezone = updated.Timezone
	}
	if updated.IsEscalated {
		existing.IsEscalated = true
		existing.EscalationReason = updated.EscalationReason
	}

	// Active Poll Duration Edge Case & Dynamic Recalculation
	if updated.DurationMinutes > 0 && updated.DurationMinutes != existing.DurationMinutes {
		if existing.TimerStart != nil {
			newTimerEnd := existing.TimerStart.Add(time.Duration(updated.DurationMinutes) * time.Minute)
			if newTimerEnd.Before(time.Now()) {
				elapsedMins := int(time.Since(*existing.TimerStart).Minutes())
				return fmt.Errorf("duration (%d min) cannot be shorter than the time already elapsed (%d min)", updated.DurationMinutes, elapsedMins)
			}
			existing.TimerEnd = &newTimerEnd
		} else {
			timerEnd := time.Now().Add(time.Duration(updated.DurationMinutes) * time.Minute)
			existing.TimerEnd = &timerEnd
		}
		existing.DurationMinutes = updated.DurationMinutes
	}

	s.polls[updated.ID.Hex()] = existing
	return nil
}

func (s *InMemoryStorage) DeletePoll(ctx context.Context, id primitive.ObjectID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll, exists := s.polls[id.Hex()]
	if !exists {
		return errors.New("poll not found")
	}

	poll.IsArchived = true
	poll.IsActive = false
	s.polls[id.Hex()] = poll
	return nil
}

func (s *InMemoryStorage) TogglePollStatus(ctx context.Context, id primitive.ObjectID) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll, exists := s.polls[id.Hex()]
	if !exists {
		return false, errors.New("poll not found")
	}

	poll.IsActive = !poll.IsActive
	if poll.IsActive {
		poll.Status = "active"
	} else {
		poll.Status = "paused"
	}
	s.polls[id.Hex()] = poll
	return poll.IsActive, nil
}

func (s *InMemoryStorage) PausePoll(ctx context.Context, id primitive.ObjectID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll, exists := s.polls[id.Hex()]
	if !exists {
		return errors.New("poll not found")
	}

	poll.IsActive = false
	poll.Status = "paused"
	s.polls[id.Hex()] = poll
	return nil
}

func (s *InMemoryStorage) ResumePoll(ctx context.Context, id primitive.ObjectID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll, exists := s.polls[id.Hex()]
	if !exists {
		return errors.New("poll not found")
	}

	poll.IsActive = true
	poll.Status = "active"
	s.polls[id.Hex()] = poll
	return nil
}

func (s *InMemoryStorage) EndPoll(ctx context.Context, id primitive.ObjectID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll, exists := s.polls[id.Hex()]
	if !exists {
		return errors.New("poll not found")
	}

	poll.IsActive = false
	poll.Status = "ended"
	s.polls[id.Hex()] = poll
	return nil
}

func (s *InMemoryStorage) ArchivePoll(ctx context.Context, id primitive.ObjectID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll, exists := s.polls[id.Hex()]
	if !exists {
		return errors.New("poll not found")
	}

	poll.IsArchived = true
	poll.IsActive = false
	poll.Status = "archived"
	s.polls[id.Hex()] = poll
	return nil
}

func (s *InMemoryStorage) PermanentDeletePoll(ctx context.Context, id primitive.ObjectID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	hex := id.Hex()
	if _, exists := s.polls[hex]; !exists {
		return errors.New("poll not found")
	}

	delete(s.polls, hex)
	for uHex, pMap := range s.userVotes {
		delete(pMap, hex)
		s.userVotes[uHex] = pMap
	}
	return nil
}

func (s *InMemoryStorage) UpdatePollVotes(ctx context.Context, pollID primitive.ObjectID, optionVotes map[string]int64, totalVotes int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	poll, exists := s.polls[pollID.Hex()]
	if !exists {
		return errors.New("poll not found")
	}

	poll.TotalVotes = totalVotes
	for i, opt := range poll.Options {
		if count, ok := optionVotes[opt.ID]; ok {
			poll.Options[i].Votes = count
		}
	}
	calculatePollPercentages(&poll)
	s.polls[pollID.Hex()] = poll
	return nil
}

// Voting Implementation: One Vote Per Registered User (Supports Single & Multiple Selections)
func (s *InMemoryStorage) RecordVote(ctx context.Context, userID primitive.ObjectID, pollID primitive.ObjectID, optionID string, optionIDs []string, referralSource string) (*models.LivePollUpdate, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pollHex := pollID.Hex()
	userHex := userID.Hex()

	poll, exists := s.polls[pollHex]
	if !exists {
		return nil, errors.New("poll not found")
	}

	if !poll.IsActive {
		return nil, errors.New("this poll is closed and no longer accepting votes")
	}

	if poll.TimerEnd != nil && time.Now().After(*poll.TimerEnd) {
		poll.IsActive = false
		s.polls[pollHex] = poll
		return nil, errors.New("voting period has expired for this poll")
	}

	// Verify user has not already voted on this question
	if userPolls, hasVotes := s.userVotes[userHex]; hasVotes {
		if _, alreadyVoted := userPolls[pollHex]; alreadyVoted {
			return nil, errors.New("you have already cast your vote on this question")
		}
	} else {
		s.userVotes[userHex] = make(map[string]string)
	}

	// Consolidate and validate selected options
	var selected []string
	if len(optionIDs) > 0 {
		selected = optionIDs
	} else if optionID != "" {
		selected = []string{optionID}
	}

	if len(selected) == 0 {
		return nil, errors.New("please select at least one option")
	}

	// Check selection limits based on poll.SelectionType
	if poll.SelectionType == "multiple" {
		max := poll.MaxSelections
		if max < 2 {
			max = len(poll.Options)
		}
		if len(selected) > max {
			return nil, fmt.Errorf("you may select at most %d options for this poll", max)
		}
	} else {
		if len(selected) > 1 {
			return nil, errors.New("this poll only permits a single option selection")
		}
	}

	// Prevent duplicate option IDs in the same ballot
	uniqueSelected := make(map[string]bool)
	for _, id := range selected {
		if uniqueSelected[id] {
			return nil, errors.New("duplicate option selections are not allowed")
		}
		uniqueSelected[id] = true
	}

	// Validate options and increment votes
	for optID := range uniqueSelected {
		found := false
		for i, opt := range poll.Options {
			if opt.ID == optID {
				poll.Options[i].Votes++
				poll.TotalVotes++
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("invalid option selected: %s", optID)
		}

		s.votes = append(s.votes, models.VoteRecord{
			ID:             primitive.NewObjectID(),
			UserID:         userID,
			PollID:         pollID,
			OptionID:       optID,
			ReferralSource: referralSource,
			CreatedAt:      time.Now().UTC(),
		})
	}

	// Record vote registry (comma-separated list if multiple)
	s.userVotes[userHex][pollHex] = strings.Join(selected, ",")

	// Track referral analytics
	if referralSource != "" {
		if stat, ok := s.referralStats[referralSource]; ok {
			stat.Votes++
		} else {
			s.referralStats[referralSource] = &models.ReferralStat{
				Source: referralSource,
				Clicks: 1,
				Votes:  1,
			}
		}
	}

	// Reward voter with 10 activity points!
	if u, exists := s.usersByID[userHex]; exists {
		u.Points += 10
		s.usersByID[userHex] = u
		s.users[u.Email] = u
	}

	calculatePollPercentages(&poll)
	s.polls[pollHex] = poll

	optionVotes := make(map[string]int64)
	for _, opt := range poll.Options {
		optionVotes[opt.ID] = opt.Votes
	}

	lastVoted := selected[0]
	return &models.LivePollUpdate{
		PollID:          pollHex,
		TotalVotes:      poll.TotalVotes,
		OptionVotes:     optionVotes,
		LastVotedOption: lastVoted,
		Timestamp:       time.Now().Unix(),
	}, nil
}

// Audit Logging Implementations
func (s *InMemoryStorage) RecordAuditLog(ctx context.Context, logEntry *models.AuditLog) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if logEntry.ID.IsZero() {
		logEntry.ID = primitive.NewObjectID()
	}
	if logEntry.Timestamp.IsZero() {
		logEntry.Timestamp = time.Now().UTC()
	}
	if logEntry.Timezone == "" {
		logEntry.Timezone = "UTC"
	}
	s.auditLogs = append(s.auditLogs, *logEntry)
	return nil
}

func (s *InMemoryStorage) GetAuditLogsByPollID(ctx context.Context, pollID primitive.ObjectID) ([]models.AuditLog, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.AuditLog
	for _, l := range s.auditLogs {
		if l.PollID == pollID {
			results = append(results, l)
		}
	}
	// Sort newest first
	sort.Slice(results, func(i, j int) bool {
		return results[i].Timestamp.After(results[j].Timestamp)
	})
	return results, nil
}

func (s *InMemoryStorage) HasUserVoted(ctx context.Context, userID primitive.ObjectID, pollID primitive.ObjectID) (bool, string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userHex := userID.Hex()
	pollHex := pollID.Hex()

	if userPolls, ok := s.userVotes[userHex]; ok {
		if optID, voted := userPolls[pollHex]; voted {
			return true, optID, nil
		}
	}
	return false, "", nil
}

func (s *InMemoryStorage) RecordPollReaction(ctx context.Context, pollID primitive.ObjectID, reactionType string) (int64, int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pollHex := pollID.Hex()
	poll, exists := s.polls[pollHex]
	if !exists {
		return 0, 0, errors.New("poll not found")
	}

	if reactionType == "upvote" {
		poll.Upvotes++
	} else if reactionType == "downvote" {
		poll.Downvotes++
	}
	s.polls[pollHex] = poll
	return poll.Upvotes, poll.Downvotes, nil
}

func (s *InMemoryStorage) IncrementPollViews(ctx context.Context, pollID primitive.ObjectID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pollHex := pollID.Hex()
	if poll, exists := s.polls[pollHex]; exists {
		poll.Views++
		s.polls[pollHex] = poll
	}
	return nil
}

// Live Commentary System
func (s *InMemoryStorage) AddComment(ctx context.Context, comment *models.Comment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if comment.ID == "" {
		comment.ID = fmt.Sprintf("comm_%d", time.Now().UnixNano())
	}
	comment.CreatedAt = time.Now()
	comment.IsDeleted = false

	s.comments = append(s.comments, *comment)
	return nil
}

func (s *InMemoryStorage) GetComments(ctx context.Context, targetID string) ([]models.Comment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.Comment
	for _, c := range s.comments {
		if !c.IsDeleted {
			if targetID == "" || targetID == "all" || c.TargetID == targetID || c.TargetID == "global" {
				result = append(result, c)
			}
		}
	}

	// Sort newest first
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	return result, nil
}

func (s *InMemoryStorage) GetAllComments(ctx context.Context) ([]models.Comment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []models.Comment
	for _, c := range s.comments {
		result = append(result, c)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})
	return result, nil
}

func (s *InMemoryStorage) DeleteComment(ctx context.Context, commentID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, c := range s.comments {
		if c.ID == commentID {
			s.comments[i].IsDeleted = true
			return nil
		}
	}
	return errors.New("comment not found")
}

// Games & Leaderboard
func (s *InMemoryStorage) RecordGameScore(ctx context.Context, score *models.GameScore) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	score.ID = primitive.NewObjectID()
	score.CreatedAt = time.Now()
	s.gameScores = append(s.gameScores, *score)

	// Add points to user profile
	userHex := score.UserID.Hex()
	if u, exists := s.usersByID[userHex]; exists {
		u.Points += score.Score
		s.usersByID[userHex] = u
		s.users[u.Email] = u
	}

	return nil
}

func (s *InMemoryStorage) GetGameLeaderboard(ctx context.Context, gameName string) ([]models.LeaderboardEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userMax := make(map[string]int64)
	for _, gs := range s.gameScores {
		if gameName == "" || gs.GameName == gameName {
			if gs.Score > userMax[gs.Username] {
				userMax[gs.Username] = gs.Score
			}
		}
	}

	var entries []models.LeaderboardEntry
	for username, score := range userMax {
		avatar := fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%s", username)
		entries = append(entries, models.LeaderboardEntry{
			Username: username,
			Points:   score,
			Avatar:   avatar,
			Badges:   []string{"⚡", "🎮"},
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Points > entries[j].Points
	})

	for i := range entries {
		entries[i].Rank = i + 1
	}

	return entries, nil
}

func (s *InMemoryStorage) GetGlobalLeaderboard(ctx context.Context) ([]models.LeaderboardEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var entries []models.LeaderboardEntry
	for _, u := range s.users {
		badges := []string{"🌟"}
		if u.Points >= 1000 {
			badges = []string{"🏆", "🔥", "🏅"}
		} else if u.Points >= 800 {
			badges = []string{"🔥", "🌟", "💎"}
		} else if u.Points >= 500 {
			badges = []string{"🌟", "💎"}
		}

		entries = append(entries, models.LeaderboardEntry{
			Username: u.Username,
			Points:   u.Points,
			Avatar:   u.Avatar,
			Badges:   badges,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Points > entries[j].Points
	})

	for i := range entries {
		entries[i].Rank = i + 1
	}

	if len(entries) > 10 {
		entries = entries[:10]
	}

	return entries, nil
}

// User & Admin Dashboards
func (s *InMemoryStorage) GetUserDashboardData(ctx context.Context, userID primitive.ObjectID) (*models.UserDashboardData, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userHex := userID.Hex()
	user, exists := s.usersByID[userHex]
	if !exists {
		return nil, errors.New("user not found")
	}

	var votedPolls []models.VotedPollSummary
	if userPolls, ok := s.userVotes[userHex]; ok {
		for pollHex, optID := range userPolls {
			if poll, pExists := s.polls[pollHex]; pExists {
				optText := optID
				for _, opt := range poll.Options {
					if opt.ID == optID {
						optText = opt.Text
						break
					}
				}
				votedPolls = append(votedPolls, models.VotedPollSummary{
					PollID:     pollHex,
					Title:      poll.Title,
					OptionID:   optID,
					OptionText: optText,
					IsActive:   poll.IsActive,
				})
			}
		}
	}

	var userComments []models.Comment
	for _, c := range s.comments {
		if c.UserID == userHex && !c.IsDeleted {
			userComments = append(userComments, c)
		}
	}

	var userScores []models.GameScore
	for _, gs := range s.gameScores {
		if gs.UserID == userID {
			userScores = append(userScores, gs)
		}
	}

	return &models.UserDashboardData{
		User:          user,
		VotedPolls:    votedPolls,
		Comments:      userComments,
		GameScores:    userScores,
		ReferralCount: 12,
	}, nil
}

func (s *InMemoryStorage) GetAdminAnalytics(ctx context.Context) (*models.AdminAnalytics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalVotes int64
	var breakdowns []models.PollBreakdownAnalytics
	for _, poll := range s.polls {
		if !poll.IsArchived {
			totalVotes += poll.TotalVotes
			calculatePollPercentages(&poll)
			breakdowns = append(breakdowns, models.PollBreakdownAnalytics{
				PollID:     poll.ID.Hex(),
				Title:      poll.Title,
				TotalVotes: poll.TotalVotes,
				IsActive:   poll.IsActive,
				Options:    poll.Options,
			})
		}
	}

	var refStats []models.ReferralStat
	for _, rs := range s.referralStats {
		refStats = append(refStats, *rs)
	}

	return &models.AdminAnalytics{
		TotalUsers:     int64(len(s.users)),
		TotalPolls:     int64(len(s.polls)),
		TotalVotes:     totalVotes,
		TotalComments:  int64(len(s.comments)),
		ReferralStats:  refStats,
		PollBreakdowns: breakdowns,
	}, nil
}

func (s *InMemoryStorage) RecordReferralClick(ctx context.Context, source string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if stat, exists := s.referralStats[source]; exists {
		stat.Clicks++
	} else {
		s.referralStats[source] = &models.ReferralStat{
			Source: source,
			Clicks: 1,
			Votes:  0,
		}
	}
	return nil
}

// Helpers
func calculatePollPercentages(poll *models.Poll) {
	if poll.TotalVotes <= 0 {
		for i := range poll.Options {
			poll.Options[i].Percentage = 0
		}
	} else {
		for i := range poll.Options {
			pct := (float64(poll.Options[i].Votes) / float64(poll.TotalVotes)) * 100.0
			poll.Options[i].Percentage = float64(int(pct*10+0.5)) / 10.0
		}
	}

	if poll.TimerEnd != nil {
		diff := time.Until(*poll.TimerEnd)
		if diff <= 0 {
			poll.RemainingSec = 0
			poll.IsActive = false
		} else {
			poll.RemainingSec = int64(diff.Seconds())
		}
	}
}
