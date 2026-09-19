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
			polls.GET("/:id", middleware.OptionalAuth(cfg.JWTSecret), pollController.GetPoll)
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
			admin.GET("/polls/:id/audit-logs", pollController.GetPollAuditLogs)
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
		DurationMinutes:  90,
		MinParticipants:  10,
		MaxParticipants:  500,
		EntryRequirement: "Verified Voter",
		RewardStructure:  "Winner Takes All XP",
	}

	// 1a. Verify validation: duration < 25 minutes is rejected
	invalidLowPayload := poolPayload
	invalidLowPayload.DurationMinutes = 20
	lowBody, _ := json.Marshal(invalidLowPayload)
	wLow := httptest.NewRecorder()
	reqLow, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(lowBody))
	reqLow.Header.Set("Content-Type", "application/json")
	reqLow.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wLow, reqLow)
	if wLow.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for duration < 25, got %d: %s", wLow.Code, wLow.Body.String())
	}

	// 1b. Verify validation: duration > 120 minutes (2 hrs) is rejected
	invalidHighPayload := poolPayload
	invalidHighPayload.DurationMinutes = 180
	highBody, _ := json.Marshal(invalidHighPayload)
	wHigh := httptest.NewRecorder()
	reqHigh, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(highBody))
	reqHigh.Header.Set("Content-Type", "application/json")
	reqHigh.Header.Set("Authorization", "Bearer "+authResp.Token)
	router.ServeHTTP(wHigh, reqHigh)
	if wHigh.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for duration > 120, got %d: %s", wHigh.Code, wHigh.Body.String())
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

func getAdminAuthToken(t *testing.T, router *gin.Engine) string {
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
		t.Fatalf("Admin login failed with code %d: %s", w.Code, w.Body.String())
	}
	var resp models.AuthResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	return resp.Token
}

func getUserAuthToken(t *testing.T, router *gin.Engine, email string) string {
	registerPayload := models.RegisterRequest{
		Email:    email,
		Username: "TestVoter_" + email[:5],
		Password: "password123",
	}
	body, _ := json.Marshal(registerPayload)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated && w.Code != http.StatusBadRequest {
		t.Fatalf("User register failed with code %d: %s", w.Code, w.Body.String())
	}
	var resp models.AuthResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Token != "" {
		return resp.Token
	}

	loginPayload := models.LoginRequest{
		Email:    email,
		Password: "password123",
	}
	lbody, _ := json.Marshal(loginPayload)
	lw := httptest.NewRecorder()
	lreq, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(lbody))
	lreq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(lw, lreq)
	var lresp models.AuthResponse
	_ = json.Unmarshal(lw.Body.Bytes(), &lresp)
	return lresp.Token
}

