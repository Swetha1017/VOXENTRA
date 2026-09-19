package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"live-polling-backend/config"
	"live-polling-backend/controllers"
	"live-polling-backend/database"
	"live-polling-backend/middleware"
	"live-polling-backend/models"
	"live-polling-backend/websocket"

	"github.com/gin-gonic/gin"
)

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	cfg := config.LoadConfig()

	database.DB = database.NewInMemoryStorage()
	database.Realtime = database.NewInMemoryRealtimeManager()
	websocket.InitHub()

	router := gin.Default()
	router.Use(middleware.CORSMiddleware("*"))

	authController := controllers.NewAuthController(cfg.JWTSecret)
	pollController := controllers.NewPollController()
	commentController := controllers.NewCommentController()
	gameController := controllers.NewGameController()

	api := router.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authController.Register)
			auth.POST("/login", authController.Login)
			auth.POST("/admin-login", authController.AdminLogin)
			auth.GET("/me", middleware.AuthRequired(cfg.JWTSecret), authController.GetMe)
		}

		user := api.Group("/user")
		user.Use(middleware.AuthRequired(cfg.JWTSecret))
		{
			user.GET("/dashboard", authController.GetUserDashboard)
		}

		polls := api.Group("/polls")
		{
			polls.GET("", pollController.GetPolls)
			polls.GET("/active", pollController.GetActivePoll)
			polls.GET("/:id", pollController.GetPoll)
			polls.POST("/:id/reaction", pollController.ReactToPoll)
			polls.POST("/referral/:source", pollController.TrackReferral)

			authorized := polls.Group("")
			authorized.Use(middleware.AuthRequired(cfg.JWTSecret))
			{
				authorized.POST("/:id/vote", pollController.Vote)
			}
		}

		comments := api.Group("/comments")
		{
			comments.GET("", commentController.GetComments)
			comments.POST("", middleware.AuthRequired(cfg.JWTSecret), commentController.PostComment)
		}

		games := api.Group("/games")
		{
			games.GET("/leaderboard", gameController.GetGameLeaderboard)
			games.POST("/score", middleware.AuthRequired(cfg.JWTSecret), gameController.SubmitScore)
		}
		api.GET("/leaderboard", gameController.GetGlobalLeaderboard)

		admin := api.Group("/admin")
		admin.Use(middleware.AdminRequired(cfg.JWTSecret))
		{
			admin.POST("/polls", pollController.AdminCreatePoll)
			admin.PUT("/polls/:id", pollController.AdminUpdatePoll)
			admin.DELETE("/polls/:id", pollController.AdminDeletePoll)
			admin.DELETE("/polls/:id/permanent", pollController.AdminPermanentDeletePoll)
			admin.PATCH("/polls/:id/status", pollController.AdminTogglePoll)
			admin.PATCH("/polls/:id/pause", pollController.AdminPausePoll)
			admin.PATCH("/polls/:id/resume", pollController.AdminResumePoll)
			admin.PATCH("/polls/:id/end", pollController.AdminEndPoll)
			admin.GET("/analytics", pollController.AdminGetAnalytics)
			admin.GET("/comments", commentController.AdminGetAllComments)
			admin.DELETE("/comments/:id", commentController.AdminDeleteComment)
		}
	}

	return router
}

func TestHealthEndpoint(t *testing.T) {
	router := setupTestRouter()
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got: %d", w.Code)
	}
}

func TestPreloadedPolls(t *testing.T) {
	router := setupTestRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/polls", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got: %d", w.Code)
	}

	var polls []models.Poll
	if err := json.Unmarshal(w.Body.Bytes(), &polls); err != nil {
		t.Fatalf("Failed to parse polls JSON: %v", err)
	}

	if len(polls) < 2 {
		t.Fatalf("Expected at least 2 pre-loaded official polls, got %d", len(polls))
	}

	// Verify exact Question 1 & Question 2 content
	foundAI := false
	foundWeb := false
	for _, p := range polls {
		if p.Title == "Which AI technology is used to generate human-like text?" {
			foundAI = true
			if len(p.Options) != 5 {
				t.Errorf("Expected 5 options for AI poll, got %d", len(p.Options))
			}
		}
		if p.Title == "Web Development: Which technology is mainly used to make a website interactive?" {
			foundWeb = true
			if len(p.Options) != 5 {
				t.Errorf("Expected 5 options for Web Dev poll, got %d", len(p.Options))
			}
		}
	}

	if !foundAI || !foundWeb {
		t.Fatalf("Did not find both pre-loaded official questions: AI=%v, Web=%v", foundAI, foundWeb)
	}
}

