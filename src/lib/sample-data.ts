import type { RawPoint } from "./forecasting";

export type SampleDataset = {
  id: string;
  name: string;
  description: string;
  unit: string;
  points: RawPoint[];
};

function monthly(start: string, values: number[]): RawPoint[] {
  const [y, m] = start.split("-").map(Number);
  let year = y;
  let month = m;
  return values.map((v) => {
    const label = `${year}-${String(month).padStart(2, "0")}`;
    month++;
    if (month > 12) { month = 1; year++; }
    return { t: label, y: v };
  });
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "retail-sales",
    name: "Monthly Retail Sales",
    description: "36 months of store revenue with a clear upward trend and seasonal bumps.",
    unit: "USD (000s)",
    points: monthly("2022-01", [
      42, 45, 48, 47, 52, 58, 61, 60, 57, 63, 71, 88,
      49, 52, 55, 54, 60, 67, 70, 69, 66, 73, 82, 101,
      57, 61, 64, 63, 70, 78, 82, 81, 77, 86, 96, 118,
    ]),
  },
  {
    id: "web-traffic",
    name: "Website Daily Visitors",
    description: "30 days of traffic showing steady growth with weekday/weekend swings.",
    unit: "visitors",
    points: Array.from({ length: 30 }, (_, i) => {
      const base = 1200 + i * 35;
      const weekend = [5, 6].includes(new Date(2024, 2, 1 + i).getDay()) ? -240 : 0;
      const noise = Math.round(Math.sin(i / 2) * 60);
      return { t: new Date(2024, 2, 1 + i).toISOString().slice(0, 10), y: base + weekend + noise };
    }),
  },
  {
    id: "energy",
    name: "Quarterly Energy Demand",
    description: "24 quarters of regional electricity demand with a gentle rising trend.",
    unit: "GWh",
    points: monthly("2019-01", [
      820, 905, 870, 940,
      845, 930, 895, 970,
      870, 960, 925, 1005,
      900, 995, 955, 1040,
      930, 1030, 990, 1080,
      965, 1070, 1025, 1120,
    ]).map((p, i) => ({ t: `Q${(i % 4) + 1} ${2019 + Math.floor(i / 4)}`, y: p.y })),
  },
];

export function sampleToCsv(d: SampleDataset): string {
  const header = "period,value";
  const rows = d.points.map((p) => `${p.t},${p.y}`);
  return [header, ...rows].join("\n");
}