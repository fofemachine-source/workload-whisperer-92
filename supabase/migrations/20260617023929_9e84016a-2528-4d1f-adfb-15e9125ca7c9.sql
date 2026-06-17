
-- Liberar leitura anônima das 3 tabelas operacionais (métricas de produção, sem PII)
GRANT SELECT ON public.producao_diaria TO anon;
GRANT SELECT ON public.producao_frente TO anon;
GRANT SELECT ON public.producao_equipamento TO anon;

CREATE POLICY "Anon read producao_diaria"
  ON public.producao_diaria FOR SELECT TO anon USING (true);

CREATE POLICY "Anon read producao_frente"
  ON public.producao_frente FOR SELECT TO anon USING (true);

CREATE POLICY "Anon read producao_equipamento"
  ON public.producao_equipamento FOR SELECT TO anon USING (true);
