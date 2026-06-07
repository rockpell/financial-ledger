"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, formatWon, formatWonShort } from "@/lib/format";
import type {
  MonthlyCostStack,
  MonthlyIncomeExpense,
  MonthlyYearPoint,
} from "@/lib/analytics";

const axisStyle = { fontSize: 12, fill: "#a3a3a3" };
const tooltipStyle = {
  backgroundColor: "#171717",
  border: "1px solid #404040",
  borderRadius: 8,
  fontSize: 12,
};

// 다년도 소비 흐름 (월별 x축, 연도별 라인)
export function MultiYearLineChart({
  data,
  years,
}: {
  data: MonthlyYearPoint[];
  years: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
        <XAxis dataKey="monthLabel" tick={axisStyle} stroke="#404040" />
        <YAxis tickFormatter={formatWonShort} tick={axisStyle} stroke="#404040" width={48} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatWon(Number(value))}
          labelStyle={{ color: "#e5e5e5" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {years.map((y, i) => (
          <Line
            key={y}
            type="monotone"
            dataKey={y}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// 비중 원형 차트 (고정비/변동비, 대형 카테고리 공용)
export function BreakdownPie({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={55}
          paddingAngle={2}
          label={({ name, value }) =>
            total > 0 ? `${name} ${Math.round(((value as number) / total) * 100)}%` : String(name)
          }
          labelLine={false}
          fontSize={11}
        >
          {data.map((d, i) => (
            <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatWon(Number(value))}
          itemStyle={{ color: "#e5e5e5" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// 월별 고정비/변동비 스택 바
export function MonthlyStackBar({ data }: { data: MonthlyCostStack[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
        <XAxis dataKey="ym" tick={axisStyle} stroke="#404040" />
        <YAxis tickFormatter={formatWonShort} tick={axisStyle} stroke="#404040" width={48} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatWon(Number(value))}
          labelStyle={{ color: "#e5e5e5" }}
          cursor={{ fill: "#ffffff10" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="고정비" stackId="a" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
        <Bar dataKey="변동비" stackId="a" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 월별 수입/지출 비교 (그룹 바)
export function MonthlyIncomeExpenseBar({ data }: { data: MonthlyIncomeExpense[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
        <XAxis dataKey="ym" tick={axisStyle} stroke="#404040" />
        <YAxis tickFormatter={formatWonShort} tick={axisStyle} stroke="#404040" width={48} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatWon(Number(value))}
          labelStyle={{ color: "#e5e5e5" }}
          cursor={{ fill: "#ffffff10" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="수입" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="지출" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 소비처 Top N 가로 바
export function TopMerchantsBar({
  data,
}: {
  data: { name: string; value: number; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 48)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
        <XAxis type="number" tickFormatter={formatWonShort} tick={axisStyle} stroke="#404040" />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisStyle}
          stroke="#404040"
          width={110}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, _n, item) => {
            const count = (item?.payload as { count?: number })?.count ?? 0;
            return [`${formatWon(Number(value))} (${count}건)`, "지출"];
          }}
          labelStyle={{ color: "#e5e5e5" }}
          itemStyle={{ color: "#e5e5e5" }}
          cursor={{ fill: "#ffffff10" }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
