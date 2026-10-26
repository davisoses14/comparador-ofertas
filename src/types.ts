export interface UploadedProposalFile {
  name: string;
  size: number;
  dataBase64: string;
  aseguradora?: string;
}

export interface ClientProfile {
  nombre: string;
  vehiculoUso: string;
  presupuestoMaximo: number;
  coberturasObligatorias: string[];
  prioridades: string;
  formaPago: string;
}

export interface AseguradoraResultado {
  nombre: string;
  archivoOrigen?: string;
  primaAnual: string;
  primaAnualMonto?: number;
  cabeEnPresupuesto: boolean;
  cabeEnPresupuestoTexto: string;
  deducibleColision: string;
  deducibleRobo: string;
  rcDanosTerceros: string;
  rcLesiones: string;
  asistenciaVial247: string;
  grua: string;
  vehiculoSustituto: string;
  fenomenosNaturales: string;
  roturaCristales: string;
  exclusionesDestacadas: string;
  cumpleObligatorias: boolean;
  cumpleObligatoriasTexto: string;
  semaforo: 'verde' | 'amarillo' | 'rojo' | string;
  motivoSemaforo?: string;
}

export interface ComparisonResponse {
  aseguradoras: AseguradoraResultado[];
  recomendacionPreliminar: string;
  mensajeWhatsApp: string;
}

export interface SessionUser {
  id: string;
  usuario: string;
  nombreCompleto: string;
  rol: 'administrador' | 'asesor';
  estado: 'activo' | 'suspendido';
  debeCambiarClave: boolean;
  fechaCreacion: string;
  ultimoAcceso: string | null;
}

