
-- producao_frente: tira anon, restringe SELECT a authenticated
REVOKE SELECT ON public.producao_frente FROM anon;
DROP POLICY IF EXISTS "Leitura pública produção frente" ON public.producao_frente;
CREATE POLICY "Leitura autenticada produção frente"
  ON public.producao_frente FOR SELECT
  TO authenticated
  USING (true);

-- producao_equipamento: idem
REVOKE SELECT ON public.producao_equipamento FROM anon;
DROP POLICY IF EXISTS "Leitura pública produção equipamento" ON public.producao_equipamento;
CREATE POLICY "Leitura autenticada produção equipamento"
  ON public.producao_equipamento FOR SELECT
  TO authenticated
  USING (true);
