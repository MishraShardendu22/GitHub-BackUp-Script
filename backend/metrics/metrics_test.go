package metrics

import (
	"strings"
	"testing"
	"time"
)

func TestMetricsCollection(t *testing.T) {
	DefaultMetrics.RecordHTTPRequest("GET", "/api/test", 200, 50*time.Millisecond)
	DefaultMetrics.RecordDBQuery(10 * time.Millisecond)

	snap := DefaultMetrics.Snapshot(1)
	if snap["uptime_seconds"] == nil {
		t.Error("expected uptime_seconds in snapshot")
	}

	prom := DefaultMetrics.PrometheusExport(1)
	if !strings.Contains(prom, "http_requests_total") {
		t.Errorf("expected http_requests_total in prometheus export, got: %s", prom)
	}

	if !strings.Contains(prom, "db_queries_total") && !strings.Contains(prom, "websocket_active_connections") {
		t.Errorf("expected websocket_active_connections in prometheus export, got: %s", prom)
	}
}
