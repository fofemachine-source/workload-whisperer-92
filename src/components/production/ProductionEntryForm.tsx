import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, X, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEquipment, useLocations } from "@/hooks/use-mining-data";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const schema = z.object({
  date: z.string().min(1, "Data obrigatória"),
  shift: z.enum(["1", "2"], { required_error: "Selecione o turno" }),
  equipment_id: z.string().min(1, "Selecione o equipamento"),
  location_id: z.string().min(1, "Selecione o local"),
  material: z.enum(["minerio", "esteril"], { required_error: "Selecione o material" }),
  trips: z.coerce.number().min(0, "Mínimo 0"),
  tons_produced: z.coerce.number().min(0, "Mínimo 0"),
  horimeter_start: z.coerce.number().min(0, "Mínimo 0"),
  horimeter_end: z.coerce.number().min(0, "Mínimo 0"),
  hours_worked: z.coerce.number().min(0, "Mínimo 0"),
  hours_stopped: z.coerce.number().min(0, "Mínimo 0"),
  stop_reason: z.string().optional(),
}).refine((d) => d.horimeter_end >= d.horimeter_start, {
  message: "Horímetro final deve ser ≥ inicial",
  path: ["horimeter_end"],
});

type FormData = z.infer<typeof schema>;

export function ProductionEntryForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: equipment } = useEquipment();
  const { data: locations } = useLocations();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      shift: "1",
      trips: 0,
      tons_produced: 0,
      horimeter_start: 0,
      horimeter_end: 0,
      hours_worked: 0,
      hours_stopped: 0,
      material: "minerio",
      stop_reason: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("daily_production").insert({
        date: data.date,
        shift: data.shift,
        equipment_id: data.equipment_id,
        location_id: data.location_id,
        material: data.material,
        trips: data.trips,
        tons_produced: data.tons_produced,
        horimeter_start: data.horimeter_start,
        horimeter_end: data.horimeter_end,
        hours_worked: data.hours_worked,
        hours_stopped: data.hours_stopped,
        stop_reason: data.stop_reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_production"] });
      toast.success("Produção registrada com sucesso!");
      reset();
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao registrar: " + (err.message ?? "Tente novamente"));
    },
  });

  const horimeterStart = watch("horimeter_start");
  const horimeterEnd = watch("horimeter_end");
  const horimeterDiff = Math.max(0, (horimeterEnd ?? 0) - (horimeterStart ?? 0));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-mining-green hover:bg-mining-green/90 text-white">
          <Plus className="h-4 w-4" />
          Lançar Produção
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Plus className="h-5 w-5 text-mining-green" />
            Lançamento de Produção Diária
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          {/* Row 1: Data, Turno */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Data</Label>
              <Input type="date" {...register("date")} className="font-mono" />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Turno</Label>
              <Select
                value={watch("shift")}
                onValueChange={(v) => setValue("shift", v as "1" | "2")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Turno 1 (Dia)</SelectItem>
                  <SelectItem value="2">Turno 2 (Noite)</SelectItem>
                </SelectContent>
              </Select>
              {errors.shift && <p className="text-xs text-destructive">{errors.shift.message}</p>}
            </div>
          </div>

          {/* Row 2: Equipamento, Local, Material */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Equipamento</Label>
              <Select onValueChange={(v) => setValue("equipment_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {equipment?.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.code} ({eq.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.equipment_id && <p className="text-xs text-destructive">{errors.equipment_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Local</Label>
              <Select onValueChange={(v) => setValue("location_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.location_id && <p className="text-xs text-destructive">{errors.location_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Material</Label>
              <Select
                value={watch("material")}
                onValueChange={(v) => setValue("material", v as "minerio" | "esteril")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minerio">Minério</SelectItem>
                  <SelectItem value="esteril">Estéril</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Viagens, Tonelagem */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Viagens</Label>
              <Input type="number" {...register("trips")} className="font-mono" min={0} />
              {errors.trips && <p className="text-xs text-destructive">{errors.trips.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tonelagem (t)</Label>
              <Input type="number" step="0.01" {...register("tons_produced")} className="font-mono" min={0} />
              {errors.tons_produced && <p className="text-xs text-destructive">{errors.tons_produced.message}</p>}
            </div>
          </div>

          {/* Row 4: Horímetros */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Horímetro</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Inicial</span>
                <Input type="number" step="0.1" {...register("horimeter_start")} className="font-mono" min={0} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Final</span>
                <Input type="number" step="0.1" {...register("horimeter_end")} className="font-mono" min={0} />
                {errors.horimeter_end && <p className="text-xs text-destructive">{errors.horimeter_end.message}</p>}
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Diferença</span>
                <div className="flex h-10 items-center rounded-md border border-border bg-mining-surface px-3">
                  <span className="font-mono text-sm text-mining-yellow font-semibold">
                    {horimeterDiff.toFixed(1)}h
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: Horas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Horas Trabalhadas</Label>
              <Input type="number" step="0.1" {...register("hours_worked")} className="font-mono" min={0} />
              {errors.hours_worked && <p className="text-xs text-destructive">{errors.hours_worked.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Horas Paradas</Label>
              <Input type="number" step="0.1" {...register("hours_stopped")} className="font-mono" min={0} />
              {errors.hours_stopped && <p className="text-xs text-destructive">{errors.hours_stopped.message}</p>}
            </div>
          </div>

          {/* Row 6: Motivo parada */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Motivo da Parada (opcional)</Label>
            <Input {...register("stop_reason")} placeholder="Ex: Manutenção corretiva, abastecimento..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-mining-green hover:bg-mining-green/90 text-white gap-2">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Lançamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
