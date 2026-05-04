import React from 'react';
import { FileText, Printer, CheckCircle, Package } from 'lucide-react';

interface CardsProps {
  total: number;
  pendentes: number;
  impressas: number;
  recolhidas: number;
}

export default function Cards({ total, pendentes, impressas, recolhidas }: CardsProps) {
  const percImpressas = total > 0 ? ((impressas / total) * 100).toFixed(1) : '0.0';
  const percRecolhidas = total > 0 ? ((recolhidas / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
      <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col justify-between">
        <span className="text-[10px] text-slate-400 uppercase">Total OPs</span>
        <div className="text-2xl font-mono font-bold text-white mt-2">{total}</div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex flex-col justify-between">
        <span className="text-[10px] text-amber-400 uppercase">Pendentes</span>
        <div className="text-2xl font-mono font-bold text-amber-500 mt-2">{pendentes}</div>
      </div>
      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex flex-col justify-between">
        <span className="text-[10px] text-blue-400 uppercase">Impressas</span>
        <div className="text-2xl font-mono font-bold text-blue-400 mt-2">{impressas}</div>
      </div>
      <div className="bg-[#00EE76]/10 border border-[#00EE76]/20 p-4 rounded-lg flex flex-col justify-between">
        <span className="text-[10px] text-[#00EE76] uppercase">Recolhidas</span>
        <div className="text-2xl font-mono font-bold text-[#00EE76] mt-2">{recolhidas}</div>
      </div>
      <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col justify-between">
        <span className="text-[10px] text-slate-400 uppercase">% Impressas</span>
        <div className="text-2xl font-mono font-bold mt-2">{percImpressas}%</div>
        <div className="w-full h-1 bg-white/10 mt-2 rounded-full">
          <div className="h-1 bg-blue-400 rounded-full" style={{ width: `${percImpressas}%` }}></div>
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col justify-between">
        <span className="text-[10px] text-slate-400 uppercase">% Recolhidas</span>
        <div className="text-2xl font-mono font-bold mt-2">{percRecolhidas}%</div>
        <div className="w-full h-1 bg-white/10 mt-2 rounded-full">
          <div className="h-1 bg-[#00EE76] rounded-full" style={{ width: `${percRecolhidas}%` }}></div>
        </div>
      </div>
    </div>
  );
}
