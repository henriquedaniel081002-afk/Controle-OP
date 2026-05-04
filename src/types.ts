export type OPStatus = 'pendente_impressao' | 'impresso' | 'recolhido';

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
  status: OPStatus;
  chave_importacao?: string;
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
