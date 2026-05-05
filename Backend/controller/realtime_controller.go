package controller

import (
	"bufio"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

type adminRealtimeEvent struct {
	Type       string    `json:"type"`
	FeedbackID string    `json:"feedbackId"`
	Category   string    `json:"category"`
	CreatedAt  time.Time `json:"createdAt"`
}

type adminRealtimeHub struct {
	mu      sync.RWMutex
	clients map[string]map[chan adminRealtimeEvent]struct{}
}

func newAdminRealtimeHub() *adminRealtimeHub {
	return &adminRealtimeHub{
		clients: make(map[string]map[chan adminRealtimeEvent]struct{}),
	}
}

func (h *adminRealtimeHub) subscribe(unit string) chan adminRealtimeEvent {
	normalized := strings.ToLower(strings.TrimSpace(unit))
	ch := make(chan adminRealtimeEvent, 16)

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[normalized]; !ok {
		h.clients[normalized] = make(map[chan adminRealtimeEvent]struct{})
	}
	h.clients[normalized][ch] = struct{}{}
	return ch
}

func (h *adminRealtimeHub) unsubscribe(unit string, ch chan adminRealtimeEvent) {
	normalized := strings.ToLower(strings.TrimSpace(unit))

	h.mu.Lock()
	defer h.mu.Unlock()

	unitClients, ok := h.clients[normalized]
	if !ok {
		return
	}
	if _, exists := unitClients[ch]; exists {
		delete(unitClients, ch)
		close(ch)
	}
	if len(unitClients) == 0 {
		delete(h.clients, normalized)
	}
}

func (h *adminRealtimeHub) publish(unit string, event adminRealtimeEvent) {
	normalized := strings.ToLower(strings.TrimSpace(unit))

	h.mu.RLock()
	defer h.mu.RUnlock()

	unitClients, ok := h.clients[normalized]
	if !ok {
		return
	}

	for ch := range unitClients {
		select {
		case ch <- event:
		default:
			// Drop instead of blocking to keep writes non-disruptive.
		}
	}
}

var adminEventsHub = newAdminRealtimeHub()

func emitAdminFeedbackCreated(category string, feedbackID string) {
	adminEventsHub.publish(category, adminRealtimeEvent{
		Type:       "feedback_created",
		FeedbackID: strings.TrimSpace(feedbackID),
		Category:   strings.TrimSpace(category),
		CreatedAt:  utcNow(),
	})
}

func emitAdminMessageCreated(category string, feedbackID string) {
	adminEventsHub.publish(category, adminRealtimeEvent{
		Type:       "message_created",
		FeedbackID: strings.TrimSpace(feedbackID),
		Category:   strings.TrimSpace(category),
		CreatedAt:  utcNow(),
	})
}

func StreamAdminEvents(c *fiber.Ctx) error {
	session, err := requireAdminSession(c)
	if err != nil {
		return err
	}
	if session.AdminID == nil || strings.TrimSpace(*session.AdminID) == "" {
		return unauthorized(c, "invalid admin session")
	}

	admin, err := fetchAdminByID(strings.TrimSpace(*session.AdminID))
	if err != nil {
		return serverError(c, "failed to load admin", err)
	}
	if admin.ID == "" || admin.IsDisabled {
		return unauthorized(c, "invalid admin session")
	}

	unit := strings.TrimSpace(admin.Unit)
	if unit == "" {
		return invalidRequest(c, "admin unit is required")
	}

	stream := adminEventsHub.subscribe(unit)
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		pingTicker := time.NewTicker(20 * time.Second)
		defer pingTicker.Stop()
		defer adminEventsHub.unsubscribe(unit, stream)

		if _, err := fmt.Fprintf(w, "event: connected\ndata: {\"ok\":true}\n\n"); err != nil {
			return
		}
		if err := w.Flush(); err != nil {
			return
		}

		for {
			select {
			case <-pingTicker.C:
				if _, err := fmt.Fprintf(w, "event: ping\ndata: {}\n\n"); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			case event, ok := <-stream:
				if !ok {
					return
				}
				payload, err := json.Marshal(event)
				if err != nil {
					continue
				}
				if _, err := fmt.Fprintf(w, "event: admin_event\ndata: %s\n\n", payload); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	}))

	return nil
}
