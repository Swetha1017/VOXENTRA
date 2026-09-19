package database

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"live-polling-backend/models"

	"github.com/redis/go-redis/v9"
)

type RealtimeManager interface {
	RecordVote(ctx context.Context, pollID string, optionID string, voterID string) (*models.LivePollUpdate, error)
	GetLiveVotes(ctx context.Context, pollID string) (map[string]int64, int64, error)
	PublishUpdate(ctx context.Context, update *models.LivePollUpdate) error
	SubscribeToPoll(ctx context.Context, pollID string, handler func(update *models.LivePollUpdate)) (func(), error)
	HasVoted(ctx context.Context, pollID string, voterID string) bool
	IsRealRedis() bool
}

var Realtime RealtimeManager

type RedisManager struct {
	client *redis.Client
}

type InMemoryRealtimeManager struct {
	mu          sync.RWMutex
	votes       map[string]map[string]int64 // pollID -> optionID -> count
	voters      map[string]map[string]bool  // pollID -> voterID -> true
	subscribers map[string][]chan *models.LivePollUpdate
}

func InitRedis(uri string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var opt *redis.Options
	var err error

	if strings.HasPrefix(uri, "redis://") || strings.HasPrefix(uri, "rediss://") {
		opt, err = redis.ParseURL(uri)
	} else {
		opt = &redis.Options{
			Addr: uri,
		}
	}

	if err == nil {
		client := redis.NewClient(opt)
		if err = client.Ping(ctx).Err(); err == nil {
			log.Println("[Redis] Connected successfully to:", uri)
			Realtime = &RedisManager{client: client}
			return
		}
	}

	log.Println("[Redis] Warning: Real Redis not reachable (" + err.Error() + "). Initializing thread-safe in-memory realtime manager for local testing.")
	Realtime = NewInMemoryRealtimeManager()
}

func NewInMemoryRealtimeManager() *InMemoryRealtimeManager {
	return &InMemoryRealtimeManager{
		votes:       make(map[string]map[string]int64),
		voters:      make(map[string]map[string]bool),
		subscribers: make(map[string][]chan *models.LivePollUpdate),
	}
}

// RedisManager Implementation
func (r *RedisManager) IsRealRedis() bool { return true }

func (r *RedisManager) HasVoted(ctx context.Context, pollID string, voterID string) bool {
	if voterID == "" {
		return false
	}
	voterKey := "poll:" + pollID + ":voters"
	isMember, err := r.client.SIsMember(ctx, voterKey, voterID).Result()
	if err != nil {
		return false
	}
	return isMember
}

func (r *RedisManager) RecordVote(ctx context.Context, pollID string, optionID string, voterID string) (*models.LivePollUpdate, error) {
	voterKey := "poll:" + pollID + ":voters"
	votesKey := "poll:" + pollID + ":votes"

	if voterID != "" {
		added, err := r.client.SAdd(ctx, voterKey, voterID).Result()
		if err != nil {
			return nil, err
		}
		if added == 0 {
			return nil, errors.New("already_voted")
		}
	}

	// Atomic vote count increment
	_, err := r.client.HIncrBy(ctx, votesKey, optionID, 1).Result()
	if err != nil {
		return nil, err
	}

	// Fetch all option counts
	optionMap, totalVotes, err := r.GetLiveVotes(ctx, pollID)
	if err != nil {
		return nil, err
	}

	update := &models.LivePollUpdate{
		PollID:          pollID,
		TotalVotes:      totalVotes,
		OptionVotes:     optionMap,
		LastVotedOption: optionID,
		Timestamp:       time.Now().UnixMilli(),
	}

	// Publish to Redis Pub/Sub channel
	_ = r.PublishUpdate(ctx, update)

	return update, nil
}

func (r *RedisManager) GetLiveVotes(ctx context.Context, pollID string) (map[string]int64, int64, error) {
	votesKey := "poll:" + pollID + ":votes"
	data, err := r.client.HGetAll(ctx, votesKey).Result()
	if err != nil {
		return nil, 0, err
	}

	result := make(map[string]int64)
	var total int64 = 0

	for optID, countStr := range data {
		count, _ := strconv.ParseInt(countStr, 10, 64)
		result[optID] = count
		total += count
	}

	return result, total, nil
}

