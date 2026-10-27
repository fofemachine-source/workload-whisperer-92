import React, { memo } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

/* Paleta U&M (tema claro) */
export const UM = {
  bg: "#F5F4F4",
  card: "#FFFFFF",
  border: "#DADADA",
  text: "#2C2D2D",
  text2: "#575756",
  text3: "#7A7A79",
  green: "#19502F",
  goldText: "#B5872C",
  gold: "#E2A937",
  red: "#DC3545",
  prog: "#B2BFB4",
};

export const isNum = (v: any) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
export const fmtInt = (v: any) =>
  isNum(v) ? Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—";

/** Número animado: 0→valor na 1ª carga, valor anterior→novo nas atualizações. */
export const AnimNum = memo(function AnimNum({ value, suffix = "", decimals = 0 }: { value: any; suffix?: string; decimals?: number }) {
  const ok = isNum(value);
  const v = useAnimatedCounter(ok ? Number(value) : 0);
  if (!ok) return <>—</>;
  return (
    <>
      {v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
});

export function UMCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`rounded-[12px] border min-w-0 ${className}`}
      style={{ background: UM.card, borderColor: UM.border, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", ...style }}
    >
      {children}
    </motion.div>
  );
}

export function UMTitle({ children, color = UM.green, right }: { children: React.ReactNode; color?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <h3 className="text-[14px] font-bold uppercase tracking-[0.08em] whitespace-nowrap" style={{ color }}>{children}</h3>
      {right}
    </div>
  );
}

export function SectionSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1.5">
      <span className="text-[13px] font-bold uppercase tracking-[0.18em] whitespace-nowrap" style={{ color: UM.green }}>{label}</span>
      <span className="flex-1 h-px" style={{ background: UM.border }} />
    </div>
  );
}

