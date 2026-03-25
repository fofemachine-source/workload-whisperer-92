
-- Tipos
CREATE TYPE public.equipment_type AS ENUM ('CR', 'EH', 'PF', 'CD', 'CL', 'CP', 'MN', 'TE', 'TI', 'CH');
CREATE TYPE public.equipment_status AS ENUM ('OPERANDO', 'CORRETIVA', 'PREVENTIVA', 'STAND_BY', 'AG_FRENTE');
CREATE TYPE public.material_type AS ENUM ('minerio', 'esteril');
CREATE TYPE public.shift_type AS ENUM ('1', '2');

-- Locais
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Equipamentos
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type equipment_type NOT NULL,
  capacity_tons NUMERIC,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Produção diária
CREATE TABLE public.daily_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  shift shift_type NOT NULL,
  equipment_id UUID REFERENCES public.equipment(id),
  location_id UUID REFERENCES public.locations(id),
  material material_type NOT NULL DEFAULT 'minerio',
  trips INTEGER DEFAULT 0,
  tons_produced NUMERIC DEFAULT 0,
  hours_worked NUMERIC DEFAULT 0,
  hours_stopped NUMERIC DEFAULT 0,
  stop_reason TEXT,
  horimeter_start NUMERIC,
  horimeter_end NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Metas planejadas
CREATE TABLE public.planned_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  location_id UUID REFERENCES public.locations(id),
  planned_tons NUMERIC NOT NULL DEFAULT 0,
  planned_trips INTEGER DEFAULT 0,
  material material_type NOT NULL DEFAULT 'minerio',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ocorrências
CREATE TABLE public.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES public.equipment(id),
  location_id UUID REFERENCES public.locations(id),
  description TEXT,
  type TEXT DEFAULT 'ocorrencia',
  status TEXT DEFAULT 'aberto',
  started_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage locations" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage equipment" ON public.equipment FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read daily_production" ON public.daily_production FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage daily_production" ON public.daily_production FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read planned_production" ON public.planned_production FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage planned_production" ON public.planned_production FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read occurrences" ON public.occurrences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage occurrences" ON public.occurrences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_daily_production_updated_at
BEFORE UPDATE ON public.daily_production
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed locations
INSERT INTO public.locations (name) VALUES ('N4WN'), ('N4WS'), ('MORRO1'), ('N5SUL'), ('MERCOMINAS');

-- Seed CRs
INSERT INTO public.equipment (code, type, capacity_tons) VALUES
('CR-2516','CR',45),('CR-2517','CR',45),('CR-2518','CR',45),('CR-2519','CR',45),('CR-2520','CR',45),
('CR-2521','CR',45),('CR-2522','CR',45),('CR-2523','CR',45),('CR-2524','CR',45),('CR-2525','CR',45),
('CR-2526','CR',45),('CR-2527','CR',45),('CR-2529','CR',45),('CR-2531','CR',45),('CR-2532','CR',45),
('CR-2533','CR',45),('CR-2534','CR',45),('CR-2535','CR',45),('CR-2536','CR',45),('CR-2537','CR',45);

-- Seed EHs
INSERT INTO public.equipment (code, type) VALUES
('EH-4039','EH'),('EH-4041','EH'),('EH-4047','EH'),('EH-4035','EH'),
('EH-5003','EH'),('EH-4026','EH'),('EH-5004','EH'),('EH-5036','EH');

-- Seed PFs
INSERT INTO public.equipment (code, type) VALUES
('PF-1030','PF'),('PF-1031','PF'),('PF-1033','PF'),('PF-1034','PF');
