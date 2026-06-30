import type { ForecastOutput, Metrics, ModelResult } from "@/lib/forecasting";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

function MetricCell({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <span className="font-mono text-sm tabular-nums">
      {value.toLocaleString(undefined, { maximumFractionDigits: 3 })}
      {suffix}
    </span>
  );
}

export function MetricsTable({ output }: { output: ForecastOutput }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Model</th>
            <th className="py-2 px-3 font-medium" title="Mean Absolute Error (hold-out)">MAE</th>
            <th className="py-2 px-3 font-medium" title="Root Mean Squared Error (hold-out)">RMSE</th>
            <th className="py-2 px-3 font-medium" title="Mean Absolute Percentage Error (hold-out)">MAPE</th>
            <th className="py-2 px-3 font-medium" title="R² goodness of fit (in-sample)">R²</th>
          </tr>
        </thead>
        <tbody>
          {output.models.map((m: ModelResult) => {
            const best = m.key === output.bestKey;
            const t: Metrics = m.testMetrics;
            return (
              <tr key={m.key} className={cn("border-b border-border/60 last:border-0", best && "bg-success/5")}>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    {best && (
                      <Badge className="bg-success text-success-foreground hover:bg-success gap-1">
                        <Trophy className="h-3 w-3" /> Best
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </td>
                <td className="py-3 px-3"><MetricCell value={t.mae} /></td>
                <td className="py-3 px-3"><MetricCell value={t.rmse} /></td>
                <td className="py-3 px-3"><MetricCell value={t.mape} suffix="%" /></td>
                <td className="py-3 px-3"><MetricCell value={m.fitMetrics.r2} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Accuracy (MAE, RMSE, MAPE) is measured on a {output.testSize}-point hold-out test set the models never trained on.
        Lower is better. R² shows in-sample goodness of fit (closer to 1 is better).
      </p>
    </div>
  );
}