func TestUserRegistrationAndDuplicatePrevention(t *testing.T) {
	router := setupTestRouter()

	regPayload := models.RegisterRequest{
		Username: "newvoter",
		Email:    "newvoter@voxentra.com",
		Password: "securepassword123",
	}
	body, _ := json.Marshal(regPayload)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for register, got %d: %s", w.Code, w.Body.String())
	}

	// Duplicate registration attempt
	wDup := httptest.NewRecorder()
	reqDup, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	reqDup.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wDup, reqDup)

	if wDup.Code != http.StatusConflict {
		t.Fatalf("Expected 409 Conflict for duplicate email, got: %d", wDup.Code)
	}
}

func TestExclusiveAdminLogin(t *testing.T) {
	router := setupTestRouter()

	// 1. Correct Admin Credentials
	adminLoginPayload := models.AdminLoginRequest{
		Email:    "swetha4110@gmail.com",
		Password: "segu7624",
	}
	body, _ := json.Marshal(adminLoginPayload)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/admin-login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for valid admin login, got %d: %s", w.Code, w.Body.String())
	}

	var authResp models.AuthResponse
	_ = json.Unmarshal(w.Body.Bytes(), &authResp)
	if authResp.User.Role != "admin" {
		t.Fatalf("Expected admin role, got: %s", authResp.User.Role)
	}

	// 2. Test Admin Analytics endpoint using admin token
	wAnalytics := httptest.NewRecorder()
	reqAnalytics, _ := http.NewRequest("GET", "/api/admin/analytics", nil)
	reqAnalytics.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wAnalytics, reqAnalytics)

	if wAnalytics.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for admin analytics, got: %d", wAnalytics.Code)
	}

	// 3. Unauthorized User attempt to access admin endpoint
	userLoginPayload := models.LoginRequest{
		Email:    "aarav@voxentra.io",
		Password: "voxentra123",
	}
	userBody, _ := json.Marshal(userLoginPayload)
	wUser := httptest.NewRecorder()
	reqUser, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(userBody))
	reqUser.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wUser, reqUser)

	var userAuthResp models.AuthResponse
	_ = json.Unmarshal(wUser.Body.Bytes(), &userAuthResp)

	wDenied := httptest.NewRecorder()
	reqDenied, _ := http.NewRequest("GET", "/api/admin/analytics", nil)
	reqDenied.Header.Set("Authorization", "Bearer "+userAuthResp.Token)
	router.ServeHTTP(wDenied, reqDenied)

	if wDenied.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden for non-admin user on admin route, got: %d", wDenied.Code)
	}
}

func TestAuthenticatedVotingAndDeduplication(t *testing.T) {
	router := setupTestRouter()

	// Get first poll
	wPolls := httptest.NewRecorder()
	reqPolls, _ := http.NewRequest("GET", "/api/polls", nil)
	router.ServeHTTP(wPolls, reqPolls)

	var polls []models.Poll
	_ = json.Unmarshal(wPolls.Body.Bytes(), &polls)
	targetPoll := polls[0]

	// Register voter
	regPayload := models.RegisterRequest{
		Username: "uniquevoter",
		Email:    "voter_unique@voxentra.com",
		Password: "password123",
	}
	body, _ := json.Marshal(regPayload)
	wReg := httptest.NewRecorder()
	reqReg, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	reqReg.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wReg, reqReg)

	var authResp models.AuthResponse
	_ = json.Unmarshal(wReg.Body.Bytes(), &authResp)

	// Cast vote
	votePayload := models.VoteRequest{
		OptionID:       targetPoll.Options[0].ID,
		ReferralSource: "whatsapp",
	}
	voteBody, _ := json.Marshal(votePayload)

	wVote := httptest.NewRecorder()
	reqVote, _ := http.NewRequest("POST", "/api/polls/"+targetPoll.ID.Hex()+"/vote", bytes.NewBuffer(voteBody))
	reqVote.Header.Set("Content-Type", "application/json")
	reqVote.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wVote, reqVote)

	if wVote.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for vote, got %d: %s", wVote.Code, wVote.Body.String())
	}

	// Attempt second vote on same poll
	wVote2 := httptest.NewRecorder()
	reqVote2, _ := http.NewRequest("POST", "/api/polls/"+targetPoll.ID.Hex()+"/vote", bytes.NewBuffer(voteBody))
	reqVote2.Header.Set("Content-Type", "application/json")
	reqVote2.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wVote2, reqVote2)

	if wVote2.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for duplicate vote from same user, got: %d", wVote2.Code)
	}
}

