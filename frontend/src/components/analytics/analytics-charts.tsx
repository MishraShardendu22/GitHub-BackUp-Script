"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Run {
  started_at: string;
  successful: number;
  failed: number;
  duration_ms: number;
}

interface AnalyticsChartsProps {
  data: Run[];
  days: number;
}

const tooltipStyle = {
  background: "rgba(20,18,16,0.97)",
  border: "1px solid rgba(212,168,50,0.22)",
  borderRadius: 8,
  fontSize: 12,
  color: "#F0EAD6",
  boxShadow: "0 10px 24px rgba(0,0,0,0.32)",
};

export function AnalyticsCharts({ data, days }: AnalyticsChartsProps) {
  const chartData = data.map((run) => ({
    date: new Date(run.started_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    successful: run.successful,
    failed: run.failed,
    duration: Math.round(run.duration_ms / 1000),
  }));

  return (
    <div className="split-grid">
      <section className="card chart-card">
        <div className="section-title">Success vs failure — {days}d</div>
        <div className="chart-frame">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={220}
          >
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis dataKey="date" stroke="#A09167" fontSize={11} />
              <YAxis stroke="#A09167" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="successful"
                name="Successful"
                fill="#6FCF7F"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="failed"
                name="Failed"
                fill="#E07070"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card chart-card">
        <div className="section-title">Duration trend — {days}d (seconds)</div>
        <div className="chart-frame">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={220}
          >
            <AreaChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis dataKey="date" stroke="#A09167" fontSize={11} />
              <YAxis stroke="#A09167" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="duration"
                name="Duration (s)"
                stroke="var(--accent)"
                fill="rgba(212,168,50,0.1)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
