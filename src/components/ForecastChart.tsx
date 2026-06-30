import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import type { ForecastOutput } from "@/lib/forecasting";
import { Toggle } from "@/components/ui/toggle";

type Props = { output: ForecastOutput; unit?: string | null };

const fmt = (n: number) =>
  Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function ForecastChart({ output, unit }: Props) {
  const [showFit, setShowFit] = useState(false);
  const linear = output.models.find((m) => m.key === "linear")!;
  const holt = output.models.find((m) => m.key === "holt")!;

  const data = useMemo(() => {
    const histLen = output.clean.length;
    const rows: Record<string, number | string | null>[] = [];
    output.clean.forEach((p, i) => {
      rows.push({
        label: p.t,
        actual: p.y,
        linFit: showFit ? linear.fitted[i] : null,
        holtFit: showFit ? holt.fitted[i] : null,
        linFc: null,
        holtFc: null,
      });
    });
    // bridge: anchor forecast lines to the last actual point
    if (histLen > 0) {
      rows[histLen - 1].linFc = output.clean[histLen - 1].y;
      rows[histLen - 1].holtFc = output.clean[histLen - 1].y;
    }
    output.futureLabels.forEach((label, i) => {
      rows.push({
        label,
        actual: null,
        linFit: null,
        holtFit: null,
        linFc: linear.forecast[i],
        holtFc: holt.forecast[i],
      });
    });
    return rows;
  }, [output, showFit, linear, holt]);

  const forecastStart = output.clean[output.clean.length - 1]?.t;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-1)]" /> Historical</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-2)]" /> Linear forecast</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[var(--color-chart-4)]" /> Holt forecast</span>
        </div>
        <Toggle size="sm" pressed={showFit} onPressedChange={setShowFit} aria-label="Toggle model fit lines">
          Show model fit
        </Toggle>
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} minTickGap={24} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmt(Number(v))} />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--color-popover-foreground)",
              }}
              formatter={(value: number, name: string) => [unit ? `${fmt(value)} ${unit}` : fmt(value), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {forecastStart && <ReferenceLine x={forecastStart} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />}
            <Line name="Historical" type="monotone" dataKey="actual" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} connectNulls />
            {showFit && <Line name="Linear fit" type="monotone" dataKey="linFit" stroke="var(--color-chart-2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
            {showFit && <Line name="Holt fit" type="monotone" dataKey="holtFit" stroke="var(--color-chart-4)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
            <Line name="Linear forecast" type="monotone" dataKey="linFc" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
            <Line name="Holt forecast" type="monotone" dataKey="holtFc" stroke="var(--color-chart-4)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}