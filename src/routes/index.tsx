import { createFileRoute, Link } from "@tanstack/react-router";
import { LineChart, Upload, GitCompareArrows, GaugeCircle, ArrowRight, Sparkles } from "lucide-react";
import heroImg from "@/assets/hero-forecast.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ForecastLab — Predictive Analytics from Historical Data" },
      { name: "description", content: "Clean historical datasets, train regression and time-series models, and forecast future trends with side-by-side accuracy scoring." },
      { property: "og:title", content: "ForecastLab — Predictive Analytics from Historical Data" },
      { property: "og:description", content: "Clean data, compare regression vs. time-series models, and forecast trends with measurable accuracy." },
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Upload, title: "Clean & preprocess", body: "Auto-handle missing values, duplicates, and outliers, with a transparent cleaning report." },
  { icon: GitCompareArrows, title: "Compare models", body: "Linear regression vs. Holt time-series smoothing, trained and judged side by side." },
  { icon: GaugeCircle, title: "Measure accuracy", body: "MAE, RMSE, MAPE and R² on a hold-out test set the models never saw." },
  { icon: LineChart, title: "Visualize forecasts", body: "Interactive charts that extend history into the future with a clear forecast boundary." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <LineChart className="h-6 w-6 text-primary" /> ForecastLab
        </div>
        <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Predictive analytics workspace
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
            Forecast future trends from your historical data.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground text-balance">
            Upload a dataset or use a sample, let ForecastLab clean it, then compare
            regression and time-series models with real accuracy scores — all in your browser.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Start forecasting <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Try a sample dataset</Link></Button>
          </div>
        </div>
        <div className="relative rounded-2xl border border-border bg-card p-2 shadow-sm grid-paper">
          <img src={heroImg} alt="Line chart projecting a historical trend into a forecast" width={1280} height={960} className="rounded-xl" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
          <span>ForecastLab</span>
          <span>Learn predictive modeling, trend analysis & data-driven forecasting.</span>
        </div>
      </footer>
    </div>
  );
}
