import { supabase } from "@/integrations/supabase/client";
import type { RawPoint, ForecastOutput } from "./forecasting";

export type DatasetRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  points: RawPoint[];
  created_at: string;
  updated_at: string;
};

export type ForecastRow = {
  id: string;
  dataset_id: string | null;
  dataset_name: string;
  horizon: number;
  best_model: string | null;
  results: ForecastOutput;
  created_at: string;
};

export async function listDatasets(): Promise<DatasetRow[]> {
  const { data, error } = await supabase
    .from("datasets")
    .select("id,name,description,unit,points,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DatasetRow[];
}

export async function saveDataset(input: {
  name: string;
  description?: string | null;
  unit?: string | null;
  points: RawPoint[];
}): Promise<DatasetRow> {
  const { data: auth } = await supabase.auth.getUser();
  const user_id = auth.user?.id;
  if (!user_id) throw new Error("You must be signed in.");
  const { data, error } = await supabase
    .from("datasets")
    .insert({
      user_id,
      name: input.name,
      description: input.description ?? null,
      unit: input.unit ?? null,
      points: input.points as unknown as never,
    })
    .select("id,name,description,unit,points,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as unknown as DatasetRow;
}

export async function deleteDataset(id: string): Promise<void> {
  const { error } = await supabase.from("datasets").delete().eq("id", id);
  if (error) throw error;
}

export async function listForecasts(): Promise<ForecastRow[]> {
  const { data, error } = await supabase
    .from("forecasts")
    .select("id,dataset_id,dataset_name,horizon,best_model,results,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ForecastRow[];
}

export async function saveForecast(input: {
  dataset_id?: string | null;
  dataset_name: string;
  horizon: number;
  best_model: string;
  results: ForecastOutput;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const user_id = auth.user?.id;
  if (!user_id) throw new Error("You must be signed in.");
  const { error } = await supabase.from("forecasts").insert({
    user_id,
    dataset_id: input.dataset_id ?? null,
    dataset_name: input.dataset_name,
    horizon: input.horizon,
    best_model: input.best_model,
    results: input.results as unknown as never,
  });
  if (error) throw error;
}

export async function deleteForecast(id: string): Promise<void> {
  const { error } = await supabase.from("forecasts").delete().eq("id", id);
  if (error) throw error;
}