func TestPoolCreationAndLifecycle(t *testing.T) {
	router := setupTestRouter()

	// Admin login
	adminLoginPayload := models.AdminLoginRequest{
		Email:    "swetha4110@gmail.com",
		Password: "segu7624",
	}
	body, _ := json.Marshal(adminLoginPayload)
	wAdmin := httptest.NewRecorder()
	reqAdmin, _ := http.NewRequest("POST", "/api/auth/admin-login", bytes.NewBuffer(body))
	reqAdmin.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wAdmin, reqAdmin)

	var authResp models.AuthResponse
	_ = json.Unmarshal(wAdmin.Body.Bytes(), &authResp)

	// 1. Create a new Pool
	poolPayload := models.CreatePollRequest{
		Title:            "Gaming Champions Pool 2026",
		Description:      "Vote for the best game mechanic of the year",
		Category:         "Gaming",
		Options:          []string{"Real-time Physics", "Procedural Generation", "Neural AI NPC"},
		DurationMinutes:  180,
		MinParticipants:  10,
		MaxParticipants:  500,
		EntryRequirement: "Verified Voter",
		RewardStructure:  "Winner Takes All XP",
	}
	pBody, _ := json.Marshal(poolPayload)
	wCreate := httptest.NewRecorder()
	reqCreate, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(pBody))
	reqCreate.Header.Set("Content-Type", "application/json")
	reqCreate.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wCreate, reqCreate)

	if wCreate.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for Create Pool, got %d: %s", wCreate.Code, wCreate.Body.String())
	}

	var createdPool models.Poll
	_ = json.Unmarshal(wCreate.Body.Bytes(), &createdPool)
	if createdPool.Title != "Gaming Champions Pool 2026" || createdPool.Status != "active" {
		t.Fatalf("Pool properties mismatch: %+v", createdPool)
	}

	// 2. Pause Pool
	wPause := httptest.NewRecorder()
	reqPause, _ := http.NewRequest("PATCH", "/api/admin/polls/"+createdPool.ID.Hex()+"/pause", nil)
	reqPause.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wPause, reqPause)
	if wPause.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for pause, got %d: %s", wPause.Code, wPause.Body.String())
	}

	// 3. Resume Pool
	wResume := httptest.NewRecorder()
	reqResume, _ := http.NewRequest("PATCH", "/api/admin/polls/"+createdPool.ID.Hex()+"/resume", nil)
	reqResume.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wResume, reqResume)
	if wResume.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for resume, got %d: %s", wResume.Code, wResume.Body.String())
	}

	// 4. End Pool
	wEnd := httptest.NewRecorder()
	reqEnd, _ := http.NewRequest("PATCH", "/api/admin/polls/"+createdPool.ID.Hex()+"/end", nil)
	reqEnd.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wEnd, reqEnd)
	if wEnd.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for end, got %d: %s", wEnd.Code, wEnd.Body.String())
	}

	// 5. Permanent Delete
	wDel := httptest.NewRecorder()
	reqDel, _ := http.NewRequest("DELETE", "/api/admin/polls/"+createdPool.ID.Hex()+"/permanent", nil)
	reqDel.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wDel, reqDel)
	if wDel.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for permanent delete, got %d: %s", wDel.Code, wDel.Body.String())
	}
}