func TestAdminPollDurationConstraintsAndEscalation(t *testing.T) {
	router := setupTestRouter()
	adminToken := getAdminAuthToken(t, router)

	// 1. Attempt creating poll with < 25 min (e.g., 10 min) -> MUST FAIL (400)
	pollTooShort := models.CreatePollRequest{
		Title:           "Short Poll Test",
		Description:     "Duration below 25 min",
		Options:         []string{"Option 1", "Option 2"},
		DurationMinutes: 10,
	}
	b1, _ := json.Marshal(pollTooShort)
	w1 := httptest.NewRecorder()
	r1, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(b1))
	r1.Header.Set("Content-Type", "application/json")
	r1.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(w1, r1)

	if w1.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for duration < 25 min, got %d: %s", w1.Code, w1.Body.String())
	}

	// 2. Attempt creating poll with > 120 min (e.g., 150 min) -> MUST FAIL (400)
	pollTooLong := models.CreatePollRequest{
		Title:           "Long Poll Test",
		Description:     "Duration above 120 min",
		Options:         []string{"Option 1", "Option 2"},
		DurationMinutes: 150,
	}
	b2, _ := json.Marshal(pollTooLong)
	w2 := httptest.NewRecorder()
	r2, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(b2))
	r2.Header.Set("Content-Type", "application/json")
	r2.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(w2, r2)

	if w2.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request for duration > 120 min, got %d: %s", w2.Code, w2.Body.String())
	}

	// 3. Create poll within valid range 25 to 120 min (e.g. 45 min) -> MUST SUCCEED (201)
	pollValid := models.CreatePollRequest{
		Title:           "Valid Duration Poll",
		Description:     "Standard 45 min duration",
		Options:         []string{"Option Alpha", "Option Beta"},
		DurationMinutes: 45,
	}
	b3, _ := json.Marshal(pollValid)
	w3 := httptest.NewRecorder()
	r3, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(b3))
	r3.Header.Set("Content-Type", "application/json")
	r3.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(w3, r3)

	if w3.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for 45 min duration, got %d: %s", w3.Code, w3.Body.String())
	}

	// 4. Create poll outside standard range WITH valid escalation override -> MUST SUCCEED (201)
	pollEscalated := models.CreatePollRequest{
		Title:            "Urgent Crisis Vote",
		Description:      "Flash vote 15 min with authorization override",
		Options:          []string{"Approve Emergency Action", "Reject"},
		DurationMinutes:  15,
		EscalationCode:   "VOXENTRA_OVERRIDE_AUTH",
		EscalationReason: "Executive council emergency decree session",
	}
	b4, _ := json.Marshal(pollEscalated)
	w4 := httptest.NewRecorder()
	r4, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(b4))
	r4.Header.Set("Content-Type", "application/json")
	r4.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(w4, r4)

	if w4.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for escalation override, got %d: %s", w4.Code, w4.Body.String())
	}

	var created models.Poll
	_ = json.Unmarshal(w4.Body.Bytes(), &created)
	if !created.IsEscalated || created.DurationMinutes != 15 {
		t.Fatalf("Expected IsEscalated: true and Duration: 15, got: %+v", created)
	}
}

func TestZeroVoteOptionImmutabilityGuard(t *testing.T) {
	router := setupTestRouter()
	adminToken := getAdminAuthToken(t, router)
	voterToken := getUserAuthToken(t, router, "guardvoter@voxentra.com")

	// 1. Admin creates poll with 3 initial options
	createReq := models.CreatePollRequest{
		Title:           "Zero Vote Immutability Test Poll",
		Description:     "Testing option editing restrictions",
		Options:         []string{"Option One", "Option Two", "Option Three"},
		DurationMinutes: 50,
	}
	bCreate, _ := json.Marshal(createReq)
	wCreate := httptest.NewRecorder()
	rCreate, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(bCreate))
	rCreate.Header.Set("Content-Type", "application/json")
	rCreate.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wCreate, rCreate)

	if wCreate.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d", wCreate.Code)
	}

	var poll models.Poll
	_ = json.Unmarshal(wCreate.Body.Bytes(), &poll)

	// 2. Before any votes: Admin modifies options -> MUST SUCCEED (200)
	updateReqBeforeVotes := models.UpdatePollRequest{
		Title:       "Zero Vote Immutability Test Poll (Renamed)",
		Description: "Testing option editing restrictions updated",
		Options:     []string{"New Choice A", "New Choice B"},
	}
	bUp1, _ := json.Marshal(updateReqBeforeVotes)
	wUp1 := httptest.NewRecorder()
	rUp1, _ := http.NewRequest("PUT", "/api/admin/polls/"+poll.ID.Hex(), bytes.NewBuffer(bUp1))
	rUp1.Header.Set("Content-Type", "application/json")
	rUp1.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wUp1, rUp1)

	if wUp1.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK when editing options with 0 votes, got %d: %s", wUp1.Code, wUp1.Body.String())
	}

	// 3. User casts a vote
	voteReq := models.VoteRequest{
		OptionID: "opt_1",
	}
	bVote, _ := json.Marshal(voteReq)
	wVote := httptest.NewRecorder()
	rVote, _ := http.NewRequest("POST", "/api/polls/"+poll.ID.Hex()+"/vote", bytes.NewBuffer(bVote))
	rVote.Header.Set("Content-Type", "application/json")
	rVote.Header.Set("Authorization", "Bearer "+voterToken)
	router.ServeHTTP(wVote, rVote)

	if wVote.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for vote, got %d: %s", wVote.Code, wVote.Body.String())
	}

	// 4. After vote cast: Admin attempts to modify options -> MUST BE REJECTED (400)
	updateReqAfterVotes := models.UpdatePollRequest{
		Title:   "Zero Vote Immutability Test Poll (Renamed)",
		Options: []string{"Illegal Option Change 1", "Illegal Option Change 2"},
	}
	bUp2, _ := json.Marshal(updateReqAfterVotes)
	wUp2 := httptest.NewRecorder()
	rUp2, _ := http.NewRequest("PUT", "/api/admin/polls/"+poll.ID.Hex(), bytes.NewBuffer(bUp2))
	rUp2.Header.Set("Content-Type", "application/json")
	rUp2.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wUp2, rUp2)

	if wUp2.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request when editing options after votes cast, got %d: %s", wUp2.Code, wUp2.Body.String())
	}

	// 5. Admin updates only title & duration (keeping options unedited) -> MUST SUCCEED (200)
	updateSettingsOnly := models.UpdatePollRequest{
		Title:           "Poll Title Updated Successfully",
		DurationMinutes: 75,
	}
	bUp3, _ := json.Marshal(updateSettingsOnly)
	wUp3 := httptest.NewRecorder()
	rUp3, _ := http.NewRequest("PUT", "/api/admin/polls/"+poll.ID.Hex(), bytes.NewBuffer(bUp3))
	rUp3.Header.Set("Content-Type", "application/json")
	rUp3.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wUp3, rUp3)

	if wUp3.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK when editing non-option fields after votes cast, got %d: %s", wUp3.Code, wUp3.Body.String())
	}
}

