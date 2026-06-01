export type OPStatus = 'pendente_impressao' | 'impresso' | 'recolhido';
export type MarcacaoFiltro = 'todos' | 'pendentes' | 'marcados';

export interface OPRecord {
  id: number;
  op: string;
  data_programada: string | null;
  codigo_produto: string;
  potencia: string;
  linha: string;
  cliente: string;
  qtde: number;
  setor: string;
  status: OPStatus | null;
  chave_importacao?: string;

  serie_inicial: number | null;
  serie_final: number | null;
  serie: string | null;

  marcado: boolean | null;
  data_marcacao: string | null;
  usuario_marcacao: string | null;

  data_impressao: string | null;
  usuario_impressao: string | null;
  data_recolhimento: string | null;
  usuario_recolhimento: string | null;
}

export interface OPFilters {
  op?: string;
  cliente?: string;
  linha?: string;
  setor?: string;
  status?: OPStatus | '';
  dataInicial?: string;
  dataFinal?: string;
}
