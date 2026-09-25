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

const axisTick = { fontSize: 12, fill: "rgb(244 239 227 / 0.45)" };

export function GoalProgressChart({
  points,
  targetAmount,
}: {
  points: { date: string; total: number }[];
  targetAmount: number;
}) {
  if (points.length === 0) {
    return (
      <p className="px-2 text-ivory/50">Add your first contribution to see your progress over time.</p>
    );
  }

  // Start the line from zero so a single contribution still draws a rise.
  const data = [{ date: "Start", total: 0 }, ...points];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="goalStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#16a06e" />
            <stop offset="60%" stopColor="#4fe3a5" />
            <stop offset="100%" stopColor="#f7c35c" />
          </linearGradient>
          <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fe3a5" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4fe3a5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgb(255 255 255 / 0.06)" vertical={false} />
        <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} dy={8} />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value)}
          width={88}
          domain={[0, (max: number) => Math.max(max, targetAmount) * 1.05]}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Saved"]}
          cursor={{ stroke: "rgb(247 195 92 / 0.4)", strokeDasharray: "4 4" }}
          contentStyle={{
            background: "rgb(12 31 24 / 0.9)",
            border: "1px solid rgb(255 255 255 / 0.12)",
            borderRadius: 16,
            backdropFilter: "blur(12px)",
            color: "#f4efe3",
            fontSize: 13,
          }}
          labelStyle={{ color: "rgb(244 239 227 / 0.6)" }}
          itemStyle={{ color: "#4fe3a5" }}
        />
        <ReferenceLine
          y={targetAmount}
          stroke="#f7c35c"
          strokeDasharray="6 6"
          strokeOpacity={0.7}
          label={{ value: "Target", position: "insideTopRight", fill: "#f7c35c", fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="url(#goalStroke)"
          strokeWidth={3}
          fill="url(#goalFill)"
          dot={false}
          activeDot={{ r: 6, fill: "#f7c35c", stroke: "#06110d", strokeWidth: 3 }}
          animationDuration={1800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