func TestMultiSelectionVotingAndResultVisibility(t *testing.T) {
	router := setupTestRouter()
	adminToken := getAdminAuthToken(t, router)
	voterToken := getUserAuthToken(t, router, "multivoter@voxentra.com")

	// 1. Create multi-selection poll with result_visibility = "after_vote"
	createReq := models.CreatePollRequest{
		Title:            "Multi-Choice Feature Voting",
		Description:      "Pick up to 2 top features",
		Options:          []string{"Real-time Stats", "Dark Mode", "CSV Export", "Custom Webhooks"},
		DurationMinutes:  40,
		SelectionType:    "multiple",
		MaxSelections:    2,
		ResultVisibility: "after_vote",
	}
	bCreate, _ := json.Marshal(createReq)
	wCreate := httptest.NewRecorder()
	rCreate, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(bCreate))
	rCreate.Header.Set("Content-Type", "application/json")
	rCreate.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wCreate, rCreate)

	if wCreate.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d: %s", wCreate.Code, wCreate.Body.String())
	}

	var poll models.Poll
	_ = json.Unmarshal(wCreate.Body.Bytes(), &poll)

	// 2. Fetch poll as voter before voting -> Results MUST BE HIDDEN
	wGetPre := httptest.NewRecorder()
	rGetPre, _ := http.NewRequest("GET", "/api/polls/"+poll.ID.Hex(), nil)
	rGetPre.Header.Set("Authorization", "Bearer "+voterToken)
	router.ServeHTTP(wGetPre, rGetPre)

	var getPreResp struct {
		Poll     models.Poll `json:"poll"`
		HasVoted bool        `json:"has_voted"`
	}
	_ = json.Unmarshal(wGetPre.Body.Bytes(), &getPreResp)

	if !getPreResp.Poll.ResultsHidden {
		t.Fatalf("Expected results to be hidden before vote, got: %+v", getPreResp.Poll)
	}

	// 3. User attempts to vote for 3 options (exceeds max_selections: 2) -> MUST FAIL (400)
	invalidVote := models.VoteRequest{
		OptionIDs: []string{"opt_1", "opt_2", "opt_3"},
	}
	bInvVote, _ := json.Marshal(invalidVote)
	wInvVote := httptest.NewRecorder()
	rInvVote, _ := http.NewRequest("POST", "/api/polls/"+poll.ID.Hex()+"/vote", bytes.NewBuffer(bInvVote))
	rInvVote.Header.Set("Content-Type", "application/json")
	rInvVote.Header.Set("Authorization", "Bearer "+voterToken)
	router.ServeHTTP(wInvVote, rInvVote)

	if wInvVote.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request when selecting more than max_selections, got %d", wInvVote.Code)
	}

	// 4. User votes for 2 options -> MUST SUCCEED (200)
	validVote := models.VoteRequest{
		OptionIDs: []string{"opt_1", "opt_2"},
	}
	bValidVote, _ := json.Marshal(validVote)
	wValidVote := httptest.NewRecorder()
	rValidVote, _ := http.NewRequest("POST", "/api/polls/"+poll.ID.Hex()+"/vote", bytes.NewBuffer(bValidVote))
	rValidVote.Header.Set("Content-Type", "application/json")
	rValidVote.Header.Set("Authorization", "Bearer "+voterToken)
	router.ServeHTTP(wValidVote, rValidVote)

	if wValidVote.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for valid multi-selection vote, got %d: %s", wValidVote.Code, wValidVote.Body.String())
	}

	// 5. Fetch poll after voting -> Results MUST BE REVEALED
	wGetPost := httptest.NewRecorder()
	rGetPost, _ := http.NewRequest("GET", "/api/polls/"+poll.ID.Hex(), nil)
	rGetPost.Header.Set("Authorization", "Bearer "+voterToken)
	router.ServeHTTP(wGetPost, rGetPost)

	var getPostResp struct {
		Poll     models.Poll `json:"poll"`
		HasVoted bool        `json:"has_voted"`
	}
	_ = json.Unmarshal(wGetPost.Body.Bytes(), &getPostResp)

	if getPostResp.Poll.ResultsHidden {
		t.Fatalf("Expected results to be revealed after vote was cast")
	}
	if !getPostResp.HasVoted {
		t.Fatalf("Expected HasVoted: true after submitting vote")
	}
}

