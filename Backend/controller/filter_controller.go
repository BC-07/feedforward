package controller

import (
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/gofiber/fiber/v2"
)

type feedbackModerationResult struct {
	IsFlagged    bool     `json:"is_flagged"`
	Severity     string   `json:"severity"`
	MatchedWords []string `json:"matched_words"`
	Reason       string   `json:"reason"`
}

type feedbackModerationRequest struct {
	Subject string `json:"subject"`
	Message string `json:"message"`
}

type feedbackWordRule struct {
	Word       string
	Severity   string
	Normalized string
	Compact    string
}

var (
	feedbackCharReplacer = strings.NewReplacer(
		"0", "o",
		"1", "i",
		"3", "e",
		"4", "a",
		"5", "s",
	)
	feedbackSpacePattern          = regexp.MustCompile(`\s+`)
	feedbackNonAlnumSpacePattern  = regexp.MustCompile(`[^a-z0-9\s]`)
	feedbackDirectAttackPattern   = regexp.MustCompile(`\b(?:you are|you're|ikaw ay)\b`)
	feedbackFilipinoAttackPattern = regexp.MustCompile(`\b(?:bobo|tanga|gago|ulol)\s+ka\b`)

	feedbackRulesOnce sync.Once
	feedbackRules     []feedbackWordRule
)

var fallbackFeedbackWordRules = []feedbackWordRule{
	{Word: "annoying", Severity: "warning"},
	{Word: "dumb", Severity: "warning"},
	{Word: "idiot", Severity: "offensive"},
	{Word: "stupid", Severity: "offensive"},
	{Word: "asshole", Severity: "offensive"},
	{Word: "bastard", Severity: "offensive"},
	{Word: "bitch", Severity: "offensive"},
	{Word: "bobo", Severity: "offensive"},
	{Word: "cunt", Severity: "offensive"},
	{Word: "faggot", Severity: "offensive"},
	{Word: "fuck", Severity: "offensive"},
	{Word: "gago", Severity: "offensive"},
	{Word: "moron", Severity: "offensive"},
	{Word: "nigger", Severity: "offensive"},
	{Word: "nigga", Severity: "offensive"},
	{Word: "retard", Severity: "offensive"},
	{Word: "shit", Severity: "offensive"},
	{Word: "slut", Severity: "offensive"},
	{Word: "tanga", Severity: "offensive"},
	{Word: "ulol", Severity: "offensive"},
	{Word: "whore", Severity: "offensive"},
}

func normalizeFeedbackText(text string) string {
	normalized := strings.ToLower(strings.TrimSpace(text))
	normalized = feedbackCharReplacer.Replace(normalized)
	normalized = collapseRepeatedChars(normalized)
	normalized = feedbackNonAlnumSpacePattern.ReplaceAllString(normalized, " ")
	normalized = feedbackSpacePattern.ReplaceAllString(normalized, " ")
	return strings.TrimSpace(normalized)
}

func collapseRepeatedChars(input string) string {
	if input == "" {
		return ""
	}

	runes := []rune(input)
	result := make([]rune, 0, len(runes))
	last := runes[0]
	count := 1
	result = append(result, last)

	for i := 1; i < len(runes); i++ {
		current := runes[i]
		if current == last {
			count++
			if count <= 2 {
				result = append(result, current)
			}
			continue
		}

		last = current
		count = 1
		result = append(result, current)
	}

	return string(result)
}

func compactFeedbackText(normalizedText string) string {
	return strings.ReplaceAll(normalizedText, " ", "")
}

func safeFeedbackModerationResult() feedbackModerationResult {
	return feedbackModerationResult{
		IsFlagged:    false,
		Severity:     "safe",
		MatchedWords: []string{},
		Reason:       "No harmful language detected.",
	}
}

func normalizeSeverity(raw string) string {
	severity := strings.ToLower(strings.TrimSpace(raw))
	if severity == "offensive" {
		return "offensive"
	}
	return "warning"
}

func findFeedbackCSVPath() string {
	if customPath := strings.TrimSpace(os.Getenv("WORD_FILTER_CSV_PATH")); customPath != "" {
		return customPath
	}

	candidates := []string{
		"word_filter.csv",
		filepath.Join("backend", "word_filter.csv"),
		filepath.Join("..", "backend", "word_filter.csv"),
		filepath.Join("..", "word_filter.csv"),
	}

	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && !info.IsDir() {
			return candidate
		}
	}

	return ""
}

