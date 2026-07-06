import { useMemo, useState } from "react";
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
} from "recharts";
import { Filter, Target, BarChart3, Gauge, Calendar, TrendingUp, Flag, AlertTriangle, Loader2 } from "lucide-react";
import { useDashboardApi } from "@/hooks/useDashboardApi";

/* ---------- helpers ---------- */
const fmt = (n: number, d = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const brDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  const meses = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d}/${meses[Number(m)] ?? m}`;
};

const FRENTE_COLORS = ["#38bdf8", "#22d3ee", "#0ea5e9", "#f59e0b", "#22c55e", "#a855f7", "#ef4444", "#eab308"];

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
    <div
      className={`bg-[hsl(220_45%_9%/0.85)] border border-mining-blue/20 rounded-md shadow-[0_0_24px_-14px_hsl(var(--mining-blue)/0.6)] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-3 pt-2">
          <p className="text-[11px] font-bold tracking-wider text-mining-blue uppercase">{title}</p>
          {right}
        </div>
      )}
      <div className="p-3 pt-2">{children}</div>
    </div>
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
      <span className="text-[9px] tracking-widest text-mining-blue/70 font-bold uppercase">{label}</span>
      {type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[hsl(220_40%_12%)] border border-mining-blue/25 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-mining-blue"
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[hsl(220_40%_12%)] border border-mining-blue/25 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-mining-blue"
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

/* ---------- main dashboard ---------- */
export default function DashboardProducaoUM() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioAno = `${new Date().getFullYear()}-01-01`;
  const [dtIni, setDtIni] = useState(inicioAno);
  const [dtFim, setDtFim] = useState(hoje);
  const [fTurno, setFTurno] = useState("");
  const [fFrente, setFFrente] = useState("");
  const [fEquip, setFEquip] = useState("");
  const [fMaterial, setFMaterial] = useState("");

  const { data: producao = [] } = useProducaoDiaria(365);
  const { data: frentesRows = [] } = useProducaoFrente(365);
  const { data: equipRows = [] } = useProducaoEquipamento(365);
  const { data: viagens = [] } = useViagens(30);
  const { data: ciclos = [] } = useTempoCiclo(30);
  const { data: tempoDet = [] } = useTempoDetalhado(30);
  const { data: tempoEst = [] } = useTempoEstado(30);
  const { data: producaoV = [] } = useProducaoView(30);

  /* filter opts */
  const opts = useMemo(() => {
    const turnos = new Set<string>();
    const frentes = new Set<string>();
    const equipamentos = new Set<string>();
    const materiais = new Set<string>();
    producao.forEach((r) => r.turno && turnos.add(r.turno));
    frentesRows.forEach((r) => r.frente && frentes.add(String(r.frente)));
    equipRows.forEach((r) => {
      if (r.equipamento) equipamentos.add(r.equipamento);
      if (r.tipo) materiais.add(r.tipo);
    });
    producaoV.forEach((r) => {
      if (r.equipamento) equipamentos.add(r.equipamento);
      if (r.frente) frentes.add(r.frente);
    });
    return {
      turnos: [...turnos].sort(),
      frentes: [...frentes].sort(),
      equipamentos: [...equipamentos].sort(),
      materiais: [...materiais].sort(),
    };
  }, [producao, frentesRows, equipRows, producaoV]);

  const inRange = (d?: string | null) => !!d && d >= dtIni && d <= dtFim;
  const matchTurno = (t?: string | null) => !fTurno || t === fTurno;
  const matchFrente = (f?: string | null) => !fFrente || f === fFrente;
  const matchEquip = (e?: string | null) => !fEquip || e === fEquip;
  const matchMat = (m?: string | null) => !fMaterial || m === fMaterial;

  const prodF = useMemo(
    () => producao.filter((r) => inRange(r.data_referencia) && matchTurno(r.turno)),
    [producao, dtIni, dtFim, fTurno],
  );
  const frentesF = useMemo(
    () =>
      frentesRows.filter(
        (r) => inRange(r.data_referencia) && matchTurno(r.turno) && matchFrente(r.frente),
      ),
    [frentesRows, dtIni, dtFim, fTurno, fFrente],
  );
  const equipF = useMemo(
    () =>
      equipRows.filter(
        (r) =>
          inRange(r.data_referencia) &&
          matchTurno(r.turno) &&
          matchEquip(r.equipamento) &&
          matchMat(r.tipo),
      ),
    [equipRows, dtIni, dtFim, fTurno, fEquip, fMaterial],
  );
  const viagensF = useMemo(
    () =>
      viagens.filter(
        (v) =>
          inRange(v.data_referencia) &&
          matchTurno(v.turno) &&
          matchEquip(v.equipamento) &&
          (matchFrente(v.frente_origem) || matchFrente(v.frente_destino)),
      ),
    [viagens, dtIni, dtFim, fTurno, fEquip, fFrente],
  );
  const ciclosF = useMemo(
    () =>
      ciclos.filter(
        (c) =>
          inRange(c.data_referencia) &&
          matchTurno(c.turno) &&
          matchEquip(c.equipamento) &&
          matchFrente(c.frente),
      ),
    [ciclos, dtIni, dtFim, fTurno, fEquip, fFrente],
  );
  const tempoDetF = useMemo(
    () =>
      tempoDet.filter(
        (t) => inRange(t.data_referencia) && matchTurno(t.turno) && matchEquip(t.equipamento),
      ),
    [tempoDet, dtIni, dtFim, fTurno, fEquip],
  );
  const tempoEstF = useMemo(
    () =>
      tempoEst.filter(
        (t) => inRange(t.data_referencia) && matchTurno(t.turno) && matchEquip(t.equipamento),
      ),
    [tempoEst, dtIni, dtFim, fTurno, fEquip],
  );
  const producaoVF = useMemo(
    () =>
      producaoV.filter(
        (p) =>
          inRange(p.data_referencia) &&
          matchTurno(p.turno) &&
          matchEquip(p.equipamento) &&
          matchFrente(p.frente),
      ),
    [producaoV, dtIni, dtFim, fTurno, fEquip, fFrente],
  );

  /* KPIs topo */
  const totalReal = prodF.reduce((s, r) => s + Number(r.toneladas_total || 0), 0);
  const metaDiaria =
    prodF.map((r) => Number(r.meta_diaria || 0)).find((v) => v > 0) ?? 0;
  const diasNoRange = Math.max(
    1,
    Math.round((new Date(dtFim).getTime() - new Date(dtIni).getTime()) / 86400000) + 1,
  );
  const totalPrevisto = metaDiaria > 0 ? metaDiaria * diasNoRange : 0;
  const variacao = totalReal - totalPrevisto;
  const acumuladoMes = prodF
    .filter((r) => (r.data_referencia || "").startsWith(hoje.slice(0, 7)))
    .reduce((s, r) => s + Number(r.toneladas_total || 0), 0);
  const metaMensal =
    prodF.map((r) => Number(r.meta_mensal || 0)).find((v) => v > 0) ?? 0;
  const faltaMeta = Math.max(0, metaMensal - acumuladoMes);

  /* Produção diária series */
  const dailySeries = useMemo(() => {
    const map = new Map<string, { real: number; prev: number }>();
    prodF.forEach((r) => {
      const k = r.data_referencia;
      const cur = map.get(k) ?? { real: 0, prev: 0 };
      cur.real += Number(r.toneladas_total || 0);
      cur.prev += Number(r.meta_diaria || 0);
      map.set(k, cur);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([k, v]) => ({ dia: dayLabel(k), Prevista: Math.round(v.prev), Real: Math.round(v.real) }));
  }, [prodF]);

  /* Produção por frente donut */
  const frenteAgg = useMemo(() => {
    const map = new Map<string, number>();
    frentesF.forEach((f) => {
      const k = String(f.frente || "—").toUpperCase();
      map.set(k, (map.get(k) ?? 0) + Number(f.toneladas || 0));
    });
    const arr = [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, r) => s + r.value, 0) || 1;
    return arr.map((r) => ({ ...r, pct: (r.value / total) * 100 }));
  }, [frentesF]);

  /* TOP 6 escavadeiras t/h */
  const topEscav = useMemo(() => {
    const map = new Map<string, { ton: number; horas: number }>();
    equipF.forEach((e) => {
      const k = e.equipamento;
      const cur = map.get(k) ?? { ton: 0, horas: 0 };
      cur.ton += Number(e.toneladas || 0);
      cur.horas += 8; // um turno por linha
      map.set(k, cur);
    });
    return [...map.entries()]
      .map(([equipamento, v]) => ({ equipamento, tph: v.horas ? v.ton / v.horas : 0 }))
      .filter((r) => r.tph > 0)
      .sort((a, b) => b.tph - a.tph)
      .slice(0, 6);
  }, [equipF]);

  /* Produtividade média t/h - linha */
  const prodSeries = useMemo(() => {
    const map = new Map<string, { ton: number; horas: number; meta: number; prev: number }>();
    prodF.forEach((r) => {
      const k = r.data_referencia;
      const cur = map.get(k) ?? { ton: 0, horas: 0, meta: 0, prev: 0 };
      cur.ton += Number(r.toneladas_total || 0);
      cur.horas += 24;
      cur.meta += Number(r.meta_diaria || 0) / 24;
      cur.prev += Number(r.projecao_turno || 0) / 8;
      map.set(k, cur);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([k, v]) => ({
        dia: dayLabel(k),
        Meta: Math.round(v.meta),
        Previsto: Math.round(v.prev),
        Real: v.horas ? Math.round(v.ton / v.horas) : 0,
      }));
  }, [prodF]);

  /* Viagens por hora */
  const viagensPorHora = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hora: String(h).padStart(2, "0"), Prev: 0, Real: 0 }));
    producaoVF.forEach((p) => {
      const h = Number(p.hora ?? -1);
      if (h >= 0 && h < 24) arr[h].Real += Number(p.cargas || 0);
    });
    viagensF.forEach(() => {});
    return arr;
  }, [producaoVF, viagensF]);

  /* Pequenos KPIs */
  const totalViagens = viagensF.reduce((s, v) => s + Number(v.viagens || 0), 0);
  const mediaViagens = viagensF.length ? totalViagens / viagensF.length : 0;
  const tphMedio =
    prodSeries.length > 0
      ? prodSeries.reduce((s, r) => s + r.Real, 0) / prodSeries.length
      : 0;
  const dfMedio = useMemo(() => {
    const arr = equipF.map((e) => Number(e.df || 0)).filter((v) => v > 0);
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  }, [equipF]);
  const utMedio = useMemo(() => {
    const arr = equipF.map((e) => Number(e.ut || 0)).filter((v) => v > 0);
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  }, [equipF]);

  /* Tempo parado por motivo */
  const tempoParado = useMemo(() => {
    const map = new Map<string, number>();
    tempoDetF.forEach((t) => {
      const k = t.sub_estado || t.categoria || "—";
      map.set(k, (map.get(k) ?? 0) + Number(t.minutos || 0));
    });
    return [...map.entries()]
      .map(([motivo, min]) => ({ motivo, min: Math.round(min) }))
      .sort((a, b) => b.min - a.min)
      .slice(0, 12);
  }, [tempoDetF]);

  /* Detalhamento produção (últimas linhas) */
  const detalhamento = useMemo(() => {
    return producaoVF
      .slice()
      .sort((a, b) => (b.data_referencia + (b.hora ?? 0)).localeCompare(a.data_referencia + (a.hora ?? 0)))
      .slice(0, 6)
      .map((p) => {
        const cargas = Number(p.cargas || 0);
        const ton = Number(p.toneladas || 0);
        const ciclo =
          ciclosF.find(
            (c) =>
              c.equipamento === p.equipamento && c.data_referencia === p.data_referencia,
          )?.ciclo_min ?? null;
        return {
          data: p.data_referencia,
          frente: p.frente,
          equipamento: p.equipamento,
          material: p.frota,
          ton,
          ciclo,
          tph: cargas > 0 ? ton / (cargas * 0.5) : 0,
        };
      });
  }, [producaoVF, ciclosF]);

  const acompViagens = useMemo(
    () =>
      viagensF.slice(0, 6).map((v) => ({
        data: v.data_referencia,
        caminhao: v.equipamento,
        frota: v.frota,
        carreg: Math.round(Number(v.viagens || 0)),
        basc: Math.round(Number(v.viagens || 0)),
        viagens: Math.round(Number(v.viagens || 0)),
        massa: Number(v.toneladas || 0),
      })),
    [viagensF],
  );

  /* Resumo tempos de ciclo */
  const resumoCiclo = useMemo(() => {
    const map = new Map<string, { soma: number; n: number }>();
    tempoEstF.forEach((t) => {
      const k = t.estado || "—";
      const cur = map.get(k) ?? { soma: 0, n: 0 };
      cur.soma += Number(t.minutos || 0);
      cur.n += 1;
      map.set(k, cur);
    });
    const arr = [...map.entries()]
      .map(([estado, v]) => ({ estado, media: v.n ? v.soma / v.n : 0 }))
      .filter((r) => r.media > 0)
      .sort((a, b) => b.media - a.media)
      .slice(0, 8);
    const total = arr.reduce((s, r) => s + r.media, 0);
    return { arr, total };
  }, [tempoEstF]);

  const limparFiltros = () => {
    setDtIni(inicioAno);
    setDtFim(hoje);
    setFTurno("");
    setFFrente("");
    setFEquip("");
    setFMaterial("");
  };

  const ultima = producao[0]?.atualizado_em
    ? new Date(producao[0].atualizado_em)
    : null;

  return (
    <div className="min-h-screen bg-[hsl(220_50%_5%)] text-foreground p-2 md:p-3 font-sans">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 items-stretch">
        <Panel className="col-span-12 lg:col-span-4 !p-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center justify-center w-14 h-14 rounded bg-mining-yellow text-black font-black text-lg leading-tight text-center">
              U&amp;M
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                DASHBOARD DE PRODUÇÃO
              </h1>
              <p className="text-[11px] font-mono tracking-widest text-mining-blue/80">
                U&amp;M MINERAÇÃO · Hexagon / JMineOps
              </p>
            </div>
          </div>
        </Panel>
        <Panel className="col-span-12 lg:col-span-8 !p-0">
          <div className="flex flex-wrap items-end gap-3 px-3 py-2">
            <FilterField label="Data Inicial" value={dtIni} onChange={setDtIni} type="date" />
            <FilterField label="Data Final" value={dtFim} onChange={setDtFim} type="date" />
            <FilterField label="Turno" value={fTurno} onChange={setFTurno} options={opts.turnos} />
            <FilterField label="Frente" value={fFrente} onChange={setFFrente} options={opts.frentes} />
            <FilterField
              label="Equipamento"
              value={fEquip}
              onChange={setFEquip}
              options={opts.equipamentos}
            />
            <FilterField label="Material" value={fMaterial} onChange={setFMaterial} options={opts.materiais} />
            <button
              onClick={limparFiltros}
              className="ml-auto flex items-center gap-1 border border-mining-blue/40 hover:bg-mining-blue/10 px-3 py-1.5 rounded text-[11px] font-bold text-mining-blue uppercase tracking-wider"
            >
              <Filter className="w-3 h-3" /> Limpar Filtros
            </button>
          </div>
        </Panel>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
        <Kpi icon={<Target />} label="Produção Prevista (t)" value={fmt(totalPrevisto)} color="text-mining-blue" />
        <Kpi icon={<BarChart3 />} label="Produção Real (t)" value={fmt(totalReal)} color="text-mining-blue" />
        <Kpi
          icon={<Gauge />}
          label="Variação (t)"
          value={fmt(variacao)}
          color={variacao < 0 ? "text-mining-yellow" : "text-mining-green"}
        />
        <Kpi icon={<Calendar />} label="Meta Diária (t)" value={fmt(metaDiaria)} color="text-mining-blue" />
        <Kpi icon={<TrendingUp />} label="Acumulado Mês (t)" value={fmt(acumuladoMes)} color="text-mining-blue" />
        <Kpi icon={<Flag />} label="Falta Para Meta (t)" value={fmt(faltaMeta)} color="text-mining-blue" />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-12 gap-2 mt-2">
        <Panel title="Produção Diária (t)" className="col-span-12 lg:col-span-5">
          {dailySeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="dia" stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Prevista" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Real" fill="#22c55e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Produção por Frente (t)" className="col-span-12 lg:col-span-4">
          {frenteAgg.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-56 flex items-center">
              <div className="w-2/3 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={frenteAgg}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={1}
                      stroke="none"
                      label={(e: { pct?: number }) => `${(e.pct ?? 0).toFixed(1)}%`}
                      labelLine={false}
                    >
                      {frenteAgg.map((_, i) => (
                        <Cell key={i} fill={FRENTE_COLORS[i % FRENTE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v) + " t"} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/3 space-y-1 text-[10px] font-mono">
                {frenteAgg.map((f, i) => (
                  <div key={f.name} className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 inline-block rounded-sm"
                      style={{ background: FRENTE_COLORS[i % FRENTE_COLORS.length] }}
                    />
                    <span className="truncate text-foreground">{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Top 6 Escavadeiras (t/h)" className="col-span-12 lg:col-span-3">
          {topEscav.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-1.5">
              {topEscav.map((e, i) => {
                const max = topEscav[0].tph || 1;
                const pct = (e.tph / max) * 100;
                return (
                  <div key={e.equipamento} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="w-4 text-mining-yellow font-bold text-center">{i + 1}</span>
                    <span className="w-14 text-foreground truncate">{e.equipamento}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                      <div className="h-full bg-mining-blue" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-mining-blue font-bold">{fmt(e.tph)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-12 gap-2 mt-2">
        <Panel title="Produtividade (t/h)" className="col-span-12 lg:col-span-5">
          {prodSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prodSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="dia" stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="Meta" stroke="#f59e0b" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Previsto" stroke="#38bdf8" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Real" stroke="#22c55e" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Viagens por Hora" className="col-span-12 lg:col-span-3">
          {viagensPorHora.every((v) => v.Real === 0) ? (
            <Empty />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viagensPorHora} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="hora" stroke="#7fb2d9" tick={{ fontSize: 8 }} interval={1} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Real" fill="#22d3ee" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <div className="col-span-12 lg:col-span-1 grid grid-rows-4 gap-2">
          <MiniKpi label="Produtividade Média" value={fmt(tphMedio)} unit="t/h" />
          <MiniKpi label="Viagens Médias" value={fmt(mediaViagens)} unit="viag/h" />
          <MiniKpi label="DF% Médio" value={dfMedio ? `${fmt(dfMedio, 1)}%` : "—"} />
          <MiniKpi label="UT% Médio" value={utMedio ? `${fmt(utMedio, 1)}%` : "—"} />
        </div>

        <Panel title="Tempo Parado por Motivo (min)" className="col-span-12 lg:col-span-3">
          {tempoParado.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-1">
              {tempoParado.map((t) => {
                const max = tempoParado[0].min || 1;
                const pct = (t.min / max) * 100;
                return (
                  <div key={t.motivo} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="w-24 text-foreground truncate" title={t.motivo}>{t.motivo}</span>
                    <div className="flex-1 h-2.5 bg-white/5 rounded overflow-hidden">
                      <div className="h-full bg-mining-blue" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-14 text-right text-mining-blue">{fmt(t.min)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-12 gap-2 mt-2">
        <Panel title="Detalhamento de Produção" className="col-span-12 lg:col-span-4">
          {detalhamento.length === 0 ? (
            <Empty />
          ) : (
            <table className="w-full text-[10px] font-mono">
              <thead className="text-mining-blue/70">
                <tr className="border-b border-mining-blue/20">
                  <Th>Data</Th><Th>Frente</Th><Th>Equipamento</Th><Th>Material</Th>
                  <Th className="text-right">Massa (t)</Th><Th className="text-right">Ciclo</Th><Th className="text-right">T/H</Th>
                </tr>
              </thead>
              <tbody>
                {detalhamento.map((d, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <Td>{brDate(d.data)}</Td>
                    <Td>{d.frente ?? "—"}</Td>
                    <Td>{d.equipamento ?? "—"}</Td>
                    <Td>{d.material ?? "—"}</Td>
                    <Td className="text-right text-mining-green">{fmt(d.ton, 2)}</Td>
                    <Td className="text-right">{d.ciclo ? fmt(d.ciclo, 1) : "—"}</Td>
                    <Td className="text-right text-mining-blue">{fmt(d.tph, 2)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Acompanhamento de Viagens" className="col-span-12 lg:col-span-4">
          {acompViagens.length === 0 ? (
            <Empty />
          ) : (
            <table className="w-full text-[10px] font-mono">
              <thead className="text-mining-blue/70">
                <tr className="border-b border-mining-blue/20">
                  <Th>Data</Th><Th>Caminhão</Th><Th>Frota</Th>
                  <Th className="text-right">Carreg.</Th><Th className="text-right">Basc.</Th>
                  <Th className="text-right">Viagens</Th><Th className="text-right">Massa (t)</Th>
                </tr>
              </thead>
              <tbody>
                {acompViagens.map((v, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <Td>{brDate(v.data)}</Td>
                    <Td>{v.caminhao ?? "—"}</Td>
                    <Td>{v.frota ?? "—"}</Td>
                    <Td className="text-right">{fmt(v.carreg)}</Td>
                    <Td className="text-right">{fmt(v.basc)}</Td>
                    <Td className="text-right text-mining-blue">{fmt(v.viagens)}</Td>
                    <Td className="text-right text-mining-green">{fmt(v.massa, 2)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Resumo de Tempos do Ciclo (min)" className="col-span-12 lg:col-span-4">
          {resumoCiclo.arr.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-1 text-[10px] font-mono">
              {resumoCiclo.arr.map((r) => (
                <div key={r.estado} className="flex justify-between border-b border-white/5 py-0.5">
                  <span className="text-foreground">{r.estado}</span>
                  <span className="text-mining-blue font-bold">{fmt(r.media, 2)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 mt-1 border-t border-mining-blue/40 text-mining-yellow font-bold">
                <span>TEMPO TOTAL DO CICLO</span>
                <span>{fmt(resumoCiclo.total, 2)}</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] font-mono text-mining-blue/70">
        <span>
          Fontes: custom_vw_ciclo_carga · custom_vw_registros_estados · custom_vw_producao · custom_vw_acompanhamento_viagens · custom_vw_tempo · custom_vw_tempo_ciclo · custom_vw_tempo_detalhado
        </span>
        <span>
          Atualizado em: {ultima ? ultima.toLocaleString("pt-BR") : "—"}
        </span>
      </div>
    </div>
  );
}

/* ---------- small components ---------- */
const tooltipStyle: React.CSSProperties = {
  background: "hsl(220 50% 6%)",
  border: "1px solid hsl(199 95% 60% / 0.4)",
  fontSize: 11,
  color: "hsl(210 40% 96%)",
};

function Kpi({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-[hsl(220_45%_9%/0.85)] border border-mining-blue/20 rounded-md px-3 py-2 flex items-center gap-3">
      <div className={`w-8 h-8 rounded flex items-center justify-center bg-mining-blue/10 ${color}`}>
        <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-mining-blue/70 font-bold truncate">{label}</p>
        <p className={`text-lg md:text-xl font-black leading-tight ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-[hsl(220_45%_9%/0.85)] border border-mining-blue/20 rounded-md p-2 flex flex-col justify-center">
      <p className="text-[8px] uppercase tracking-widest text-mining-blue/70 font-bold leading-tight">{label}</p>
      <p className="text-base font-black text-mining-blue leading-tight">{value}</p>
      {unit && <p className="text-[9px] font-mono text-muted-foreground">{unit}</p>}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-bold py-1 pr-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-1 pr-2 truncate ${className}`}>{children}</td>;
}
function Empty() {
  return <p className="text-[11px] text-muted-foreground font-mono py-8 text-center">Sem dados reais disponíveis</p>;
}