func TestAdminAuditLogTracking(t *testing.T) {
	router := setupTestRouter()
	adminToken := getAdminAuthToken(t, router)

	// 1. Admin creates poll
	createReq := models.CreatePollRequest{
		Title:           "Audit Log Test Poll",
		Description:     "Auditing changes",
		Options:         []string{"Option 1", "Option 2"},
		DurationMinutes: 60,
	}
	bCreate, _ := json.Marshal(createReq)
	wCreate := httptest.NewRecorder()
	rCreate, _ := http.NewRequest("POST", "/api/admin/polls", bytes.NewBuffer(bCreate))
	rCreate.Header.Set("Content-Type", "application/json")
	rCreate.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wCreate, rCreate)

	var poll models.Poll
	_ = json.Unmarshal(wCreate.Body.Bytes(), &poll)

	// 2. Admin edits duration to 90 min
	upDur := models.UpdatePollRequest{
		Title:           poll.Title,
		DurationMinutes: 90,
	}
	bUp, _ := json.Marshal(upDur)
	wUp := httptest.NewRecorder()
	rUp, _ := http.NewRequest("PUT", "/api/admin/polls/"+poll.ID.Hex(), bytes.NewBuffer(bUp))
	rUp.Header.Set("Content-Type", "application/json")
	rUp.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wUp, rUp)

	if wUp.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for duration change, got %d", wUp.Code)
	}

	// 3. Admin retrieves audit logs for this poll
	wLogs := httptest.NewRecorder()
	rLogs, _ := http.NewRequest("GET", "/api/admin/polls/"+poll.ID.Hex()+"/audit-logs", nil)
	rLogs.Header.Set("Authorization", "Bearer "+adminToken)
	router.ServeHTTP(wLogs, rLogs)

	if wLogs.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for audit logs, got %d: %s", wLogs.Code, wLogs.Body.String())
	}

	var logsResp struct {
		AuditLogs []models.AuditLog `json:"audit_logs"`
	}
	_ = json.Unmarshal(wLogs.Body.Bytes(), &logsResp)

	if len(logsResp.AuditLogs) < 2 {
		t.Fatalf("Expected at least 2 audit logs (creation + duration change), found %d: %+v", len(logsResp.AuditLogs), logsResp.AuditLogs)
	}
}