func (r *RedisManager) PublishUpdate(ctx context.Context, update *models.LivePollUpdate) error {
	channel := "poll_updates:" + update.PollID
	payload, err := json.Marshal(update)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, channel, payload).Err()
}

func (r *RedisManager) SubscribeToPoll(ctx context.Context, pollID string, handler func(update *models.LivePollUpdate)) (func(), error) {
	channel := "poll_updates:" + pollID
	pubsub := r.client.Subscribe(ctx, channel)

	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			var update models.LivePollUpdate
			if err := json.Unmarshal([]byte(msg.Payload), &update); err == nil {
				handler(&update)
			}
		}
	}()

	cancelFunc := func() {
		_ = pubsub.Close()
	}

	return cancelFunc, nil
}

// InMemoryRealtimeManager Implementation (Fallback)
func (m *InMemoryRealtimeManager) IsRealRedis() bool { return false }

func (m *InMemoryRealtimeManager) HasVoted(ctx context.Context, pollID string, voterID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if voterID == "" {
		return false
	}
	if vMap, exists := m.voters[pollID]; exists {
		return vMap[voterID]
	}
	return false
}

func (m *InMemoryRealtimeManager) RecordVote(ctx context.Context, pollID string, optionID string, voterID string) (*models.LivePollUpdate, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if voterID != "" {
		if _, exists := m.voters[pollID]; !exists {
			m.voters[pollID] = make(map[string]bool)
		}
		if m.voters[pollID][voterID] {
			return nil, errors.New("already_voted")
		}
		m.voters[pollID][voterID] = true
	}

	if _, exists := m.votes[pollID]; !exists {
		m.votes[pollID] = make(map[string]int64)
	}
	m.votes[pollID][optionID]++

	optionMap := make(map[string]int64)
	var total int64 = 0
	for opt, count := range m.votes[pollID] {
		optionMap[opt] = count
		total += count
	}

	update := &models.LivePollUpdate{
		PollID:          pollID,
		TotalVotes:      total,
		OptionVotes:     optionMap,
		LastVotedOption: optionID,
		Timestamp:       time.Now().UnixMilli(),
	}

	// Broadcast to local subscribers
	if subs, exists := m.subscribers[pollID]; exists {
		for _, ch := range subs {
			select {
			case ch <- update:
			default:
			}
		}
	}

	return update, nil
}

func (m *InMemoryRealtimeManager) GetLiveVotes(ctx context.Context, pollID string) (map[string]int64, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]int64)
	var total int64 = 0

	if optMap, exists := m.votes[pollID]; exists {
		for opt, count := range optMap {
			result[opt] = count
			total += count
		}
	}

	return result, total, nil
}

func (m *InMemoryRealtimeManager) PublishUpdate(ctx context.Context, update *models.LivePollUpdate) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if subs, exists := m.subscribers[update.PollID]; exists {
		for _, ch := range subs {
			select {
			case ch <- update:
			default:
			}
		}
	}
	return nil
}

func (m *InMemoryRealtimeManager) SubscribeToPoll(ctx context.Context, pollID string, handler func(update *models.LivePollUpdate)) (func(), error) {
	m.mu.Lock()
	ch := make(chan *models.LivePollUpdate, 100)
	m.subscribers[pollID] = append(m.subscribers[pollID], ch)
	m.mu.Unlock()

	stopCh := make(chan struct{})

	go func() {
		for {
			select {
			case update := <-ch:
				handler(update)
			case <-stopCh:
				return
			}
		}
	}()

	cancelFunc := func() {
		close(stopCh)
		m.mu.Lock()
		defer m.mu.Unlock()
		if subs, exists := m.subscribers[pollID]; exists {
			for i, subscriberCh := range subs {
				if subscriberCh == ch {
					m.subscribers[pollID] = append(subs[:i], subs[i+1:]...)
					break
				}
			}
		}
	}

	return cancelFunc, nil
}
