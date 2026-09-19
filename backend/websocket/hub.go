package websocket

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"live-polling-backend/database"
	"live-polling-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for WebSocket connections
	},
}

type Client struct {
	hub     *Hub
	conn    *websocket.Conn
	send    chan []byte
	channel string
}

type Hub struct {
	mu         sync.RWMutex
	clients    map[string]map[*Client]bool // channel -> client set
	cancelSubs map[string]func()
	register   chan *Client
	unregister chan *Client
	broadcast  chan *GenericBroadcast
}

type GenericBroadcast struct {
	Channel string
	Payload []byte
}

var GlobalHub *Hub

func InitHub() {
	GlobalHub = &Hub{
		clients:    make(map[string]map[*Client]bool),
		cancelSubs: make(map[string]func()),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *GenericBroadcast, 512),
	}
	go GlobalHub.run()
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, exists := h.clients[client.channel]; !exists {
				h.clients[client.channel] = make(map[*Client]bool)

				// If it's a poll channel, subscribe to Redis Pub/Sub if available
				if client.channel != "global" && client.channel != "" {
					channelName := client.channel
					cancelFn, err := database.Realtime.SubscribeToPoll(context.Background(), channelName, func(update *models.LivePollUpdate) {
						data, _ := json.Marshal(gin.H{
							"type": "poll_update",
							"data": update,
						})
						h.broadcast <- &GenericBroadcast{Channel: channelName, Payload: data}
						h.broadcast <- &GenericBroadcast{Channel: "global", Payload: data}
					})
					if err == nil && cancelFn != nil {
						h.cancelSubs[channelName] = cancelFn
					}
				}
			}
			h.clients[client.channel][client] = true
			h.mu.Unlock()

			// Send welcome ping
			welcome, _ := json.Marshal(gin.H{
				"type":    "connected",
				"channel": client.channel,
				"time":    time.Now().UnixMilli(),
			})
			select {
			case client.send <- welcome:
			default:
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if clientMap, exists := h.clients[client.channel]; exists {
				if _, ok := clientMap[client]; ok {
					delete(clientMap, client)
					close(client.send)
				}
				if len(clientMap) == 0 {
					delete(h.clients, client.channel)
					if cancelFn, hasCancel := h.cancelSubs[client.channel]; hasCancel {
						cancelFn()
						delete(h.cancelSubs, client.channel)
					}
				}
			}
			h.mu.Unlock()

		case b := <-h.broadcast:
			h.mu.RLock()
			// Send to specific channel
			if clients, ok := h.clients[b.Channel]; ok {
				for client := range clients {
					select {
					case client.send <- b.Payload:
					default:
						close(client.send)
						delete(clients, client)
					}
				}
			}
			// If not already global, also broadcast to "global" listeners
			if b.Channel != "global" {
				if globalClients, ok := h.clients["global"]; ok {
					for client := range globalClients {
						select {
						case client.send <- b.Payload:
						default:
							close(client.send)
							delete(globalClients, client)
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(1024)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func HandleWebSocket(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		pollID = "global"
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("[WebSocket] Upgrade error:", err)
		return
	}

	client := &Client{
		hub:     GlobalHub,
		conn:    conn,
		send:    make(chan []byte, 256),
		channel: pollID,
	}

	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func HandleGlobalWebSocket(c *gin.Context) {
	channel := c.DefaultQuery("channel", "global")
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("[WebSocket] Global Upgrade error:", err)
		return
	}

	client := &Client{
		hub:     GlobalHub,
		conn:    conn,
		send:    make(chan []byte, 256),
		channel: channel,
	}

	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

// Broadcast Helpers
func BroadcastPollUpdate(update *models.LivePollUpdate) {
	if GlobalHub == nil || update == nil {
		return
	}
	payload, err := json.Marshal(gin.H{
		"type": "poll_update",
		"data": update,
	})
	if err == nil {
		GlobalHub.broadcast <- &GenericBroadcast{
			Channel: update.PollID,
			Payload: payload,
		}
	}
}

func BroadcastCommentUpdate(update *models.LiveCommentUpdate) {
	if GlobalHub == nil || update == nil {
		return
	}
	payload, err := json.Marshal(gin.H{
		"type": "comment_update",
		"data": update,
	})
	if err == nil {
		GlobalHub.broadcast <- &GenericBroadcast{
			Channel: update.Comment.TargetID,
			Payload: payload,
		}
	}
}

func BroadcastEvent(eventType string, data interface{}) {
	if GlobalHub == nil {
		return
	}
	payload, err := json.Marshal(gin.H{
		"type": eventType,
		"data": data,
	})
	if err == nil {
		GlobalHub.broadcast <- &GenericBroadcast{
			Channel: "global",
			Payload: payload,
		}
	}
}
