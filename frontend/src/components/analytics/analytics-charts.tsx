"use client";

import { BarChart3, TrendingUp } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              Success vs Failure ({days}d)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                />
                <Bar
                  dataKey="successful"
                  name="Successful"
                  fill="#10b981" // emerald-500
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="failed"
                  name="Failed"
                  fill="#ef4444" // destructive
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              Duration Trend ({days}d in seconds)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="colorDuration"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="duration"
                  name="Duration (s)"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorDuration)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
