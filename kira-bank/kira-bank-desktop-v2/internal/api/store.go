package api

import (
	"sync"

	"github.com/zalando/go-keyring"
)

// TokenStore persists the refresh token, keyed by server base URL.
type TokenStore interface {
	Get(key string) string
	Set(key, token string)
	Delete(key string)
}

const keyringService = "kira-bank-desktop"

// KeyringStore uses the OS keyring and silently falls back to memory when the
// keyring is unavailable (the app keeps working, the session just is not remembered).
type KeyringStore struct {
	mu  sync.Mutex
	mem map[string]string
}

func NewKeyringStore() *KeyringStore { return &KeyringStore{mem: map[string]string{}} }

func (s *KeyringStore) Get(key string) string {
	if v, err := keyring.Get(keyringService, key); err == nil {
		return v
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.mem[key]
}

func (s *KeyringStore) Set(key, token string) {
	if err := keyring.Set(keyringService, key, token); err == nil {
		return
	}
	s.mu.Lock()
	s.mem[key] = token
	s.mu.Unlock()
}

func (s *KeyringStore) Delete(key string) {
	_ = keyring.Delete(keyringService, key)
	s.mu.Lock()
	delete(s.mem, key)
	s.mu.Unlock()
}

// MemStore is an in-memory TokenStore (tests).
type MemStore struct {
	mu sync.Mutex
	m  map[string]string
}

func NewMemStore() *MemStore { return &MemStore{m: map[string]string{}} }
func (s *MemStore) Get(k string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.m[k]
}
func (s *MemStore) Set(k, v string) { s.mu.Lock(); s.m[k] = v; s.mu.Unlock() }
func (s *MemStore) Delete(k string) { s.mu.Lock(); delete(s.m, k); s.mu.Unlock() }