/* ---------- Header ---------- */
export function UMHeader({ logo, info }: { logo: string; info: string }) {
  const [visao, setVisao] = React.useState<"contratual" | "rumo">("contratual");
  return (
    <UMCard className="px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <img src={logo} alt="U&M" style={{ height: 34 }} className="object-contain" />
        <span className="text-[20px] font-semibold tracking-[0.06em] whitespace-nowrap" style={{ color: UM.green }}>
          DASHBOARD OPERACIONAL · MINA
        </span>
        <span className="text-[14px] font-medium whitespace-nowrap" style={{ color: UM.text2 }}>{info}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-semibold tracking-[0.12em]" style={{ color: UM.text2 }}>META</span>
        <div className="flex rounded-[10px] border p-0.5" style={{ borderColor: UM.border, background: UM.bg }}>
          {([
            ["contratual", "Visão Contratual"],
            ["rumo", "Visão Projeto Rumo"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setVisao(k)}
              className="px-4 py-1.5 rounded-[8px] text-[14px] font-semibold transition-colors"
              style={visao === k ? { background: UM.green, color: "#FFFFFF" } : { color: UM.text }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </UMCard>
  );
}

/* ---------- Card Lavra / Retaludamento ---------- */
function Row({ label, value, color, small }: { label: string; value: React.ReactNode; color?: string; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
      <span className="text-[11.5px] font-semibold uppercase" style={{ color: UM.green }}>{label}</span>
      <span className={`${small ? "text-[13px]" : "text-[19px]"} font-bold tabular-nums`} style={{ color: color ?? UM.text }}>{value}</span>
    </div>
  );
}

function SubBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border px-2.5 py-1.5 flex flex-col gap-0.5 min-w-0" style={{ background: UM.bg, borderColor: UM.border }}>
      <span className="text-[11.5px] font-bold uppercase tracking-[0.08em]" style={{ color: UM.goldText }}>{title}</span>
      {children}
    </div>
  );
}

const T = ({ v }: { v: any }) => (isNum(v) ? <><AnimNum value={v} /> t</> : <>—</>);
const TH = ({ v }: { v: any }) => (isNum(v) ? <><AnimNum value={v} /> t/h</> : <>—</>);

export function ContratoCard({ tipo, data, mensal }: { tipo: "LAV" | "RET"; data?: any; mensal?: any }) {
  const isLav = tipo === "LAV";
  const cor = isLav ? UM.green : UM.goldText;
  const d = data ?? {};
  const ritmoAbaixo = isNum(d.ritmo) && isNum(d.meta) && Number(d.ritmo) < Number(d.meta);
  const dif = d.diferencaProjetada;
  const difPos = isNum(dif) && Number(dif) >= 0;
  return (
    <UMCard className="overflow-hidden flex flex-col" style={{ borderTop: `4px solid ${isLav ? UM.green : UM.gold}` }}>
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b" style={{ borderColor: UM.border }}>
        <span className="text-[17px] font-bold tracking-[0.06em]" style={{ color: cor }}>{isLav ? "LAVRA" : "RETALUDAMENTO"}</span>
        <span className="text-[12px] font-semibold" style={{ color: UM.text }}>
          {isLav ? "Contrato Lavra · rodoviário" : "Contrato Retaludamento · rodoviário + convencional"}
        </span>
      </div>
      <div className="flex-1 grid grid-cols-[28%_1fr] gap-2 p-2.5">
        <div className="flex flex-col justify-center border-r pr-2 min-w-0" style={{ borderColor: UM.border }}>
          <span className="text-[12px] font-bold uppercase" style={{ color: cor }}>Realizado no turno</span>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-[66px] font-bold tabular-nums tracking-tight" style={{ color: UM.text }}>
              <AnimNum value={d.producaoTurno} />
            </span>
            <span className="text-[20px] font-bold" style={{ color: cor }}>t</span>
          </div>
          <span className="text-[20px] font-semibold mt-1" style={{ color: cor }}>
            {fmtInt(d.viagensTurno)} viagens
          </span>
          {!isLav && (
            <div className="mt-1.5 text-[12px] leading-tight" style={{ color: UM.text }}>
              <div>Rodoviário <b>{isNum(d.producaoTurno) ? `${fmtInt(d.producaoTurno)} t` : "—"}</b></div>
              <div>Convencional <b>—</b></div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 min-w-0">
          <SubBox title="Turno">
            <Row label="Programado do turno" value={<T v={d.previstoTurno} />} />
            <Row label="Programado até agora" value={<T v={d.previstoAteAgora} />} />
            <Row label="Projeção do turno" value={<T v={d.projecao} />} />
          </SubBox>
          <SubBox title="Dia">
            <Row label="Programado do dia" value={<T v={d.projetadoDia} />} />
            <Row label="Realizado do dia" value={<T v={d.acumuladoDia} />} />
            <Row label="Projeção do dia" value={<T v={d.dia?.projecao} />} />
          </SubBox>
          <SubBox title="Ritmo (t/h)">
            <Row label="Ritmo atual" value={<TH v={d.ritmo} />} color={ritmoAbaixo ? UM.red : UM.text} />
            <Row label="Meta do turno" value={<TH v={d.meta} />} />
            <Row label="Necessário no turno" value={<TH v={d.precisa} />} />
          </SubBox>
          <SubBox title="Mês">
            <Row label="Realizado no mês" value={<T v={mensal} />} />
            <Row label="Projeção do mês" value="—" />
            <Row label="Necessário por dia" value="—" />
          </SubBox>
        </div>
      </div>
      <div className="flex items-center justify-center gap-10 py-1.5 text-[17px] font-bold whitespace-nowrap" style={{ background: UM.red, color: "#FFFFFF" }}>
        <span>ADERÊNCIA {isNum(d.aderencia) ? `${d.aderencia}%` : "—"}</span>
        <span>
          DIF. PROJETADA NO TURNO {isNum(dif) ? (difPos ? "▲" : "▼") : ""}{" "}
          {isNum(dif) ? <><AnimNum value={dif} /> t</> : "—"}
        </span>
      </div>
    </UMCard>
  );
}

/* ---------- Gráficos diários ---------- */
const kLabel = (v: any) => (isNum(v) && Number(v) > 0 ? `${Math.round(Number(v) / 1000)}k` : "");

export function DailyContratoChart({ title, data, realColor, titleColor }: { title: string; data: any[]; realColor: string; titleColor: string }) {
  return (
    <UMCard className="p-3 flex flex-col h-[200px]">
      <UMTitle
        color={titleColor}
        right={
          <div className="flex items-center gap-3 text-[12px] font-semibold" style={{ color: UM.text }}>
            <span className="flex items-center gap-1"><span className="w-3 h-3" style={{ background: UM.prog }} />Programada</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3" style={{ background: realColor }} />Real</span>
          </div>
        }
      >
        {title}
      </UMTitle>
      <div className="flex-1 min-h-0">
        {data.length === 0 ? (
          <p className="text-[12px] text-center pt-10" style={{ color: UM.text3 }}>Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 18, right: 4, left: 4, bottom: 0 }} barGap={2}>
              <XAxis dataKey="dia" tick={{ fontSize: 12, fill: UM.text, fontWeight: 600, fontFamily: "Montserrat" }} axisLine={{ stroke: UM.border }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#fff", border: `1px solid ${UM.border}`, borderRadius: 8, fontFamily: "Montserrat", fontSize: 12 }}
                formatter={(v: any) => `${fmtInt(v)} t`}
              />
              <Bar dataKey="Programada" fill={UM.prog} radius={[2, 2, 0, 0]} animationDuration={900}>
                <LabelList dataKey="Programada" position="top" formatter={kLabel} style={{ fontSize: 11, fill: UM.text2, fontWeight: 600, fontFamily: "Montserrat" }} />
              </Bar>
              <Bar dataKey="Real" fill={realColor} radius={[2, 2, 0, 0]} animationDuration={900}>
                <LabelList dataKey="Real" position="top" formatter={kLabel} style={{ fontSize: 11, fill: UM.text, fontWeight: 700, fontFamily: "Montserrat" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </UMCard>
  );
}

const frenteCor = (n: string, i: number) => {
  const u = String(n).toUpperCase();
  if (u === "RET") return UM.gold;
  if (u === "LAV") return UM.green;
  return ["#5E8A6E", "#C9B37A", "#7A7A79", "#8FA898"][i % 4];
};

export function FrenteDonut({ data }: { data: Array<{ name: string; value: number; pct: number }> }) {
  const total = data.reduce((s, r) => s + r.value, 0);
  return (
    <UMCard className="p-3 flex flex-col h-[200px]">
      <UMTitle>Produção por frente (t) · dia</UMTitle>
      {data.length === 0 ? (
        <p className="text-[12px] text-center pt-10" style={{ color: UM.text3 }}>Sem dados</p>
      ) : (
        <div className="flex-1 min-h-0 flex items-center gap-4">
          <div className="w-[48%] h-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  className="animate-[spin_20s_linear_infinite] origin-center"
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="66%"
                  outerRadius="96%"
                  paddingAngle={1}
                  stroke="#fff"
                  strokeWidth={2}
                  animationDuration={900}
                >
                  {data.map((f, i) => <Cell key={i} fill={frenteCor(f.name, i)} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold tracking-[0.2em]" style={{ color: UM.text2 }}>TOTAL</span>
              <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: UM.green }}><AnimNum value={total} /></span>
              <span className="text-[11px]" style={{ color: UM.text2 }}>t</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center divide-y min-w-0" style={{ borderColor: UM.border }}>
            {data.map((f, i) => {
              const c = frenteCor(f.name, i);
              return (
                <div key={f.name} className="flex items-center gap-2 py-2 whitespace-nowrap">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: c }} />
                  <span className="flex-1 text-[18px] font-bold" style={{ color: UM.text }}>{f.name}</span>
                  <span className="text-[18px] font-bold tabular-nums" style={{ color: c === UM.gold ? UM.goldText : c }}>{f.pct.toFixed(1).replace(".", ",")}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </UMCard>
  );
}

/* ---------- Tabelas de frentes ---------- */
const Dif = ({ v, bold }: { v: any; bold?: boolean }) => {
  if (!isNum(v)) return <span style={{ color: UM.text3 }}>—</span>;
  const pos = Number(v) >= 0;
  return (
    <span className={bold ? "font-bold" : "font-semibold"} style={{ color: pos ? UM.green : UM.red }}>
      {pos ? "▲" : "▼"} {fmtInt(v)} t
    </span>
  );
};
const tOrDash = (v: any) => (isNum(v) ? `${fmtInt(v)} t` : "—");

export function FrentesTable({ tipo, rows, card }: { tipo: "LAV" | "RET"; rows: any[]; card?: any }) {
  const isLav = tipo === "LAV";
  const cor = isLav ? UM.green : UM.goldText;
  const c = card ?? {};
  const th = "py-1 px-1.5 text-[11px] font-semibold whitespace-nowrap";
  const td = "py-1 px-1.5 text-[13px] whitespace-nowrap tabular-nums";
  return (
    <UMCard className="p-3">
      <UMTitle
        color={cor}
        right={
          <div className="flex items-center gap-3 text-[12px] font-semibold whitespace-nowrap" style={{ color: UM.text }}>
            <span><span style={{ color: UM.green }}>▲</span> acima do programado</span>
            <span><span style={{ color: UM.red }}>▼</span> gap</span>
          </div>
        }
      >
        Frentes · {isLav ? "Lavra" : "Retaludamento"} · diferença projetada
      </UMTitle>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left" style={{ borderColor: UM.border, color: UM.text2 }}>
            <th className={th}>Escavadeira</th>
            <th className={th}>Frente</th>
            <th className={th}>Material</th>
            <th className={`${th} text-right`}>Viagens</th>
            <th className={`${th} text-right`}>Realizado</th>
            <th className={`${th} text-right`}>Projeção</th>
            <th className={`${th} text-right`}>Programado</th>
            <th className={`${th} text-right`}>Dif. projetada</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-2 text-center text-[12px]" style={{ color: UM.text3 }}>Nenhuma escavadeira produzindo</td></tr>
          )}
          {rows.map((r, i) => (
            <motion.tr
              key={`${r.equipamento}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="border-b"
              style={{ borderColor: UM.border, color: UM.text }}
            >
              <td className={`${td} font-bold`} style={{ color: cor }}>{r.equipamento}</td>
              <td className={`${td} text-[12px]`} style={{ color: UM.text2 }}>{r.frente ?? "—"}</td>
              <td className={td}>{r.material ?? "—"}</td>
              <td className={`${td} text-right font-semibold`}>{fmtInt(r.totalViagens)}</td>
              <td className={`${td} text-right font-semibold`}>{tOrDash(r.totalMassa)}</td>
              <td className={`${td} text-right font-semibold`}>{tOrDash(r.projecaoTurno)}</td>
              <td className={`${td} text-right`}>{tOrDash(r.programadoFrente)}</td>
              <td className={`${td} text-right`}><Dif v={r.diferencaProjetada} /></td>
            </motion.tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: UM.bg, color: cor }}>
            <td colSpan={3} className={`${td} font-bold uppercase`}>Total {isLav ? "Lavra" : "Retaludamento"}</td>
            <td className={`${td} text-right font-bold`} style={{ color: UM.text }}>{fmtInt(c.viagensTurno)}</td>
            <td className={`${td} text-right font-bold`} style={{ color: UM.text }}>{tOrDash(c.producaoTurno)}</td>
            <td className={`${td} text-right font-bold`} style={{ color: UM.text }}>{tOrDash(c.projecao)}</td>
            <td className={`${td} text-right font-bold`} style={{ color: UM.text }}>{tOrDash(c.previstoTurno)}</td>
            <td className={`${td} text-right`}><Dif v={c.diferencaProjetada} bold /></td>
          </tr>
        </tfoot>
      </table>
    </UMCard>
  );
}