func TestMiniGamesScoreRecording(t *testing.T) {
	router := setupTestRouter()

	// Register user
	regPayload := models.RegisterRequest{
		Username: "gamerpro",
		Email:    "gamer@voxentra.com",
		Password: "password123",
	}
	body, _ := json.Marshal(regPayload)
	wReg := httptest.NewRecorder()
	reqReg, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	reqReg.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wReg, reqReg)

	var authResp models.AuthResponse
	_ = json.Unmarshal(wReg.Body.Bytes(), &authResp)

	// 1. Submit Color Match score
	cmPayload := models.SubmitGameScoreRequest{
		GameName: "color_match",
		Score:    520,
		Accuracy: 95.0,
	}
	cmBody, _ := json.Marshal(cmPayload)
	wCM := httptest.NewRecorder()
	reqCM, _ := http.NewRequest("POST", "/api/games/score", bytes.NewBuffer(cmBody))
	reqCM.Header.Set("Content-Type", "application/json")
	reqCM.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wCM, reqCM)

	if wCM.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for Color Match score, got %d: %s", wCM.Code, wCM.Body.String())
	}

	// 2. Submit Snake score
	snakePayload := models.SubmitGameScoreRequest{
		GameName: "snake",
		Score:    410,
		Accuracy: 100.0,
	}
	snakeBody, _ := json.Marshal(snakePayload)
	wSnake := httptest.NewRecorder()
	reqSnake, _ := http.NewRequest("POST", "/api/games/score", bytes.NewBuffer(snakeBody))
	reqSnake.Header.Set("Content-Type", "application/json")
	reqSnake.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wSnake, reqSnake)

	if wSnake.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for Snake score, got %d: %s", wSnake.Code, wSnake.Body.String())
	}

	// 3. Verify Leaderboards
	wLB := httptest.NewRecorder()
	reqLB, _ := http.NewRequest("GET", "/api/games/leaderboard?game=color_match", nil)
	router.ServeHTTP(wLB, reqLB)

	if wLB.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for leaderboard, got %d", wLB.Code)
	}

	var lb []models.LeaderboardEntry
	_ = json.Unmarshal(wLB.Body.Bytes(), &lb)
	if len(lb) == 0 || lb[0].Points < 480 {
		t.Fatalf("Expected populated Color Match leaderboard, got: %+v", lb)
	}
}

func TestPollReactionAndSeparatedMetrics(t *testing.T) {
	router := setupTestRouter()

	// Get active polls
	wPolls := httptest.NewRecorder()
	reqPolls, _ := http.NewRequest("GET", "/api/polls", nil)
	router.ServeHTTP(wPolls, reqPolls)

	var polls []models.Poll
	_ = json.Unmarshal(wPolls.Body.Bytes(), &polls)
	if len(polls) == 0 {
		t.Fatal("No polls found to test reactions")
	}

	targetPoll := polls[0]

	// Upvote reaction
	upvotePayload := models.PollReactionRequest{Type: "upvote"}
	upvoteBody, _ := json.Marshal(upvotePayload)

	wUp := httptest.NewRecorder()
	reqUp, _ := http.NewRequest("POST", "/api/polls/"+targetPoll.ID.Hex()+"/reaction", bytes.NewBuffer(upvoteBody))
	reqUp.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wUp, reqUp)

	if wUp.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for upvote reaction, got %d: %s", wUp.Code, wUp.Body.String())
	}

	// Downvote reaction
	downvotePayload := models.PollReactionRequest{Type: "downvote"}
	downvoteBody, _ := json.Marshal(downvotePayload)

	wDown := httptest.NewRecorder()
	reqDown, _ := http.NewRequest("POST", "/api/polls/"+targetPoll.ID.Hex()+"/reaction", bytes.NewBuffer(downvoteBody))
	reqDown.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wDown, reqDown)

	if wDown.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for downvote reaction, got %d: %s", wDown.Code, wDown.Body.String())
	}
}

