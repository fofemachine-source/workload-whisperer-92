import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyProductionRow {
  id: string;
  date: string;
  shift: string;
  equipment_id: string | null;
  location_id: string | null;
  material: string;
  trips: number | null;
  tons_produced: number | null;
  hours_worked: number | null;
  hours_stopped: number | null;
  equipment?: { code: string; type: string; capacity_tons: number | null } | null;
  locations?: { name: string } | null;
}

export function useEquipment(type?: string) {
  return useQuery({
    queryKey: ["equipment", type],
    queryFn: async () => {
      let q = supabase.from("equipment").select("*").eq("active", true);
      if (type) q = q.eq("type", type as any);
      const { data, error } = await q.order("code");
      if (error) throw error;
      return data;
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useDailyProduction(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["daily_production", dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("daily_production")
        .select("*, equipment(code, type, capacity_tons), locations(name)");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo);
      const { data, error } = await q.order("date", { ascending: false });
      if (error) throw error;
      return data as unknown as DailyProductionRow[];
    },
  });
}

export function usePlannedProduction(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["planned_production", dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from("planned_production").select("*, locations(name)");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo);
      const { data, error } = await q.order("date");
      if (error) throw error;
      return data;
    },
  });
}

export function useOccurrences(status?: string) {
  return useQuery({
    queryKey: ["occurrences", status],
    queryFn: async () => {
      let q = supabase.from("occurrences").select("*, equipment(code, type), locations(name)");
      if (status) q = q.eq("status", status);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
