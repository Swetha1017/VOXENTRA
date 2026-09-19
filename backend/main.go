package main

import (
	"log"
	"net/http"

	"live-polling-backend/config"
	"live-polling-backend/controllers"
	"live-polling-backend/database"
	"live-polling-backend/middleware"
	"live-polling-backend/websocket"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	// Initialize MongoDB and Redis storage managers
	database.InitMongo(cfg.MongoURI)
	database.InitRedis(cfg.RedisURI)

	// Initialize Real-time WebSocket Hub
	websocket.InitHub()

	router := gin.Default()

	// Apply CORS
	router.Use(middleware.CORSMiddleware(cfg.CORSOrigin))

	// Health Check / System Diagnostics Endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":     "healthy",
			"service":    "voxentra-backend",
			"version":    "2.0.0",
			"real_mongo": database.DB.IsRealDB(),
			"real_redis": database.Realtime.IsRealRedis(),
		})
	})

	// Controllers
	authController := controllers.NewAuthController(cfg.JWTSecret)
	pollController := controllers.NewPollController()
	commentController := controllers.NewCommentController()
	gameController := controllers.NewGameController()

	// API Routes Group
	api := router.Group("/api")
	{
		// 1. Authentication Routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", authController.Register)
			auth.POST("/login", authController.Login)
			auth.POST("/admin-login", authController.AdminLogin) // Separate secure admin login
			auth.GET("/me", middleware.AuthRequired(cfg.JWTSecret), authController.GetMe)
		}

		// 2. User Profile & Dashboard Routes
		user := api.Group("/user")
		user.Use(middleware.AuthRequired(cfg.JWTSecret))
		{
			user.GET("/dashboard", authController.GetUserDashboard)
		}

		// 3. Polls Routes
		polls := api.Group("/polls")
		{
			polls.GET("", pollController.GetPolls)
			polls.GET("/active", pollController.GetActivePoll)
			polls.GET("/:id", pollController.GetPoll)
			polls.POST("/:id/reaction", pollController.ReactToPoll)
			polls.POST("/referral/:source", pollController.TrackReferral)

			// Voting requires mandatory user authentication
			authorizedVoting := polls.Group("")
			authorizedVoting.Use(middleware.AuthRequired(cfg.JWTSecret))
			{
				authorizedVoting.POST("/:id/vote", pollController.Vote)
			}
		}

		// 4. Live Commentary Stream Routes
		comments := api.Group("/comments")
		{
			comments.GET("", commentController.GetComments)
			comments.POST("", middleware.AuthRequired(cfg.JWTSecret), commentController.PostComment)
		}

		// 5. Games & Leaderboard Routes
		games := api.Group("/games")
		{
			games.GET("/leaderboard", gameController.GetGameLeaderboard)
			games.POST("/score", middleware.AuthRequired(cfg.JWTSecret), gameController.SubmitScore)
		}

		api.GET("/leaderboard", gameController.GetGlobalLeaderboard)

		// 6. Dedicated Secure Admin Routes (Exclusive Access for swetha4110@gmail.com)
		admin := api.Group("/admin")
		admin.Use(middleware.AdminRequired(cfg.JWTSecret))
		{
			// Pool & Session Management
			admin.POST("/polls", pollController.AdminCreatePoll)
			admin.PUT("/polls/:id", pollController.AdminUpdatePoll)
			admin.DELETE("/polls/:id", pollController.AdminDeletePoll)
			admin.DELETE("/polls/:id/permanent", pollController.AdminPermanentDeletePoll)
			admin.PATCH("/polls/:id/status", pollController.AdminTogglePoll)
			admin.PATCH("/polls/:id/pause", pollController.AdminPausePoll)
			admin.PATCH("/polls/:id/resume", pollController.AdminResumePoll)
			admin.PATCH("/polls/:id/end", pollController.AdminEndPoll)

			// Analytics Dashboard
			admin.GET("/analytics", pollController.AdminGetAnalytics)

			// Commentary Moderation
			admin.GET("/comments", commentController.AdminGetAllComments)
			admin.DELETE("/comments/:id", commentController.AdminDeleteComment)
		}
	}

	// Real-Time WebSockets
	router.GET("/ws/polls/:id", websocket.HandleWebSocket)
	router.GET("/ws/live", websocket.HandleGlobalWebSocket)

	log.Printf("[Voxentra Server] Starting backend on port :%s ...\n", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