func buildFeedbackRule(word string, severity string) (feedbackWordRule, bool) {
	normalizedWord := normalizeFeedbackText(word)
	if normalizedWord == "" {
		return feedbackWordRule{}, false
	}

	compactWord := compactFeedbackText(normalizedWord)
	if len(normalizedWord) < 3 && len(compactWord) < 3 {
		return feedbackWordRule{}, false
	}

	return feedbackWordRule{
		Word:       strings.ToLower(strings.TrimSpace(word)),
		Severity:   normalizeSeverity(severity),
		Normalized: normalizedWord,
		Compact:    compactWord,
	}, true
}

func loadFeedbackWordRulesFromCSV() ([]feedbackWordRule, error) {
	path := findFeedbackCSVPath()
	if path == "" {
		return nil, fmt.Errorf("word filter CSV not found")
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open word filter CSV: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read word filter CSV: %w", err)
	}

	rules := make([]feedbackWordRule, 0, len(records))
	seen := map[string]struct{}{}

	for i, record := range records {
		if len(record) == 0 {
			continue
		}

		word := strings.TrimSpace(record[0])
		severity := "warning"
		if len(record) > 1 {
			severity = strings.TrimSpace(record[1])
		}

		if i == 0 && strings.EqualFold(word, "word") && strings.EqualFold(severity, "severity") {
			continue
		}

		rule, ok := buildFeedbackRule(word, severity)
		if !ok {
			continue
		}

		key := rule.Normalized + "|" + rule.Severity
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		rules = append(rules, rule)
	}

	if len(rules) == 0 {
		return nil, fmt.Errorf("word filter CSV has no valid rows")
	}

	return rules, nil
}

func buildFallbackFeedbackWordRules() []feedbackWordRule {
	rules := make([]feedbackWordRule, 0, len(fallbackFeedbackWordRules))
	for _, fallback := range fallbackFeedbackWordRules {
		rule, ok := buildFeedbackRule(fallback.Word, fallback.Severity)
		if ok {
			rules = append(rules, rule)
		}
	}
	return rules
}

func getFeedbackWordRules() []feedbackWordRule {
	feedbackRulesOnce.Do(func() {
		loadedRules, err := loadFeedbackWordRulesFromCSV()
		if err != nil {
			log.Printf("filter: using fallback word list because CSV load failed: %v", err)
			feedbackRules = buildFallbackFeedbackWordRules()
			return
		}
		feedbackRules = loadedRules
		log.Printf("filter: loaded %d moderation rules from CSV", len(feedbackRules))
	})

	return feedbackRules
}

func analyzeFeedbackLanguage(subject string, message string) feedbackModerationResult {
	combined := strings.TrimSpace(subject + " " + message)
	normalized := normalizeFeedbackText(combined)
	if normalized == "" {
		return safeFeedbackModerationResult()
	}

	rules := getFeedbackWordRules()
	if len(rules) == 0 {
		return safeFeedbackModerationResult()
	}

	compact := compactFeedbackText(normalized)
	matchedSet := map[string]struct{}{}
	hasOffensiveWord := false
	hasWarningWord := false

	for _, rule := range rules {
		if strings.Contains(normalized, rule.Normalized) || (rule.Compact != "" && strings.Contains(compact, rule.Compact)) {
			matchedSet[rule.Word] = struct{}{}
			if rule.Severity == "offensive" {
				hasOffensiveWord = true
			} else {
				hasWarningWord = true
			}
		}
	}

	if len(matchedSet) == 0 {
		return safeFeedbackModerationResult()
	}

	matchedWords := make([]string, 0, len(matchedSet))
	for word := range matchedSet {
		matchedWords = append(matchedWords, word)
	}
	sort.Strings(matchedWords)

	isDirectAttack := (feedbackDirectAttackPattern.MatchString(normalized) || feedbackFilipinoAttackPattern.MatchString(normalized)) && len(matchedWords) > 0

	if hasOffensiveWord || isDirectAttack {
		reason := "Strong or directly targeted offensive language detected."
		if isDirectAttack {
			reason = "Direct personal attack detected in feedback text."
		}
		return feedbackModerationResult{
			IsFlagged:    true,
			Severity:     "offensive",
			MatchedWords: matchedWords,
			Reason:       reason,
		}
	}

	if hasWarningWord {
		return feedbackModerationResult{
			IsFlagged:    false,
			Severity:     "warning",
			MatchedWords: matchedWords,
			Reason:       "Mild negativity detected.",
		}
	}

	return safeFeedbackModerationResult()
}

func ModerateFeedback(c *fiber.Ctx) error {
	var req feedbackModerationRequest
	if err := parseBody(c, &req); err != nil {
		return parseError(c, "failed to parse moderation request", err)
	}

	result := analyzeFeedbackLanguage(req.Subject, req.Message)
	return success(c, fiber.StatusOK, result)
}
