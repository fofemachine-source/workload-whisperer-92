import React from 'react';

interface MonthlyDashboardAutoProps {
  producaoMensalTotal?: number;
  viagensMensalTotal?: number;
}

export default function MonthlyDashboardAuto({
  producaoMensalTotal,
  viagensMensalTotal = 12450,
}: MonthlyDashboardAutoProps) {
  // 1. Identifica o mês e o ano atual automaticamente do sistema (ex: Mês 8 / 2026)
  const dataAtual = new Date();
  const mesAtualNumero = dataAtual.getMonth() + 1; // 1 a 12
  const anoAtual = dataAtual.getFullYear();

  // Nomes dos meses para exibição automática no cabeçalho dos cards
  const nomesMeses = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  const nomeMesAtual = nomesMeses[mesAtualNumero - 1];

  // 2. Base de dados ou valores recebidos via props
  const valorProducao = producaoMensalTotal ?? 1003138;

  return (
    <div className="bg-[#131b2e] border border-gray-800/80 rounded-xl p-4 shadow-lg relative overflow-hidden">
      
      {/* Cabeçalho dinâmico: vira a chave sozinho todo dia 1° */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs uppercase text-gray-400 font-semibold tracking-wider">
          PRODUÇÃO MENSAL ({nomeMesAtual})
        </span>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
          {nomeMesAtual.substring(0, 3)}/{anoAtual}
        </span>
      </div>

      {/* Valor Total do Mês Atual */}
      <div className="text-2xl font-black text-emerald-400 tracking-tight mt-2 font-mono tabular-nums">
        {valorProducao.toLocaleString('pt-BR')} <span className="text-sm font-normal text-gray-400">t</span>
      </div>
      
      <div className="text-[10px] text-gray-400 mt-1">
        Acumulado automático do mês vigente (Atualização autônoma)
      </div>

    </div>
  );
}
