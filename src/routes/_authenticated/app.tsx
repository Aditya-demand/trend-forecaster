import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Upload, Database, Sparkles, Save, Trash2, LogOut,
  TableProperties, Download, FlaskConical, Loader2, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { runForecast, type RawPoint } from "@/lib/forecasting";
import { parseDataset } from "@/lib/csv";
import { SAMPLE_DATASETS, sampleToCsv } from "@/lib/sample-data";
import {
  listDatasets, saveDataset, deleteDataset,
  listForecasts, saveForecast, deleteForecast,
  type DatasetRow, type ForecastRow,
} from "@/lib/db";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ForecastChart } from "@/components/ForecastChart";
import { MetricsTable } from "@/components/MetricsTable";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppWorkspace,
});

type SourceMeta = { name: string; unit: string; description: string; datasetId: string | null };

function AppWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [points, setPoints] = useState<RawPoint[]>([]);
  const [meta, setMeta] = useState<SourceMeta>({ name: "", unit: "", description: "", datasetId: null });
  const [horizon, setHorizon] = useState(6);

  const datasetsQ = useQuery({ queryKey: ["datasets"], queryFn: listDatasets });
  const forecastsQ = useQuery({ queryKey: ["forecasts"], queryFn: listForecasts });

  const output = useMemo(() => {
    if (points.length < 4) return null;
    try { return runForecast(points, horizon); } catch { return null; }
  }, [points, horizon]);

  const loadSample = (id: string) => {
    const s = SAMPLE_DATASETS.find((d) => d.id === id);
    if (!s) return;
    setPoints(s.points);
    setMeta({ name: s.name, unit: s.unit, description: s.description, datasetId: null });
  };

  const loadSaved = (d: DatasetRow) => {
    setPoints(d.points);
    setMeta({ name: d.name, unit: d.unit ?? "", description: d.description ?? "", datasetId: d.id });
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseDataset(text);
      if (parsed.points.length < 4) throw new Error("Need at least 4 rows to forecast.");
      setPoints(parsed.points);
      setMeta({
        name: file.name.replace(/\.[^.]+$/, ""),
        unit: parsed.valueColumn,
        description: `Imported from ${file.name} (${parsed.timeColumn} → ${parsed.valueColumn})`,
        datasetId: null,
      });
      toast.success(`Loaded ${parsed.points.length} rows from ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse CSV.");
    }
  };

  const saveDatasetM = useMutation({
    mutationFn: () => saveDataset({ name: meta.name || "Untitled dataset", description: meta.description, unit: meta.unit, points }),
    onSuccess: (row) => {
      toast.success("Dataset saved.");
      setMeta((m) => ({ ...m, datasetId: row.id }));
      qc.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  const saveForecastM = useMutation({
    mutationFn: () => {
      if (!output) throw new Error("Run a forecast first.");
      const best = output.models.find((m) => m.key === output.bestKey)!;
      return saveForecast({
        dataset_id: meta.datasetId,
        dataset_name: meta.name || "Untitled dataset",
        horizon,
        best_model: best.name,
        results: output,
      });
    },
    onSuccess: () => {
      toast.success("Forecast saved.");
      qc.invalidateQueries({ queryKey: ["forecasts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  const delDatasetM = useMutation({
    mutationFn: (id: string) => deleteDataset(id),
    onSuccess: () => { toast.success("Dataset deleted."); qc.invalidateQueries({ queryKey: ["datasets"] }); },
  });
  const delForecastM = useMutation({
    mutationFn: (id: string) => deleteForecast(id),
    onSuccess: () => { toast.success("Forecast deleted."); qc.invalidateQueries({ queryKey: ["forecasts"] }); },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const downloadForecastCsv = () => {
    if (!output) return;
    const lin = output.models.find((m) => m.key === "linear")!;
    const holt = output.models.find((m) => m.key === "holt")!;
    const header = "period,linear_forecast,holt_forecast";
    const rows = output.futureLabels.map((l, i) => `${l},${lin.forecast[i]},${holt.forecast[i]}`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(meta.name || "forecast").replace(/\s+/g, "_")}_forecast.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const best = output?.models.find((m) => m.key === output.bestKey);

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-display font-semibold">
            <LineChart className="h-5 w-5 text-primary" /> ForecastLab
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[360px_1fr]">
        {/* LEFT: data + controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> 1. Choose your data</CardTitle>
              <CardDescription>Pick a sample, upload a CSV, or open a saved dataset.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="sample">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="sample">Samples</TabsTrigger>
                  <TabsTrigger value="upload">Upload</TabsTrigger>
                  <TabsTrigger value="saved">Saved</TabsTrigger>
                </TabsList>

                <TabsContent value="sample" className="mt-4 space-y-2">
                  {SAMPLE_DATASETS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadSample(s.id)}
                      className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-secondary"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s.name}</span>
                        <Badge variant="secondary">{s.points.length} pts</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                    </button>
                  ))}
                </TabsContent>

                <TabsContent value="upload" className="mt-4">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-secondary"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Drop a CSV or click to upload</span>
                    <span className="text-xs text-muted-foreground">A date/period column and a numeric value column.</span>
                  </button>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Tip: export a sample as a template —{" "}
                    <button
                      className="text-primary hover:underline"
                      onClick={() => {
                        const blob = new Blob([sampleToCsv(SAMPLE_DATASETS[0])], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "sample_template.csv"; a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >download template</button>
                  </p>
                </TabsContent>

                <TabsContent value="saved" className="mt-4 space-y-2">
                  {datasetsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                  {datasetsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No saved datasets yet.</p>}
                  {datasetsQ.data?.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <button onClick={() => loadSaved(d)} className="text-left">
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.points.length} points</div>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => delDatasetM.mutate(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {points.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> 2. Configure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ds-name">Dataset name</Label>
                  <Input id="ds-name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-unit">Unit / measure</Label>
                  <Input id="ds-unit" value={meta.unit} onChange={(e) => setMeta({ ...meta, unit: e.target.value })} placeholder="e.g. USD, visitors" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Forecast horizon</Label>
                    <span className="font-mono text-sm">{horizon} periods</span>
                  </div>
                  <Slider value={[horizon]} min={1} max={24} step={1} onValueChange={(v) => setHorizon(v[0])} />
                </div>
                <Button variant="outline" className="w-full" onClick={() => saveDatasetM.mutate()} disabled={saveDatasetM.isPending}>
                  {saveDatasetM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save dataset
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: results */}
        <div className="space-y-6">
          {!output ? (
            <Card className="grid h-full min-h-[400px] place-items-center text-center">
              <CardContent className="max-w-sm py-12">
                <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground" />
                <h2 className="mt-4 font-display text-lg font-semibold">No forecast yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a dataset on the left (at least 4 data points) to clean it, train the models, and see the forecast.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Data points" value={String(output.clean.length)} sub={`${output.trainSize} train / ${output.testSize} test`} />
                <StatCard label="Best model" value={best?.name.split(" ")[0] ?? "—"} sub={`RMSE ${best?.testMetrics.rmse}`} highlight />
                <StatCard label="Next forecast" value={best ? best.forecast[0].toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"} sub={`${meta.unit || "units"} · ${output.futureLabels[0]}`} />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Forecast — {meta.name}</CardTitle>
                    <CardDescription>Historical data with {horizon}-period predictions from both models.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadForecastCsv}><Download className="h-4 w-4" /> CSV</Button>
                    <Button size="sm" onClick={() => saveForecastM.mutate()} disabled={saveForecastM.isPending}>
                      {saveForecastM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save forecast
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ForecastChart output={output} unit={meta.unit} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Model accuracy comparison</CardTitle>
                  <CardDescription>Regression vs. time-series, evaluated on unseen data.</CardDescription>
                </CardHeader>
                <CardContent><MetricsTable output={output} /></CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><TableProperties className="h-4 w-4 text-primary" /> Predicted values</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="py-2 text-left font-medium">Period</th>
                            <th className="py-2 text-right font-medium">Linear</th>
                            <th className="py-2 text-right font-medium">Holt</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono tabular-nums">
                          {output.futureLabels.map((l, i) => (
                            <tr key={l} className="border-b border-border/50">
                              <td className="py-1.5 text-left font-sans">{l}</td>
                              <td className="py-1.5 text-right">{output.models[0].forecast[i].toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                              <td className="py-1.5 text-right">{output.models[1].forecast[i].toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="h-4 w-4 text-primary" /> Data cleaning report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <CleanRow label="Rows received" value={output.cleaning.original} />
                    <CleanRow label="Usable points" value={output.cleaning.cleaned} />
                    <CleanRow label="Missing values interpolated" value={output.cleaning.interpolated} />
                    <CleanRow label="Duplicate periods removed" value={output.cleaning.duplicatesRemoved} />
                    <CleanRow label="Non-numeric rows dropped" value={output.cleaning.removedNonNumeric} />
                    <CleanRow label="Outliers clipped" value={output.cleaning.outliersClipped} />
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Saved forecasts history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved forecasts</CardTitle>
              <CardDescription>Your forecast history, stored securely to your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {forecastsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {forecastsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">Nothing saved yet — run a forecast and hit “Save forecast”.</p>}
              {forecastsQ.data?.map((f: ForecastRow) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-medium">{f.dataset_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.horizon}-period forecast · best: {f.best_model} · {new Date(f.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setPoints(f.results.clean.map((p) => ({ t: p.t, y: p.y }))); setHorizon(f.horizon); setMeta({ name: f.dataset_name, unit: "", description: "", datasetId: f.dataset_id }); }}>
                      Reopen
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => delForecastM.mutate(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function CleanRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}