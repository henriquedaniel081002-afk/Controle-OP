import React from 'react';
import { OPFilters } from '../types';
import { X } from 'lucide-react';

interface FiltersProps {
  filters: OPFilters;
  onChange: (filters: OPFilters) => void;
  onClose: () => void;
}

export default function Filters({ filters, onChange, onClose }: FiltersProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-100 uppercase tracking-wide">Filtros Avançados</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">OP</label>
            <input 
              name="op" 
              value={filters.op || ''} 
              onChange={handleChange}
              className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#00EE76] transition-all"
              placeholder="Ex: OP-12345"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Data inicial</label>
              <input
                type="date"
                name="dataInicial"
                value={filters.dataInicial || ''}
                onChange={handleChange}
                className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#00EE76] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Data final</label>
              <input
                type="date"
                name="dataFinal"
                value={filters.dataFinal || ''}
                onChange={handleChange}
                className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#00EE76] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Cliente</label>
            <input 
              name="cliente" 
              value={filters.cliente || ''} 
              onChange={handleChange}
              className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#00EE76] transition-all"
              placeholder="Ex: Indústria XYZ"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Linha</label>
              <input 
                name="linha" 
                value={filters.linha || ''} 
                onChange={handleChange}
                className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#00EE76] transition-all"
                placeholder="Ex: L1"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Setor</label>
              <input 
                name="setor" 
                value={filters.setor || ''} 
                onChange={handleChange}
                className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#00EE76] transition-all"
                placeholder="Ex: Setor A"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Status</label>
            <select 
              name="status" 
              value={filters.status || ''} 
              onChange={handleChange}
              className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#00EE76] transition-all appearance-none"
            >
              <option value="">Todos</option>
              <option value="pendente_impressao">Pendente Impressão</option>
              <option value="impresso">Impresso</option>
              <option value="recolhido">Recolhido</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button 
            onClick={() => onChange({})}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
          >
            Limpar
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold bg-[#00EE76] hover:bg-[#00EE76]/90 text-black rounded transition-all"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}
