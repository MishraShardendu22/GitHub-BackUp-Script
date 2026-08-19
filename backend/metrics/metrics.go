package metrics

import (
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type MetricsCollector struct {
	mu                 sync.RWMutex
	startTime          time.Time
	httpRequests       map[string]*uint64
	httpDurationSum    map[string]*float64
	httpDurationCnt    map[string]*uint64
	dbQueryDurationSum float64
	dbQueryCount       uint64
}

var DefaultMetrics = NewMetricsCollector()

func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		startTime:       time.Now(),
		httpRequests:    make(map[string]*uint64),
		httpDurationSum: make(map[string]*float64),
		httpDurationCnt: make(map[string]*uint64),
	}
}

// RecordHTTPRequest records an HTTP request metrics entry.
func (m *MetricsCollector) RecordHTTPRequest(method, path string, status int, duration time.Duration) {
	key := fmt.Sprintf("%s_%s_%d", method, path, status)
	durSec := duration.Seconds()

	m.mu.Lock()
	defer m.mu.Unlock()

	// Increment request count
	if ptr, ok := m.httpRequests[key]; ok {
		atomic.AddUint64(ptr, 1)
	} else {
		var cnt uint64 = 1
		m.httpRequests[key] = &cnt
	}

	// Add to duration sum & count
	pathKey := fmt.Sprintf("%s_%s", method, path)
	if sumPtr, ok := m.httpDurationSum[pathKey]; ok {
		*sumPtr += durSec
		atomic.AddUint64(m.httpDurationCnt[pathKey], 1)
	} else {
		sum := durSec
		var cnt uint64 = 1
		m.httpDurationSum[pathKey] = &sum
		m.httpDurationCnt[pathKey] = &cnt
	}
}

// RecordDBQuery records a database query duration.
func (m *MetricsCollector) RecordDBQuery(duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.dbQueryDurationSum += duration.Seconds()
	m.dbQueryCount++
}

// Snapshot returns a structured summary for JSON reporting.
func (m *MetricsCollector) Snapshot(wsConnections int) map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	requests := make(map[string]uint64)
	for k, v := range m.httpRequests {
		requests[k] = atomic.LoadUint64(v)
	}

	latencies := make(map[string]float64)
	for k, sumPtr := range m.httpDurationSum {
		cnt := atomic.LoadUint64(m.httpDurationCnt[k])
		if cnt > 0 {
			latencies[k+"_avg_seconds"] = *sumPtr / float64(cnt)
		}
	}

	var avgDB float64
	if m.dbQueryCount > 0 {
		avgDB = m.dbQueryDurationSum / float64(m.dbQueryCount)
	}

	return map[string]interface{}{
		"uptime_seconds":        time.Since(m.startTime).Seconds(),
		"active_ws_connections": wsConnections,
		"http_requests_total":   requests,
		"http_avg_latencies":    latencies,
		"db_query_count":        m.dbQueryCount,
		"db_query_avg_seconds":  avgDB,
	}
}

// PrometheusExport formats metrics in Prometheus text exposition format.
func (m *MetricsCollector) PrometheusExport(wsConnections int) string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var sb strings.Builder
	sb.WriteString("# HELP app_uptime_seconds Application uptime in seconds\n")
	sb.WriteString("# TYPE app_uptime_seconds gauge\n")
	sb.WriteString(fmt.Sprintf("app_uptime_seconds %.2f\n\n", time.Since(m.startTime).Seconds()))

	sb.WriteString("# HELP websocket_active_connections Number of active live websocket connections\n")
	sb.WriteString("# TYPE websocket_active_connections gauge\n")
	sb.WriteString(fmt.Sprintf("websocket_active_connections %d\n\n", wsConnections))

	sb.WriteString("# HELP http_requests_total Total number of HTTP requests\n")
	sb.WriteString("# TYPE http_requests_total counter\n")
	for k, v := range m.httpRequests {
		parts := strings.Split(k, "_")
		if len(parts) >= 3 {
			method := parts[0]
			path := parts[1]
			status := parts[2]
			sb.WriteString(fmt.Sprintf("http_requests_total{method=\"%s\",path=\"%s\",status=\"%s\"} %d\n", method, path, status, atomic.LoadUint64(v)))
		}
	}

	sb.WriteString("\n# HELP http_request_duration_seconds_sum Total HTTP request latency sum in seconds\n")
	sb.WriteString("# TYPE http_request_duration_seconds_sum summary\n")
	for k, sumPtr := range m.httpDurationSum {
		parts := strings.Split(k, "_")
		if len(parts) >= 2 {
			method := parts[0]
			path := parts[1]
			cnt := atomic.LoadUint64(m.httpDurationCnt[k])
			sb.WriteString(fmt.Sprintf("http_request_duration_seconds_sum{method=\"%s\",path=\"%s\"} %.6f\n", method, path, *sumPtr))
			sb.WriteString(fmt.Sprintf("http_request_duration_seconds_count{method=\"%s\",path=\"%s\"} %d\n", method, path, cnt))
		}
	}

	return sb.String()
}
