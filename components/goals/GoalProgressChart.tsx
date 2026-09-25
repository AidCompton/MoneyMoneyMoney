"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/currency";

export function GoalProgressChart({
  points,
  targetAmount,
}: {
  points: { date: string; total: number }[];
  targetAmount: number;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Add your first contribution to see progress over time.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value)}
          width={90}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
        />
        <ReferenceLine y={targetAmount} stroke="#f59e0b" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#059669"
          strokeWidth={2}
          fill="url(#goalFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
