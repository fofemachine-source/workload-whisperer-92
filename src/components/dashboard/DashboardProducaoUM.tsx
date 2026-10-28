import React, { useCallback, useMemo, useState, useEffect, useRef, memo } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Wrench, Fuel, RefreshCw, Utensils } from "lucide-react";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
  Label,
  LabelList,
} from "recharts";
import { DASHBOARD_API_URL, type DashboardApiPayload, type ParadaFrota } from "@/hooks/useDashboardApi";
import { supabase } from "@/integrations/supabase/client";
import { EstradaAnimada } from "@/components/dashboard/EstradaAnimada";
import excavatorNeon from "@/assets/excavator.png";
import truckNeon from "@/assets/truck.png";
import { CaminhaoBasculante } from "@/components/dashboard/CaminhaoBasculante";
import logoUM from "@/assets/logo-um.png";
import { UM, UMHeader, SectionSep, ContratoCard, DailyContratoChart, FrenteDonut, FrentesTable, UMCard, UMTitle, AnimNum, isNum } from "@/components/dashboard/UMLight";

/* ---------- helpers ---------- */


const fmt = (n: number, d = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

/** Formatação de tonelagem no padrão MineOperate: sem separador de milhar, 3 decimais (ponto), sem 't' */
const fmtTon = (n: number | undefined | null): string => {
  const v = Number(n || 0);
  return (Number.isFinite(v) ? v : 0).toFixed(3);
};

/** Animated count-up number using requestAnimationFrame (memoized). */
const Counter = memo(function Counter({
  value,
  decimals = 0,
  useTonFmt = false,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  useTonFmt?: boolean;
  suffix?: string;
}) {
  const v = useAnimatedCounter(Number.isFinite(value) ? value : 0);
  if (useTonFmt) {
    return <>{fmtTon(v)}{suffix}</>;
  }
  return <>{fmt(v, decimals)}{suffix}</>;
});

const FRENTE_COLORS = [
  "#00eaff", // cyan (LAV)
  "#1687ff", // blue (RET)
  "#a855f7", // purple
  "#ec4899", // pink
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#ef4444", // red
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#f59e0b", // amber
];

const colorForFrente = (name: string, idx: number) => {
  const n = String(name || "").trim().toUpperCase();
  if (n === "LAV") return "#22c55e"; // Verde
  if (n === "RET") return "#f97316"; // Laranja
  return FRENTE_COLORS[idx % FRENTE_COLORS.length];
};

const normEquip = (v: unknown) =>
  String(v ?? "").replace(/[-\s]/g, "").toUpperCase();

const toNum = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtHora = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  // Já é HH:mm ou HH:mm:ss
  const m = s.match(/(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  // Tenta parsear como Date
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return s;
};


/* ---------- shared card ---------- */
function Panel({
  title,
  children,
  className = "",
  right,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`chart-card dashboard-card bg-[#000000] border border-[#22c55e]/30 rounded-md shadow-[0_0_15px_-5px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_-3px_rgba(34,197,94,0.2)] transition-shadow duration-500 flex flex-col ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-3 pt-2">
          <p className="text-[11px] font-bold tracking-wider text-[#22c55e] uppercase">{title}</p>
          {right}
        </div>
      )}
      <div className="p-3 pt-2 flex-1 min-h-0">{children}</div>
    </motion.div>
  );
}

/* ---------- filter select ---------- */
function FilterField({
  label,
  value,
  onChange,
  options,
  type = "select",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  type?: "select" | "date";
}) {
  return (
    <div className="flex flex-col min-w-[110px]">
      <span className="text-[9px] tracking-widest text-[#9ca3af] font-bold uppercase">{label}</span>
      {type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[hsl(220_40%_12%)] border border-[#22c55e]/25 rounded px-2 py-1 text-xs tabular-nums text-foreground focus:outline-none focus:border-[#22c55e]"
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[hsl(220_40%_12%)] border border-[#22c55e]/25 rounded px-2 py-1 text-xs tabular-nums text-foreground focus:outline-none focus:border-[#22c55e]"
        >
          <option value="">Todos</option>
          {(options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// Tick customizado para o gráfico de TKPH
const TkphTick = (props: any) => {
  const { x, y, payload } = props;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-20} y={10} fill="#f97316" fontSize={11} textAnchor="middle" fontWeight={700} fontFamily="Inter, sans-serif">CR 785</text>
      <text x={20} y={10} fill="#22c55e" fontSize={11} textAnchor="middle" fontWeight={700} fontFamily="Inter, sans-serif">CR 730</text>
      <text x={0} y={23} fill="#ffffff" fontSize={16} textAnchor="middle" fontWeight={700} fontFamily="Inter, sans-serif">{payload.value}</text>
    </g>
  );
};

/* ---------- main dashboard ---------- */
export default function DashboardProducaoUM() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioAno = `${new Date().getFullYear()}-01-01`;
  const [dtIni, setDtIni] = useState(inicioAno);
  const [dtFim, setDtFim] = useState(hoje);
  const [dashboardData, setDashboardData] = useState<DashboardApiPayload | null>(null);
  const [segundosAtualizacao, setSegundosAtualizacao] = useState(15);
  const [, setLoading] = useState(false);
  const [, setErroApi] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState("");
  const isFetchingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarDashboard = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setLoading(true);
      const url = `${DASHBOARD_API_URL}?ts=${Date.now()}`;
      console.log("Atualizando dashboard...", url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Erro HTTP " + response.status);
      }

      const apiResponse = (await response.json()) as DashboardApiPayload;
      const k: any = apiResponse?.kpis ?? {};
      const lr: any = (apiResponse as any)?.lavRet ?? {};
      console.log("[DASHBOARD ATUALIZADO]", {
        atualizadoEm: (apiResponse as any)?.atualizadoEm,
        cards: (apiResponse as any)?.cards,
        frentes: apiResponse?.producaoFrente,
        viagensCR: apiResponse?.viagensCR?.length,
        viagensHora: apiResponse?.viagensHora,
      });

      setDashboardData(apiResponse);
      setUltimaAtualizacao(apiResponse.atualizadoEm || new Date().toISOString());
      setSegundosAtualizacao(15);
      setErroApi(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[DASHBOARD ERRO]", error);
      
      try {
        console.log("[DASHBOARD FALLBACK] Carregando dados do Supabase...");
        
        const desde30 = new Date();
        desde30.setDate(desde30.getDate() - 30);
        const desde2 = new Date();
        desde2.setDate(desde2.getDate() - 2);

        // 1) Fetch producao_diaria (last 30 days)
        const { data: diariaRows, error: dErr } = await supabase
          .from("producao_diaria")
          .select("*")
          .gte("data_referencia", desde30.toISOString().slice(0, 10))
          .order("data_referencia", { ascending: false });
        if (dErr) throw dErr;
        
        // 2) Fetch producao_frente (last 2 days)
        const { data: frenteRows, error: fErr } = await supabase
          .from("producao_frente")
          .select("*")
          .gte("data_referencia", desde2.toISOString().slice(0, 10))
          .order("data_referencia", { ascending: false });
        if (fErr) throw fErr;

        // 3) Fetch producao_equipamento (last 2 days)
        const { data: equipRows, error: eErr } = await supabase
          .from("producao_equipamento")
          .select("*")
          .gte("data_referencia", desde2.toISOString().slice(0, 10))
          .order("data_referencia", { ascending: false });
        if (eErr) throw eErr;

        // 4) Fetch viagens_acompanhamento (last 2 days)
        const { data: viagensRows, error: vErr } = await (supabase as any)
          .from("viagens_acompanhamento")
          .select("*")
          .gte("data_referencia", desde2.toISOString().slice(0, 10))
          .order("data_referencia", { ascending: false });

        const latest = diariaRows?.[0];

        // Group by reference date for dailySeries
        const dailyMap = new Map<string, { real: number; previsto: number }>();
        (diariaRows ?? []).forEach((row) => {
          const d = row.data_referencia;
          const current = dailyMap.get(d) || { real: 0, previsto: 0 };
          current.real += Number(row.toneladas_total ?? 0);
          current.previsto = Math.max(current.previsto, Number(row.meta_diaria ?? 0));
          dailyMap.set(d, current);
        });

        const producaoDiaria = Array.from(dailyMap.entries())
          .map(([data, v]) => ({
            data,
            real: v.real,
            previsto: v.previsto,
          }))
          .sort((a, b) => a.data.localeCompare(b.data));

        // Group frenteRows by frente for the donut chart (only for latest date/shift)
        const latestFrenteDate = frenteRows?.[0]?.data_referencia;
        const latestFrenteTurno = frenteRows?.[0]?.turno;
        const filteredFrentes = (frenteRows ?? []).filter(
          (f) => f.data_referencia === latestFrenteDate && f.turno === latestFrenteTurno
        );
        const producaoFrente = filteredFrentes.map((f) => ({
          frente: f.frente,
          massa: Number(f.toneladas ?? 0),
        }));

        // Group equipRows by equipamento for the rankingEscavadeiras (only for latest date/shift)
        const latestEquipDate = equipRows?.[0]?.data_referencia;
        const latestEquipTurno = equipRows?.[0]?.turno;
        const filteredEquips = (equipRows ?? []).filter(
          (e) => e.data_referencia === latestEquipDate && e.turno === latestEquipTurno
        );
        const rankingEscavadeiras = filteredEquips.map((e) => ({
          equipamento: e.equipamento,
          th: Number(e.producao_hora ?? 0),
          massa: Number(e.toneladas ?? 0),
          viagens: 0,
          material: e.tipo,
          frente: null,
          destino: null,
        }));

        // Detailed trips (viagensCR) and trips per hour (viagensHora)
        const latestViagensDate = viagensRows?.[0]?.data_referencia;
        const latestViagensTurno = viagensRows?.[0]?.turno;
        const filteredViagens = (viagensRows ?? []).filter(
          (v: any) => v.data_referencia === latestViagensDate && v.turno === latestViagensTurno
        );
        
        const viagensCR = filteredViagens.map((v: any) => ({
          cr: v.equipamento || v.frota || "CR",
          escavadeira: null,
          origem: v.frente_origem,
          destino: v.frente_destino,
          material: null,
          quantidade: Number(v.viagens ?? 1),
          tonelagem: Number(v.toneladas ?? 0),
          inicio: null,
          fim: null,
          ciclo: Number(v.tempo_ciclo_min ?? 0),
        }));

        const viagensHora = Array.from({ length: 24 }, (_, i) => ({
          hora: String(i).padStart(2, "0"),
          viagens: 0,
        }));
        filteredViagens.forEach((v: any) => {
          if (v.created_at) {
            const date = new Date(v.created_at);
            const hour = date.getHours();
            viagensHora[hour].viagens += Number(v.viagens ?? 1);
          }
        });

        const totalViagens = filteredViagens.reduce((sum, v) => sum + Number(v.viagens ?? 0), 0);

        const latestDate = latest?.data_referencia;
        const todayRows = (diariaRows ?? []).filter((r) => r.data_referencia === latestDate);
        const producaoDiaTotal = todayRows.reduce((sum, r) => sum + Number(r.toneladas_total ?? 0), 0);
        const metaDiariaTotal = todayRows.reduce((max, r) => Math.max(max, Number(r.meta_diaria ?? 0)), 0);
        const producaoMensalTotal = latest?.acumulado_mes ?? 0;

        const thAvg = todayRows.length > 0
          ? todayRows.reduce((sum, r) => sum + Number(r.producao_hora ?? 0), 0) / todayRows.length
          : 0;

        const lavAcumulado = todayRows.reduce((sum, r) => sum + Number(r.producao_mina ?? 0), 0);
        const retAcumulado = todayRows.reduce((sum, r) => sum + Number(r.producao_retaludamento ?? 0), 0);
        
        const lavProjetado = todayRows.reduce((sum, r) => sum + Number(r.projecao_turno ?? r.producao_mina ?? 0), 0);
        const retProjetado = todayRows.reduce((sum, r) => sum + (r.projecao_turno ? (Number(r.projecao_turno) * (retAcumulado / (lavAcumulado + retAcumulado || 1))) : Number(r.producao_retaludamento ?? 0)), 0);

        const cards = {
          lav: {
            acumuladoDia: lavAcumulado,
            projetadoDia: lavProjetado || (lavAcumulado * 1.1),
          },
          ret: {
            acumuladoDia: retAcumulado,
            projetadoDia: retProjetado || (retAcumulado * 1.1),
          },
          producaoDiaria: producaoDiaTotal,
          producaoMensal: producaoMensalTotal,
          th: thAvg,
          viagens: totalViagens,
        };

        const fallbackPayload = {
          kpis: {
            producaoReal: producaoDiaTotal,
            metaDiaria: metaDiariaTotal,
            acumuladoMes: producaoMensalTotal,
            faltaParaMeta: Math.max(0, metaDiariaTotal - producaoDiaTotal),
            viagens: totalViagens,
            produtividadeMedia: thAvg,
            producaoDia: producaoDiaTotal,
            producaoMensal: producaoMensalTotal,
            producaoTotalEscavadeirasTH: thAvg,
          },
          cards,
          producaoDiaria,
          producaoFrente,
          rankingEscavadeiras,
          viagensCR,
          viagensHora,
          atualizadoEm: latest?.atualizado_em || new Date().toISOString(),
        } as unknown as DashboardApiPayload;

        setDashboardData(fallbackPayload);
        setUltimaAtualizacao(fallbackPayload.atualizadoEm || new Date().toISOString());
        setSegundosAtualizacao(15);
        setErroApi(null);
      } catch (fbError) {
        console.error("[DASHBOARD FALLBACK ERRO]", fbError);
        setErroApi(message);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
    intervalRef.current = setInterval(() => {
      carregarDashboard();
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [carregarDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSegundosAtualizacao((prev) => {
        if (prev <= 1) return 15;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Identificação dinâmica do mês e ano para virada de chave automática
  const nomesMeses = useMemo(() => [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ], []);
  const dataAtual = new Date();
  const mesAtualIdx = dataAtual.getMonth(); // 0 a 11 (ex: 7 para Agosto)
  const currentMonthNum = mesAtualIdx + 1; // 1 a 12 (ex: 8)
  const currentMonthStr = String(currentMonthNum).padStart(2, "0"); // "08"
  const currentYearStr = String(dataAtual.getFullYear()); // "2026"
  const currentMonthKey = `${currentYearStr}-${currentMonthStr}`; // "2026-08"
  const nomeMesAtual = nomesMeses[mesAtualIdx]; // ex: "AGOSTO"
  const anoAtual = dataAtual.getFullYear(); // ex: 2026
  const siglaMesAtual = nomeMesAtual.substring(0, 3); // ex: "AGO"

  // Validação: os dados de turno/dia da API pertencem ao mês vigente (ex: Mês 8)?
  // Se forem resíduos do mês anterior (ex: 31/07 com 404 viagens), vira a chave e zera tudo para o novo mês.
  const dadosPertencemAoMesAtual = useMemo(() => {
    if (!dashboardData) return false;

    // 1. Verifica data explícita do turno ou cards se existir
    const dataRef = String((dashboardData as any)?.dataReferencia || (dashboardData as any)?.data || (dashboardData as any)?.cards?.data || "").trim();
    if (dataRef) {
      if (dataRef.includes("-")) {
        return dataRef.startsWith(currentMonthKey) || dataRef.includes(`-${currentMonthStr}-`);
      }
      if (dataRef.includes("/")) {
        const parts = dataRef.split("/");
        if (parts.length >= 2) return parts[1].padStart(2, "0") === currentMonthStr;
      }
    }

    // 2. Verifica se a última data da produção diária é do mês atual
    const todos = dashboardData?.producaoDiaria ?? [];
    if (todos.length > 0) {
      const last = todos[todos.length - 1];
      const lastData = String(last?.data || "").trim();
      if (lastData.includes("-")) {
        return lastData.startsWith(currentMonthKey) || lastData.includes(`-${currentMonthStr}-`);
      }
      if (lastData.includes("/")) {
        const parts = lastData.split("/");
        if (parts.length >= 2) return parts[1].padStart(2, "0") === currentMonthStr;
      }
    }

    // 3. Verifica timestamp de atualização da API
    const atualizado = String((dashboardData as any)?.atualizadoEm || "").trim();
    if (atualizado && atualizado.includes("-")) {
      return atualizado.startsWith(currentMonthKey) || atualizado.includes(`-${currentMonthStr}-`);
    }

    return false;
  }, [dashboardData, currentMonthKey, currentMonthStr]);

  const cards = ((dashboardData as any)?.cards ?? {}) as Record<string, any>;
  const lavCard = (cards.lav ?? {}) as Record<string, any>;
  const retCard = (cards.ret ?? {}) as Record<string, any>;

  // Valores zerados se os dados forem resíduo do mês anterior
  const lavFinal = dadosPertencemAoMesAtual ? Number(lavCard.acumuladoDia ?? 0) : 0;
  const lavProjetado = dadosPertencemAoMesAtual ? Number(lavCard.projetadoDia ?? 0) : 0;
  const retFinal = dadosPertencemAoMesAtual ? Number(retCard.acumuladoDia ?? 0) : 0;
  const retProjetado = dadosPertencemAoMesAtual ? Number(retCard.projetadoDia ?? 0) : 0;
  const producaoDia = dadosPertencemAoMesAtual ? Number(cards.producaoDiaria ?? 0) : 0;
  const producaoTotalEscavadeirasTH = dadosPertencemAoMesAtual ? Number(cards.th ?? 0) : 0;
  const viagens = dadosPertencemAoMesAtual ? Number(cards.viagens ?? 0) : 0;

  // Valor bruto vindo da API (sem cálculo local)
  const producaoMensal = Number(dashboardData?.kpis?.producaoMensal ?? 0);
  const lavMensal = Number(cards.lavMensal ?? (dashboardData as any)?.cards?.lavMensal ?? 0);
  const retMensal = Number(cards.retMensal ?? (dashboardData as any)?.cards?.retMensal ?? 0);

  const dailySeries = useMemo(() => {
    const todos = dashboardData?.producaoDiaria ?? [];
    const ultimos7 = todos.length > 7 ? todos.slice(-7) : todos;
    return ultimos7.map((d) => {
      let labelDia = d.data;
      if (d.data && d.data.includes("-")) {
        const parts = d.data.split("-");
        if (parts.length === 3) labelDia = `${parts[2]}/${parts[1]}`;
      }
      return {
        dia: labelDia,
        diaOriginal: d.data,
        Real: Number(d.real ?? 0),
        Programada: Number(d.previsto ?? 0),
      };
    });
  }, [dashboardData]);

  const mediaDiaria = useMemo(() => {
    const valoresReais = dailySeries.map((d) => d.Real || 0);
    const soma = valoresReais.reduce((a, b) => a + b, 0);
    return dailySeries.length ? soma / dailySeries.length : 0;
  }, [dailySeries]);

  const rotuloMedia = useMemo(() => {
    const valorEmKt = mediaDiaria / 1000;
    const valorFormatado = valorEmKt.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${valorFormatado} kt`;
  }, [mediaDiaria]);

  const frenteAgg = useMemo(() => {
    if (!dadosPertencemAoMesAtual) return [];
    const arr = (dashboardData?.producaoFrente ?? [])
      .map((f) => {
        const name = String(f.frente || "").trim();
        return { name, value: Number(f.massa ?? 0) };
      })
      .filter((r) => {
        if (r.value <= 0) return false;
        if (!r.name) return false;
        
        const lower = r.name.toLowerCase();
        if (
          lower === "null" ||
          lower === "undefined" ||
          lower === "nulo" ||
          lower === "n/a" ||
          lower === "n/d" ||
          lower === "none" ||
          lower === "não informado"
        ) {
          return false;
        }

        const upper = r.name.toUpperCase();
        if (
          upper.includes("GELADO") ||
          upper.includes("GEL") ||
          upper.includes("TESTE") ||
          upper.includes("DEMO") ||
          upper.includes("OUTROS")
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, r) => s + r.value, 0) || 1;
    return arr.map((r) => ({ ...r, pct: (r.value / total) * 100 }));
  }, [dashboardData, dadosPertencemAoMesAtual]);

  // Shift context for Turno A (06:00-18:00) and Turno B (18:00-06:00 next day)
  const shiftInfo = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();

    const shiftStart = new Date(now);
    const shiftEnd = new Date(now);

    if (hours >= 6 && hours < 18) {
      // Turno A
      shiftStart.setHours(6, 0, 0, 0);
      shiftEnd.setHours(17, 59, 59, 999);
    } else if (hours >= 18) {
      // Turno B (starts 18:00 today, ends 05:59:59 tomorrow)
      shiftStart.setHours(18, 0, 0, 0);
      shiftEnd.setDate(shiftEnd.getDate() + 1);
      shiftEnd.setHours(5, 59, 59, 999);
    } else {
      // Turno B (started 18:00 yesterday, ends 05:59:59 today)
      shiftStart.setDate(shiftStart.getDate() - 1);
      shiftStart.setHours(18, 0, 0, 0);
      shiftEnd.setHours(5, 59, 59, 999);
    }

    const elapsedMs = now.getTime() - shiftStart.getTime();
    const elapsedHours = Math.min(12, Math.max(0.05, elapsedMs / (1000 * 60 * 60)));

    return {
      shiftStart,
      shiftEnd,
      elapsedHours,
      shiftName: hours >= 6 && hours < 18 ? "A" : "B",
    };
  }, [ultimaAtualizacao]);

  const isRecordInCurrentShift = useCallback(
    (rec: any) => {
      if (!rec) return false;
      const { shiftStart, shiftEnd, shiftName } = shiftInfo;

      // 1. Explicit shift field check
      const s = String(rec.turno ?? rec.shift ?? "").toUpperCase();
      if (s) {
        if (s === shiftName || s === `TURNO ${shiftName}` || s === `TURNO_${shiftName}`) {
          return true;
        }
        if (s === "A" || s === "B" || s === "TURNO A" || s === "TURNO B") {
          return false;
        }
      }

      // 2. Timestamp check (inicio, fim, created_at, timestamp, data, data_referencia)
      const tRaw = rec.inicio || rec.created_at || rec.timestamp || rec.data_referencia || rec.data;
      if (tRaw) {
        const dt = new Date(tRaw);
        if (!isNaN(dt.getTime())) {
          if (typeof tRaw === "string" && tRaw.length <= 10 && tRaw.includes("-")) {
            const dateStr = shiftStart.toISOString().slice(0, 10);
            if (tRaw !== dateStr) return false;
          } else {
            return dt.getTime() >= shiftStart.getTime() && dt.getTime() <= shiftEnd.getTime();
          }
        }
      }

      // 3. Hour check (0..23)
      if (rec.hora !== undefined && rec.hora !== null && rec.hora !== "") {
        let h = -1;
        if (typeof rec.hora === "number") {
          h = rec.hora;
        } else {
          const m = String(rec.hora).match(/(\d{1,2})/);
          if (m) h = parseInt(m[1], 10);
        }
        if (h >= 0 && h < 24) {
          if (shiftName === "A") {
            return h >= 6 && h < 18;
          } else {
            return h >= 18 || h < 6;
          }
        }
      }

      return true;
    },
    [shiftInfo]
  );

  const dadosPertencemAoTurnoAtual = useMemo(() => {
    if (!dadosPertencemAoMesAtual || !dashboardData) return false;

    const atualizadoEm = (dashboardData as any)?.atualizadoEm;
    if (atualizadoEm) {
      const dt = new Date(atualizadoEm);
      if (!isNaN(dt.getTime())) {
        if (dt.getTime() < shiftInfo.shiftStart.getTime()) {
          return false;
        }
      }
    }
    return true;
  }, [dashboardData, dadosPertencemAoMesAtual, shiftInfo.shiftStart]);


  // Utiliza estritamente escavadeirasDetalhado vindo da API
  const top5Escav = useMemo(() => {
    const detalhado = Array.isArray(dashboardData?.escavadeirasDetalhado) ? dashboardData!.escavadeirasDetalhado! : [];

    const activeRows: Array<{
      equipamento: string;
      material: string | null;
      frente: string | null;
      destinos: Array<{ destino: string; massa: number; viagens: number }>;
      totalMassa: number;
      totalViagens: number;
      th: number;
      ativa: boolean;
    }> = [];

    const processedCodes = new Set<string>();

    detalhado.forEach((d: any) => {
      const code = String(d.equipamento || "").trim();
      if (!code) return;

      const normCode = normEquip(code);
      processedCodes.add(normCode);

      const rawDestinos = Array.isArray(d.destinos)
        ? d.destinos.map((x: any) => ({
            destino: String(x.destino ?? "—"),
            massa: toNum(x.massa),
            viagens: toNum(x.viagens),
          }))
        : [];

      const somaMassa = rawDestinos.reduce((s: number, x: any) => s + x.massa, 0);
      const somaViagens = rawDestinos.reduce((s: number, x: any) => s + x.viagens, 0);

      const massa = toNum(d.totalMassa) || somaMassa;
      const viagens = toNum(d.totalViagens) || somaViagens;
      const material = d.material ? String(d.material) : null;
      const frente = d.frente ? String(d.frente) : null;

      const th = shiftInfo.elapsedHours > 0 && massa > 0 ? massa / shiftInfo.elapsedHours : 0;
      const ativa = massa > 0 || viagens > 0 || rawDestinos.length > 0;

      activeRows.push({
        equipamento: code,
        material,
        frente,
        destinos: rawDestinos,
        totalMassa: massa,
        totalViagens: viagens,
        th,
        ativa,
      });
    });

    // Escavadeiras com produção no topo mantendo a ordem exata de escavadeirasDetalhado
    const ativas = activeRows.filter((r) => r.ativa);
    const inativasComDados = activeRows.filter((r) => !r.ativa);

    // Escavadeiras padrão da frota que não vieram em escavadeirasDetalhado
    const defaultFleet = ["EH4026", "EH4039", "EH4041", "EH4047", "EH4050", "EH4035", "EH5003", "EH5004", "EH5036"];
    const inativasSemDados: typeof activeRows = [];

    defaultFleet.forEach((code) => {
      if (!processedCodes.has(normEquip(code))) {
        inativasSemDados.push({
          equipamento: code,
          material: null,
          frente: null,
          destinos: [],
          totalMassa: 0,
          totalViagens: 0,
          th: 0,
          ativa: false,
        });
      }
    });

    return [...ativas, ...inativasComDados, ...inativasSemDados];
  }, [dashboardData, shiftInfo.elapsedHours]);

  const totalMassaTop5 = top5Escav.reduce((total, item) => total + Number(item.totalMassa || 0), 0);
  const totalViagensTop5 = top5Escav.reduce((total, item) => total + Number(item.totalViagens || 0), 0);
  const totalThTop5 = top5Escav.reduce((total, item) => total + Number(item.th || 0), 0);

  // T/H oficial do turno atual: total tonelagem do turno atual / horas decorridas do turno
  const thTurnoAtual = useMemo(() => {
    return shiftInfo.elapsedHours > 0 ? totalMassaTop5 / shiftInfo.elapsedHours : 0;
  }, [totalMassaTop5, shiftInfo.elapsedHours]);

    // ==========================================
    // NOVA SÉRIE: TKPH (Ton x Km / Hora) por Frota
    // ==========================================
    // TKPH: sem valor na API por enquanto — exibido como "—" (nenhum dado fixo/fictício)
    const tkphSeries: Array<Record<string, any>> = [];

  const viagensPorHora = useMemo(() => {
    if (!dadosPertencemAoMesAtual) return [];
    const raw = dashboardData?.viagensHora ?? [];
    if (!Array.isArray(raw)) return [];

    const mapped = raw.map((v: any) => {
      const horaStr = String(v.hora || "").trim();
      let horaLabel = horaStr;
      
      const timeMatch = horaStr.match(/(\d{2}):\d{2}/);
      if (timeMatch) {
        horaLabel = `${timeMatch[1]}:00`;
      } else {
        const simpleMatch = horaStr.match(/^(\d{2})$/);
        if (simpleMatch) {
          horaLabel = `${simpleMatch[1]}:00`;
        }
      }

      return {
        hora: horaLabel,
        horaOriginal: horaStr,
        Real: Number(v.viagens ?? 0)
      };
    });

    mapped.sort((a, b) => {
      const tA = new Date(a.horaOriginal).getTime();
      const tB = new Date(b.horaOriginal).getTime();
      if (!isNaN(tA) && !isNaN(tB)) return tA - tB;
      return a.hora.localeCompare(b.hora);
    });

    return mapped;
  }, [dashboardData, dadosPertencemAoMesAtual]);

  const prodSeries = useMemo(
    () =>
      dailySeries.map((d) => ({
        dia: d.dia,
        Real: d.Real,
        Programada: d.Programada,
      })),
    [dailySeries],
  );

// Metas mensais oficiais (Willian 2026) para virada automática de mês
const METAS_MENSAIS_2026: Record<number, {
  ex2500: { ut: number; df: number };
  ex1200: { ut: number; df: number };
  c730: { ut: number; df: number };
  c785: { ut: number; df: number };
}> = {
  1:  { ex2500: { ut: 68, df: 82 }, ex1200: { ut: 68, df: 80 }, c730: { ut: 68, df: 80 }, c785: { ut: 62, df: 85 } },
  2:  { ex2500: { ut: 68, df: 82 }, ex1200: { ut: 68, df: 80 }, c730: { ut: 68, df: 80 }, c785: { ut: 62, df: 85 } },
  3:  { ex2500: { ut: 68, df: 82 }, ex1200: { ut: 68, df: 80 }, c730: { ut: 68, df: 80 }, c785: { ut: 62, df: 85 } },
  4:  { ex2500: { ut: 68, df: 82 }, ex1200: { ut: 68, df: 80 }, c730: { ut: 68, df: 80 }, c785: { ut: 62, df: 85 } },
  5:  { ex2500: { ut: 68, df: 82 }, ex1200: { ut: 68, df: 80 }, c730: { ut: 68, df: 80 }, c785: { ut: 62, df: 85 } },
  6:  { ex2500: { ut: 68, df: 82 }, ex1200: { ut: 68, df: 80 }, c730: { ut: 68, df: 80 }, c785: { ut: 62, df: 85 } },
  7:  { ex2500: { ut: 68, df: 82 }, ex1200: { ut: 68, df: 80 }, c730: { ut: 68, df: 80 }, c785: { ut: 62, df: 85 } }, // Julho
  8:  { ex2500: { ut: 69, df: 82 }, ex1200: { ut: 77, df: 80 }, c730: { ut: 69, df: 80 }, c785: { ut: 70, df: 85 } }, // Agosto
  9:  { ex2500: { ut: 64, df: 82 }, ex1200: { ut: 74, df: 80 }, c730: { ut: 61, df: 80 }, c785: { ut: 67, df: 85 } }, // Setembro
  10: { ex2500: { ut: 64, df: 82 }, ex1200: { ut: 74, df: 80 }, c730: { ut: 62, df: 80 }, c785: { ut: 68, df: 85 } }, // Outubro
  11: { ex2500: { ut: 58, df: 82 }, ex1200: { ut: 43, df: 80 }, c730: { ut: 57, df: 80 }, c785: { ut: 39, df: 85 } }, // Novembro
  12: { ex2500: { ut: 47, df: 82 }, ex1200: { ut: 55, df: 80 }, c730: { ut: 45, df: 80 }, c785: { ut: 55, df: 85 } }, // Dezembro
};

function getMetaFrotaMes(fleetName: string, tipo: "df" | "ut", month?: number): number {
  const m = month || (new Date().getMonth() + 1);
  const metasMes = METAS_MENSAIS_2026[m] || METAS_MENSAIS_2026[8];
  const nameUpper = fleetName.toUpperCase();

  if (nameUpper.includes("EX2500") || nameUpper.includes("EX-2500")) {
    return tipo === "df" ? metasMes.ex2500.df : metasMes.ex2500.ut;
  }
  if (nameUpper.includes("EX1200") || nameUpper.includes("EX-1200")) {
    return tipo === "df" ? metasMes.ex1200.df : metasMes.ex1200.ut;
  }
  if (nameUpper.includes("785") || nameUpper.includes("HD785")) {
    return tipo === "df" ? metasMes.c785.df : metasMes.c785.ut;
  }
  if (nameUpper.includes("730") || nameUpper.includes("KOMATSU 730")) {
    return tipo === "df" ? metasMes.c730.df : metasMes.c730.ut;
  }

  return tipo === "df" ? 80.0 : 65.0;
}

  const getFleetTotal = useCallback((name: string, configuredQty?: number) => {
    const nameUpper = name.toUpperCase();
    if (nameUpper.includes("785")) return 25;
    if (nameUpper.includes("730")) return configuredQty && configuredQty > 0 ? configuredQty : 15;
    return configuredQty ?? 0;
  }, []);

  const frotasDfRender = useMemo(() => {
    const disp = Array.isArray(dashboardData?.disponibilidadePorFrota) ? dashboardData.disponibilidadePorFrota : [];
    return disp.map((item: any) => {
      const name = item.frota || "";
      const nameUpper = name.toUpperCase();
      const total = getFleetTotal(name, item.quantidadeConfigurada);
      const rawAtivos = item.quantidadeComDados ?? 0;
      const ativos = total > 0 ? Math.min(total, rawAtivos) : rawAtivos;

      // Meta dinâmica automática por virada de mês (Excel Willian 2026)
      const metaValue = getMetaFrotaMes(name, "df");
      const dfVal = Number(item.valor ?? 0);
      let dfCalc = (total > 0 && ativos >= total) || dfVal >= 99.5 ? 100 : (dfVal > 0 ? dfVal : (total > 0 ? (ativos / total) * 100 : 0));

      const paradas: ParadaFrota[] = Array.isArray(item.paradas) ? item.paradas : [];

      return {
        name,
        type: nameUpper.includes("CAMINHÃO") || nameUpper.includes("CAMINHOES") || nameUpper.includes("785") || nameUpper.includes("730") ? "trk" : "exc",
        df: Math.min(100, dfCalc),
        eq: `${ativos}/${total}`,
        ativos,
        total,
        paradas,
        meta: metaValue,
      };
    });
  }, [dashboardData, getFleetTotal]);

  const frotasUtRender = useMemo(() => {
    const util = Array.isArray(dashboardData?.utilizacaoPorFrota) ? dashboardData.utilizacaoPorFrota : [];
    return util.map((item: any) => {
      const name = item.frota || "";
      const nameUpper = name.toUpperCase();
      const total = getFleetTotal(name, item.quantidadeConfigurada);
      const rawAtivos = item.quantidadeComDados ?? 0;
      const ativos = total > 0 ? Math.min(total, rawAtivos) : rawAtivos;

      // Meta dinâmica automática por virada de mês (Excel Willian 2026)
      const metaValue = getMetaFrotaMes(name, "ut");

      return {
        name,
        type: nameUpper.includes("CAMINHÃO") || nameUpper.includes("CAMINHOES") || nameUpper.includes("785") || nameUpper.includes("730") ? "trk" : "exc",
        ut: Math.min(100, Number(item.valor ?? 0)),
        eq: `${ativos}/${total}`,
        meta: metaValue,
      };
    });
  }, [dashboardData, getFleetTotal]);

  const mediaViagens = 0;



  const limparFiltros = () => {
    setDtIni(inicioAno);
    setDtFim(hoje);
  };

  const visaoFade = useAnimationControls();
  const atualizadoEm = (dashboardData as any)?.atualizadoEm || ultimaAtualizacao;
  const atualizadoEmFormatado = atualizadoEm ? new Date(atualizadoEm).toLocaleString("pt-BR") : "—";

  // Cabeçalho: data de referência, turno e hora da última atualização (API)
  const headerInfo = (() => {
    const refRaw: any = (dashboardData as any)?.dataReferencia;
    const ref = String(
      refRaw && typeof refRaw === "object" ? (refRaw.data ?? refRaw.dia ?? refRaw.date ?? "") : (refRaw ?? "")
    ).trim();
    let dataTxt = "—";
    if (ref) {
      const m = ref.match(/^(\d{4})-(\d{2})-(\d{2})/);
      dataTxt = m ? `${m[3]}/${m[2]}/${m[1]}` : ref;
    } else if (atualizadoEm) {
      dataTxt = new Date(atualizadoEm).toLocaleDateString("pt-BR");
    }
    const turnoTxt = shiftInfo.elapsedHours >= 0 && new Date().getHours() >= 6 && new Date().getHours() < 18
      ? "Turno A (06:00–18:00)"
      : "Turno B (18:00–06:00)";
    const hora = atualizadoEm ? new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
    return `${dataTxt} · ${turnoTxt} · atualizado ${hora}`;
  })();

  // Séries diárias por contrato (campos da API, sem cálculo)
  const dailyLav = (dashboardData?.producaoDiaria ?? []).slice(-7).map((d: any) => ({
    dia: d.data && String(d.data).includes("-") ? `${String(d.data).split("-")[2]}/${String(d.data).split("-")[1]}` : d.data,
    Programada: d.programadoLav ?? null,
    Real: d.realLav ?? null,
  }));
  const dailyRet = (dashboardData?.producaoDiaria ?? []).slice(-7).map((d: any) => ({
    dia: d.data && String(d.data).includes("-") ? `${String(d.data).split("-")[2]}/${String(d.data).split("-")[1]}` : d.data,
    Programada: d.programadoRet ?? null,
    Real: d.realRet ?? null,
  }));

  // Frentes por contrato (escavadeirasDetalhado, só as que produzem)
  const detalhadoRaw: any[] = Array.isArray(dashboardData?.escavadeirasDetalhado) ? (dashboardData!.escavadeirasDetalhado as any[]) : [];
  const produzindo = detalhadoRaw.filter((r) => {
    const vDesc = r.viagensDescarregadas !== undefined && r.viagensDescarregadas !== null
      ? toNum(r.viagensDescarregadas)
      : toNum(r.totalViagens);
    return vDesc > 0;
  });
  const frentesLav = produzindo.filter((r) => String(r.contrato || "").toUpperCase() === "LAV");
  const frentesRet = produzindo.filter((r) => String(r.contrato || "").toUpperCase() === "RET");

  const tkphUltimo = tkphSeries.length > 0 ? tkphSeries[tkphSeries.length - 1] : null;
  const tkphData = tkphUltimo?.fullDate
    ? (String(tkphUltimo.fullDate).includes("-")
        ? `${String(tkphUltimo.fullDate).split("-")[2]}/${String(tkphUltimo.fullDate).split("-")[1]}`
        : String(tkphUltimo.fullDate))
    : "";

  return (
    <div
      className="force-live-animation min-h-screen p-2 md:p-3 dashboard-enter"
      style={{ background: UM.bg, color: UM.text, fontFamily: "Montserrat, sans-serif", fontVariantNumeric: "tabular-nums" }}
    >
      <UMHeader logo={logoUM} info={headerInfo} />
      <motion.div animate={visaoFade}>

      <SectionSep label="Visão Macro" />
      <div className="grid grid-cols-2 gap-2">
        <ContratoCard tipo="LAV" data={cards?.lav} mensal={cards?.lavMensal} />
        <ContratoCard tipo="RET" data={cards?.ret} mensal={cards?.retMensal} />
      </div>

      <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: "1.25fr 0.9fr 1.25fr" }}>
        <DailyContratoChart title="Produção diária · Lavra (t)" data={dailyLav} realColor={UM.green} titleColor={UM.green} />
        <FrenteDonut data={frenteAgg} />
        <DailyContratoChart title="Produção diária · Retaludamento (t)" data={dailyRet} realColor={UM.gold} titleColor={UM.goldText} />
      </div>

      <SectionSep label="Visão Micro" />
      <div className="grid grid-cols-2 gap-2 items-stretch">
        <div className="flex flex-col gap-2 min-w-0">
          <FrentesTable tipo="LAV" rows={frentesLav} card={cards?.lav} className="flex-1" />
          <FrentesTable tipo="RET" rows={frentesRet} card={cards?.ret} className="flex-1" />
        </div>

        <UMCard className="p-3 flex flex-col">
          <UMTitle>Indicadores por frota · disponibilidade, utilização e produtividade</UMTitle>
          <div className="flex flex-col flex-1 justify-evenly">
            {frotasDfRender.map((item) => {
              const utItem = frotasUtRender.find((u) => u.name === item.name);
              const linhas = [
                { label: "DISPO", value: item.df, meta: item.meta, color: item.df >= item.meta ? UM.green : UM.red },
                ...(utItem ? [{ label: "UTIL", value: utItem.ut, meta: utItem.meta, color: utItem.ut >= utItem.meta ? UM.green : UM.goldText }] : []),
              ];
              const isTrk = item.type === "trk";
              const tkphVal = isTrk && tkphUltimo
                ? (item.name.includes("785") ? (tkphUltimo as any)["CR 785"] : item.name.includes("730") ? (tkphUltimo as any)["CR 730"] : null)
                : null;
              return (
                <div key={item.name} className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: UM.border }}>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-[70px] flex items-center justify-center flex-shrink-0">
                      {item.type === "exc" ? (
                        <ExcavatorIcon className="w-[70px] h-[52px]" />
                      ) : (
                        <CaminhaoBasculante className="w-[78px] h-[60px]" />
                      )}
                    </div>
                    <div className="whitespace-nowrap">
                      <div className="text-[19px] font-bold uppercase" style={{ color: UM.text }}>{item.name}</div>
                      <div className="text-[15px] font-semibold tabular-nums" style={{ color: item.ativos < item.total ? UM.goldText : UM.text2 }}>
                        ({item.eq})
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
                    {item.paradas && item.paradas.length > 0 ? (
                      <div className="flex items-center justify-center gap-1.5">
                        {item.paradas.slice(0, 4).map((parada: any, idx: number) => (
                          <LuzAviso key={parada.id || `${item.name}-${idx}`} parada={parada} />
                        ))}
                        {item.paradas.length > 4 && (
                          <div className="w-[32px] h-[32px] rounded-[10px] border text-xs font-bold flex items-center justify-center" style={{ borderColor: UM.border, color: UM.text2 }}>
                            +{item.paradas.length - 4}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0 w-[270px]">
                    {linhas.map((l) => {
                      const pct = Math.max(0, Math.min(100, Number(l.value) || 0));
                      const metaPct = Math.max(0, Math.min(100, Number(l.meta) || 0));
                      return (
                        <div key={l.label} className="flex items-center gap-2 whitespace-nowrap">
                          <span className="w-[40px] text-[11px] font-bold" style={{ color: UM.text2 }}>{l.label}</span>
                          <span className="w-[72px] text-right text-[20px] font-bold tabular-nums" style={{ color: l.color }}>
                            {pct.toFixed(1).replace(".", ",")}%
                          </span>
                          <div className="relative flex-1 h-[8px] rounded-full" style={{ background: UM.border }}>
                            <motion.div className="absolute inset-y-0 left-0 rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} style={{ background: l.color }} />
                            <div className="absolute -top-[3px] -bottom-[3px] w-[2px]" style={{ left: `calc(${metaPct}% - 1px)`, background: UM.text }} />
                          </div>
                          <span className="text-[11px] font-semibold tabular-nums" style={{ color: UM.text2 }}>Meta {metaPct.toFixed(1).replace(".", ",")}%</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="w-[70px] flex-shrink-0 border-l pl-2 text-right whitespace-nowrap" style={{ borderColor: UM.border }}>
                    <div className="text-[11px] font-bold" style={{ color: UM.green }}>{isTrk ? "TKPH" : "PROD"}</div>
                    <div className="text-[22px] font-bold tabular-nums leading-tight" style={{ color: UM.text }}>
                      {isTrk ? (isNum(tkphVal) ? <AnimNum value={tkphVal} /> : "—") : "—"}
                    </div>
                    <div className="text-[10px]" style={{ color: UM.text3 }}>{isTrk ? tkphData : "t/h efetiva"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </UMCard>
      </div>

      </motion.div>

      {/* Footer */}
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2 px-1 text-[11px] tabular-nums" style={{ color: UM.text3 }}>
        <span className="flex items-center gap-4">
          <span>
            Atualização em: <span className="font-bold" style={{ color: UM.green }}>{segundosAtualizacao}s</span>
          </span>
          <span>
            Última atualização: <span className="font-bold" style={{ color: UM.text }}>{atualizadoEmFormatado}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/* ---------- small components ---------- */
const CustomLabel = (props: any) => {
  const { viewBox, value } = props;
  const x = (viewBox?.x || 0) + (viewBox?.width || 0);
  const y = viewBox?.y || 0;
  const boxWidth = 56;
  const boxHeight = 22;
  return (
    <g>
      <rect 
        x={x + 6} 
        y={y - boxHeight / 2} 
        width={boxWidth} 
        height={boxHeight} 
        fill="rgba(3, 20, 26, 0.9)" 
        rx={4}
        stroke="#f97316"
        strokeWidth={1}
      />
      <text 
        x={x + 6 + boxWidth / 2} 
        y={y + 1} 
        fill="#f97316" 
        textAnchor="middle" 
        dominantBaseline="middle" 
        fontSize={11}
        fontWeight={700}
        fontFamily="Inter, sans-serif"
        style={{ textShadow: "0 0 6px rgba(249,115,22,0.6)" }}
      >
        {value}
      </text>
    </g>
  );
};

const tooltipStyle: React.CSSProperties = {
  background: "hsl(220 50% 6%)",
  border: "1px solid hsl(199 95% 60% / 0.4)",
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
  color: "hsl(210 40% 96%)",
};

function Kpi({
  label,
  value,
  color,
  borderClass = "border-[#22c55e]/20",
}: {
  label: string;
  value: string;
  color: string;
  borderClass?: string;
}) {
  return (
    <div className={`bg-[#000000] border ${borderClass} rounded-md px-3 py-2 flex items-center`}>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-[#9ca3af] font-bold truncate">{label}</p>
        <p className={`text-lg md:text-xl font-black leading-tight ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function GradientKpi({
  label,
  numeric,
  tone,
  suffix = "",
  decimals = 0,
}: {
  label: string;
  numeric: number;
  tone: "green" | "amber" | "teal" | "blue" | "cyan" | "indigo";
  suffix?: string;
  decimals?: number;
}) {
  const toneMap: Record<string, { grad: string; border: string; text: string; label: string }> = {
    green: {
      grad: "from-[hsl(150_80%_18%)] via-[hsl(155_70%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-emerald-400/40",
      text: "text-emerald-400 drop-shadow-[0_0_8px_hsl(150_90%_55%/0.55)]",
      label: "text-emerald-400",
    },
    amber: {
      grad: "from-[hsl(35_85%_25%)] via-[hsl(30_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-amber-400/50",
      text: "text-amber-400 drop-shadow-[0_0_8px_hsl(35_100%_55%/0.55)]",
      label: "text-amber-400",
    },
    teal: {
      grad: "from-[hsl(180_70%_20%)] via-[hsl(190_60%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-teal-400/30",
      text: "text-teal-300",
      label: "text-teal-200/70",
    },
    blue: {
      grad: "from-[hsl(215_80%_25%)] via-[hsl(215_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-sky-400/40",
      text: "text-sky-400 drop-shadow-[0_0_8px_hsl(199_100%_60%/0.55)]",
      label: "text-sky-400",
    },
    cyan: {
      grad: "from-[hsl(190_85%_25%)] via-[hsl(200_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-cyan-400/30",
      text: "text-cyan-300",
      label: "text-cyan-200/70",
    },
    indigo: {
      grad: "from-[hsl(240_60%_25%)] via-[hsl(240_50%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-indigo-400/30",
      text: "text-indigo-300",
      label: "text-indigo-200/70",
    },
  };
  const t = toneMap[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ boxShadow: "0 0 14px rgba(0,180,255,0.15)" }}
      className={`kpi-card kpi-pulse-glow relative overflow-hidden rounded-md border ${t.border} bg-gradient-to-br ${t.grad} px-3 py-2.5 shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300`}
    >
      <p className={`text-[10px] uppercase tracking-[0.18em] font-bold truncate ${t.label}`}>{label}</p>
      <p className={`text-2xl md:text-[26px] font-black leading-tight ${t.text} tabular-nums`}>
        <Counter value={numeric} decimals={decimals} suffix={suffix} />
      </p>
      <span className={`pointer-events-none absolute left-4 right-4 bottom-0 h-[2px] rounded-full bg-current ${t.text} opacity-70 blur-[1px]`} />
    </motion.div>
  );
}

function DualKpi({
  label,
  sublabel = "Acumulado Dia",
  acumulado,
  tone,
}: {
  label: string;
  sublabel?: string;
  acumulado: number;
  tone: "green" | "amber" | "teal" | "blue" | "cyan" | "indigo";
}) {
  const toneMap: Record<string, { grad: string; border: string; text: string; label: string }> = {
    green: {
      grad: "from-[hsl(150_80%_18%)] via-[hsl(155_70%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-emerald-400/40",
      text: "text-sky-400 drop-shadow-[0_0_8px_hsl(199_100%_60%/0.55)]",
      label: "text-emerald-400",
    },
    amber: {
      grad: "from-[hsl(35_85%_25%)] via-[hsl(30_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-amber-400/50",
      text: "text-amber-400 drop-shadow-[0_0_8px_hsl(35_100%_55%/0.55)]",
      label: "text-amber-400",
    },
    teal: {
      grad: "from-[hsl(180_70%_20%)] via-[hsl(190_60%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-teal-400/30",
      text: "text-teal-300",
      label: "text-teal-200/70",
    },
    blue: {
      grad: "from-[hsl(215_80%_25%)] via-[hsl(215_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-sky-400/30",
      text: "text-sky-300",
      label: "text-sky-200/70",
    },
    cyan: {
      grad: "from-[hsl(190_85%_25%)] via-[hsl(200_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-cyan-400/30",
      text: "text-cyan-300",
      label: "text-cyan-200/70",
    },
    indigo: {
      grad: "from-[hsl(240_60%_25%)] via-[hsl(240_50%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-indigo-400/30",
      text: "text-indigo-300",
      label: "text-indigo-200/70",
    },
  };
  const t = toneMap[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`kpi-card kpi-pulse-glow relative overflow-hidden rounded-md border ${t.border} bg-gradient-to-br ${t.grad} px-3 py-2.5`}
    >
      <p className={`text-[10px] uppercase tracking-[0.18em] font-bold truncate ${t.label}`}>{label}</p>
      <div className="mt-1">
        {sublabel && <p className={`text-[8px] uppercase tracking-widest font-bold ${t.label} opacity-80`}>{sublabel}</p>}
        <p className={`text-2xl md:text-[26px] font-black leading-tight ${t.text} tabular-nums`}>
          <Counter value={acumulado} />
        </p>
      </div>
      <span className={`pointer-events-none absolute left-4 right-4 bottom-0 h-[2px] rounded-full bg-current ${t.text} opacity-70 blur-[1px]`} />
    </motion.div>
  );
}

function MiniKpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-[#000000] border border-[#22c55e]/20 rounded-md p-2 flex flex-col justify-center">
      <p className="text-[8px] uppercase tracking-widest text-[#9ca3af] font-bold leading-tight">{label}</p>
      <p className="text-base font-black text-[#22c55e] leading-tight">{value}</p>
      {unit && <p className="text-[9px] text-muted-foreground">{unit}</p>}
    </div>
  );
}

/* ---------- Helper to format card values and fallback to "—" ---------- */
function renderCardVal(val: any, suffix = ""): string {
  if (val === null || val === undefined || val === "" || isNaN(Number(val))) {
    return "—";
  }
  return `${fmt(Number(val))}${suffix}`;
}

/* ---------- 1 & 2. LAVRA / RETALUDAMENTO Card (~160px) ---------- */
function LavRetCard({
  title,
  data,
}: {
  title: "LAVRA" | "RETALUDAMENTO";
  data?: any;
}) {
  const producaoTurno = data?.producaoTurno;
  const viagensTurno = data?.viagensTurno;
  const previstoAteAgora = data?.previstoAteAgora;
  const previstoTurno = data?.previstoTurno;
  const ritmo = data?.ritmo;
  const meta = data?.meta;
  const precisa = data?.precisa;
  const projecao = data?.projecao;
  const aderencia = data?.aderencia;

  const producaoTurnoStr =
    producaoTurno !== null && producaoTurno !== undefined && producaoTurno !== "" && !isNaN(Number(producaoTurno))
      ? fmt(Number(producaoTurno))
      : "—";

  const viagensTurnoStr =
    viagensTurno !== null && viagensTurno !== undefined && viagensTurno !== "" && !isNaN(Number(viagensTurno))
      ? fmt(Number(viagensTurno))
      : "—";

  const isLongNum = producaoTurnoStr.length >= 6;
  const numFontSize = isLongNum ? "text-[50px]" : "text-[62px]";
  const unitFontSize = isLongNum ? "text-[18px]" : "text-[20px]";

  const isRitmoAbaixo =
    ritmo != null && meta != null && Number(ritmo) < Number(meta);

  const aderenciaText =
    aderencia !== null && aderencia !== undefined && aderencia !== "" && !isNaN(Number(aderencia))
      ? `ADERÊNCIA ${aderencia}%`
      : "ADERÊNCIA —";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="kpi-card relative overflow-hidden rounded-lg border border-[#22c55e]/20 bg-[#000000] h-[160px] min-h-[160px] max-h-[160px] flex flex-col justify-between"
    >
      {/* Título do card (LAVRA / RETALUDAMENTO): 12px, padding 3px em cima e 1px embaixo */}
      <div className="pt-[3px] pb-[1px] px-[10px] shrink-0">
        <p className="text-[12px] font-bold text-[#22c55e] uppercase tracking-wider leading-none">
          {title}
        </p>
        <div className="h-px w-full bg-[#14532d] mt-[2px]" />
      </div>

      {/* Corpo do card: padding 0 em cima e embaixo, 10px à esquerda e 8px à direita */}
      <div className="flex-1 min-h-0 flex items-center pl-[10px] pr-[8px] py-0">
        {/* Coluna da esquerda com largura fixa de 190px */}
        <div className="w-[190px] min-w-[190px] max-w-[190px] shrink-0 flex flex-col justify-center overflow-hidden">
          {/* Número principal: 66px, negrito, line-height: 0.95 */}
          <div className="flex items-baseline whitespace-nowrap leading-[0.95]">
            <span className={`${numFontSize} font-extrabold text-white leading-[0.95] tracking-tight whitespace-nowrap tabular-nums`}>
              {producaoTurnoStr}
            </span>
            {producaoTurnoStr !== "—" && (
              <span className={`${unitFontSize} font-extrabold text-[#22c55e] ml-[3px] whitespace-nowrap leading-[0.95]`}>
                t
              </span>
            )}
          </div>
          {/* "50 viagens" / "110 viagens": 26px, verde */}
          <div className="mt-[6px] text-[26px] font-bold text-[#22c55e] leading-none whitespace-nowrap tabular-nums">
            {viagensTurnoStr !== "—" ? `${viagensTurnoStr} viagens` : "—"}
          </div>
        </div>

        {/* Grade da direita: grid-template-columns: 1fr 1fr; column-gap: 10px; row-gap: 0 */}
        <div
          className="flex-1 min-w-0 grid h-full"
          style={{
            gridTemplateColumns: "1fr 1fr",
            width: "100%",
            columnGap: "10px",
            rowGap: "0px",
            alignContent: "space-evenly",
          }}
        >
          {/* Linha 1 */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-[#22c55e] uppercase whitespace-nowrap leading-none">
              PROGRAMADO ATÉ AGORA
            </span>
            <span className="text-[27px] font-bold text-white whitespace-nowrap leading-none mt-0 tabular-nums">
              {renderCardVal(previstoAteAgora, " t")}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-[#22c55e] uppercase whitespace-nowrap leading-none">
              DO TURNO
            </span>
            <span className="text-[27px] font-bold text-white whitespace-nowrap leading-none mt-0 tabular-nums">
              {renderCardVal(previstoTurno, " t")}
            </span>
          </div>

          {/* Linha 2 */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-[#22c55e] uppercase whitespace-nowrap leading-none">
              RITMO
            </span>
            <span
              className={`text-[27px] font-bold whitespace-nowrap leading-none mt-0 tabular-nums ${
                isRitmoAbaixo ? "text-[#ef4444]" : "text-white"
              }`}
            >
              {renderCardVal(ritmo, " t/h")}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-[#22c55e] uppercase whitespace-nowrap leading-none">
              META
            </span>
            <span className="text-[27px] font-bold text-white whitespace-nowrap leading-none mt-0 tabular-nums">
              {renderCardVal(meta, " t/h")}
            </span>
          </div>

          {/* Linha 3 */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-[#22c55e] uppercase whitespace-nowrap leading-none">
              PRECISA
            </span>
            <span className="text-[27px] font-bold text-white whitespace-nowrap leading-none mt-0 tabular-nums">
              {renderCardVal(precisa, " t/h")}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] font-bold text-[#22c55e] uppercase whitespace-nowrap leading-none">
              PROJEÇÃO
            </span>
            <span className="text-[27px] font-bold text-white whitespace-nowrap leading-none mt-0 tabular-nums">
              {renderCardVal(projecao, " t")}
            </span>
          </div>
        </div>
      </div>

      {/* Faixa ADERÊNCIA: texto 19px, negrito, mesma altura de hoje */}
      <div className="w-full bg-[#dc3545] h-[26px] flex items-center justify-center text-white text-[19px] font-bold rounded-b-lg tracking-wide shrink-0 leading-none">
        {aderenciaText}
      </div>
    </motion.div>
  );
}

/* ---------- 3. PRODUÇÃO MENSAL Card (card mais estreito) ---------- */
function ProducaoMensalCard({
  mesSigla,
  ano,
  total,
  lavMensal,
  retMensal,
}: {
  mesSigla: string;
  ano: number | string;
  total?: number | null;
  lavMensal?: number | null;
  retMensal?: number | null;
}) {
  const totalStr =
    total !== null && total !== undefined && !isNaN(Number(total))
      ? fmt(Number(total))
      : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="kpi-card relative overflow-hidden rounded-lg border border-[#22c55e]/20 bg-[#000000] h-[160px] min-h-[160px] max-h-[160px] px-[10px] pt-[3px] pb-[8px] flex flex-col justify-between"
    >
      {/* Header: Título "PRODUÇÃO MENSAL" e selo à direita */}
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold text-[#22c55e] uppercase tracking-wider leading-none">
            PRODUÇÃO MENSAL
          </p>
          <span className="border border-[#22c55e]/60 bg-[#052e16] text-[#22c55e] text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider leading-none shrink-0 tabular-nums">
            {mesSigla}/{ano}
          </span>
        </div>
        <div className="h-px w-full bg-[#14532d] mt-[3px]" />
      </div>

      {/* Body: Número grande em cima (44px) + Embaixo LAVRA e RETALUDAMENTO lado a lado */}
      <div className="flex-1 flex flex-col justify-around min-h-0 pt-1">
        {/* Número grande (cards.lavMaisRetMensal) em cima: 44px, com o 't' ao lado em 16px */}
        <div className="flex items-baseline whitespace-nowrap leading-none">
          <span className="text-[44px] font-extrabold text-white leading-none tracking-tight tabular-nums">
            {totalStr}
          </span>
          {totalStr !== "—" && (
            <span className="text-[16px] font-extrabold text-[#22c55e] ml-1 leading-none">
              t
            </span>
          )}
        </div>

        {/* Embaixo, LAVRA e RETALUDAMENTO lado a lado: rótulo 11px verde e valor 18px negrito */}
        <div className="grid grid-cols-2 gap-x-2 w-full">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-[#22c55e] uppercase leading-none whitespace-nowrap">
              LAVRA
            </span>
            <span className="text-[18px] font-bold text-white leading-tight whitespace-nowrap mt-0.5 tabular-nums">
              {renderCardVal(lavMensal, " t")}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-[#22c55e] uppercase leading-none whitespace-nowrap">
              RETALUDAMENTO
            </span>
            <span className="text-[18px] font-bold text-white leading-tight whitespace-nowrap mt-0.5 tabular-nums">
              {renderCardVal(retMensal, " t")}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- 4. PRODUÇÃO DO TURNO Card (card mais estreito) ---------- */
function ProducaoTurnoCard({
  producaoTurno,
}: {
  producaoTurno?: number | null;
}) {
  const producaoTurnoStr =
    producaoTurno !== null && producaoTurno !== undefined && !isNaN(Number(producaoTurno))
      ? Number(producaoTurno).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
      : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="kpi-card relative overflow-hidden rounded-lg border border-[#22c55e]/20 bg-[#000000] h-[160px] min-h-[160px] max-h-[160px] px-[10px] pt-[3px] pb-[8px] flex flex-col justify-between"
    >
      <div className="shrink-0">
        <p className="text-[12px] font-bold text-[#22c55e] uppercase tracking-wider leading-none">
          PRODUÇÃO DO TURNO
        </p>
        <div className="h-px w-full bg-[#14532d] mt-[3px]" />
      </div>

      {/* Corpo: 52px, negrito, inteiro com ponto de milhar pt-BR */}
      <div className="flex-1 flex items-center min-h-0">
        <div className="flex items-baseline whitespace-nowrap leading-none">
          <span className="text-[52px] font-extrabold text-white leading-none tracking-tight tabular-nums">
            {producaoTurnoStr}
          </span>
          {producaoTurnoStr !== "—" && (
            <span className="text-[20px] font-extrabold text-[#22c55e] ml-1 leading-none">
              t
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatBlock({
  label,
  value,
  unit,
  big = false,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  big?: boolean;
}) {
  return (
    <div className="leading-tight">
      <p className="text-[11px] uppercase tracking-widest text-[#9ca3af] font-bold mb-0.5">{label}</p>
      <p className={`${big ? "text-3xl" : "text-xl"} font-extrabold text-foreground tabular-nums tracking-tight`}>
        {value}
        {unit && <span className="text-xs text-[#9ca3af] ml-2 font-normal uppercase">{unit}</span>}
      </p>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-bold py-1 pr-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan, title }: { children?: React.ReactNode; className?: string; colSpan?: number; title?: string }) {
  return <td colSpan={colSpan} title={title} className={`py-1 pr-2 truncate ${className}`}>{children}</td>;
}
function Empty() {
  return <p className="text-[11px] text-muted-foreground py-8 text-center">Sem dados reais disponíveis</p>;
}

function DonutProgress({ value, color, showPercent }: { value: number; color: string; showPercent: boolean }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative w-[88px] h-[88px] flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle cx="44" cy="44" r="38" fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xl font-extrabold tabular-nums tracking-tight" style={{ color: showPercent ? '#fff' : color }}>
        {value.toFixed(1)}{showPercent ? '%' : ''}
      </span>
    </div>
  );
}

function ExcavatorIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-excavator-dig-right flex items-center justify-center ${className}`}>
      <img
        src={excavatorNeon}
        alt="Escavadeira"
        className="w-full h-full object-contain"
        style={{ filter: "drop-shadow(0 0 6px rgba(245,180,0,0.75)) drop-shadow(0 0 12px rgba(245,180,0,0.35))" }}
      />
    </div>
  );
}

/* ---------- Avisos de paradas no estilo painel de carro ---------- */
interface MotivoConfig {
  icon: React.ComponentType<{ className?: string; size?: number | string; color?: string; strokeWidth?: number | string }>;
  color: string;
  rgba14: string;
  glow: string;
}

const MOTIVO_CONFIG: Record<string, MotivoConfig> = {
  manut: {
    icon: Wrench,
    color: "#DC3545",
    rgba14: "rgba(220, 53, 69, 0.10)",
    glow: "none",
  },
  abast: {
    icon: Fuel,
    color: "#f59e0b",
    rgba14: "rgba(245, 158, 11, 0.14)",
    glow: "0 0 14px rgba(245, 158, 11, 0.65), inset 0 0 6px rgba(245, 158, 11, 0.2)",
  },
  turno: {
    icon: RefreshCw,
    color: "#38bdf8",
    rgba14: "rgba(56, 189, 248, 0.14)",
    glow: "0 0 14px rgba(56, 189, 248, 0.65), inset 0 0 6px rgba(245, 158, 11, 0.2)",
  },
  almoco: {
    icon: Utensils,
    color: "#a78bfa",
    rgba14: "rgba(167, 139, 250, 0.14)",
    glow: "0 0 14px rgba(167, 139, 250, 0.65), inset 0 0 6px rgba(239, 68, 68, 0.2)",
  },
};

const getMotivoConfig = (motivo: string): MotivoConfig => {
  const m = String(motivo || "").toLowerCase().trim();
  if (m.includes("manut")) return MOTIVO_CONFIG.manut;
  if (m.includes("abast")) return MOTIVO_CONFIG.abast;
  if (m.includes("turno")) return MOTIVO_CONFIG.turno;
  if (m.includes("almoco") || m.includes("almoço")) return MOTIVO_CONFIG.almoco;
  return MOTIVO_CONFIG.manut;
};

function LuzAviso({ parada }: { parada: ParadaFrota }) {
  const config = getMotivoConfig(parada.motivo);
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div
        className={`w-[40px] h-[40px] rounded-[12px] flex items-center justify-center ${config === MOTIVO_CONFIG.manut ? "um-manut-pulse" : ""}`}
        style={{
          border: `1.5px solid ${config.color}`,
          backgroundColor: config.rgba14,
          boxShadow: config.glow,
        }}
      >
        <Icon size={20} color={config.color} strokeWidth={2.2} />
      </div>
      <span className="font-bold text-[10.5px] tabular-nums leading-tight mt-1 text-center whitespace-nowrap" style={{ color: "#2C2D2D" }}>
        {parada.equipamento}
      </span>
      <span
        className="text-[9.5px] font-medium tabular-nums leading-tight text-center whitespace-nowrap"
        style={{ color: config.color }}
      >
        {parada.tempo}
      </span>
    </div>
  );
}


