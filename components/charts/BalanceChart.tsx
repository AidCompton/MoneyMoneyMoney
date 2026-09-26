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

/**
 * A running total over time (a goal's savings, an account's balance) with an
 * optional target line.
 */
export function BalanceChart({
  points,
  target,
  seriesName = "Saved",
  tone = "gold",
  empty = "Add your first contribution to see your progress over time.",
}: {
  points: { date: string; total: number }[];
  target?: number | null;
  seriesName?: string;
  tone?: "gold" | "mint";
  empty?: string;
}) {
  if (points.length === 0) {
    return <p className="px-2 text-ivory/50">{empty}</p>;
  }

  const end = tone === "mint" ? "#9ff0cf" : "#f7c35c";
  const id = `balance-${tone}`;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={points} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#16a06e" />
            <stop offset="60%" stopColor="#4fe3a5" />
            <stop offset="100%" stopColor={end} />
          </linearGradient>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fe3a5" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#4fe3a5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgb(255 255 255 / 0.06)" vertical={false} />
        <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} dy={8} minTickGap={24} />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value)}
          width={88}
          domain={[0, (max: number) => Math.max(max, target ?? 0) * 1.05]}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), seriesName]}
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
        {target ? (
          <ReferenceLine
            y={target}
            stroke="#f7c35c"
            strokeDasharray="6 6"
            strokeOpacity={0.7}
            label={{ value: "Target", position: "insideTopRight", fill: "#f7c35c", fontSize: 12 }}
          />
        ) : null}
        <Area
          type="monotone"
          dataKey="total"
          stroke={`url(#${id}-stroke)`}
          strokeWidth={3}
          fill={`url(#${id}-fill)`}
          dot={false}
          activeDot={{ r: 6, fill: end, stroke: "#06110d", strokeWidth: 3 }}
          animationDuration={1800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
