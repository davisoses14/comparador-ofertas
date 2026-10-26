/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  FileText,
  Upload,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Car,
  DollarSign,
  User,
  Send,
  Info,
  Clock,
  AlertOctagon,
  FileCheck,
  ExternalLink,
  LogOut,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import {
  UploadedProposalFile,
  ClientProfile,
  ComparisonResponse,
  AseguradoraResultado,
  SessionUser,
} from './types';

const COBERTURAS_OPCIONES = [
  { id: 'colision', label: 'Colisión y vuelco', desc: 'Daños propios por choque o vuelco' },
  { id: 'robo', label: 'Robo (total y/o parcial)', desc: 'Sustracción total o piezas' },
  { id: 'asistencia', label: 'Asistencia vial 24/7', desc: 'Auxilio en carretera todo el año' },
  { id: 'fenomenos', label: 'Fenómenos naturales', desc: 'Inundación, caída de árboles, sismo' },
  { id: 'sustituto', label: 'Vehículo sustituto', desc: 'Carro temporal durante reparación' },
];

export default function App() {
  // --- AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Login form state
  const [loginUsuario, setLoginUsuario] = useState('');
  const [loginContrasena, setLoginContrasena] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Change password state (for mandatory or manual update)
  const [claveNueva, setClaveNueva] = useState('');
  const [claveConfirmar, setClaveConfirmar] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [cambioClaveError, setCambioClaveError] = useState<string | null>(null);
  const [cambioClaveSuccess, setCambioClaveSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showOptionalPasswordModal, setShowOptionalPasswordModal] = useState(false);

  // --- COMPARATOR STATE ---
  // 1. Files state (1 to 3 PDF files)
  const [files, setFiles] = useState<UploadedProposalFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Client Profile state
  const [profile, setProfile] = useState<ClientProfile>({
    nombre: '',
    vehiculoUso: '',
    presupuestoMaximo: 400000,
    coberturasObligatorias: ['colision', 'robo', 'asistencia'],
    prioridades: 'Priorizar deducibles accesibles y buena cobertura de asistencia vial. Presupuesto ajustado pero con flexibilidad si la protección lo amerita.',
    formaPago: 'Anual de contado',
  });

  // 3. Comparison & UI states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResponse | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const resultSectionRef = useRef<HTMLDivElement>(null);

  // Check existing session on startup
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setIsCheckingAuth(true);
    try {
      const res = await fetch('/api/yo');
      if (res.ok) {
        const data = await res.json();
        if (data.usuario) {
          setCurrentUser(data.usuario);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: loginUsuario.trim().toLowerCase(),
          contrasena: loginContrasena,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'usuario o contraseña incorrectos');
      }

      if (data.usuario) {
        setCurrentUser(data.usuario);
        setLoginUsuario('');
        setLoginContrasena('');
      }
    } catch (err: any) {
      setLoginError(err.message || 'usuario o contraseña incorrectos');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error('Error logging out:', err);
    } finally {
      setCurrentUser(null);
      setComparisonResult(null);
      setFiles([]);
      setClaveNueva('');
      setClaveConfirmar('');
      setCambioClaveError(null);
      setCambioClaveSuccess(null);
      setShowOptionalPasswordModal(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCambioClaveError(null);
    setCambioClaveSuccess(null);

    if (claveNueva.length < 8) {
      setCambioClaveError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!/\d/.test(claveNueva)) {
      setCambioClaveError('La nueva contraseña debe contener al menos un número.');
      return;
    }

    if (claveNueva !== claveConfirmar) {
      setCambioClaveError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/cambiar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claveNueva: claveNueva,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar la contraseña');
      }

      if (data.usuario) {
        setCurrentUser(data.usuario);
      } else if (currentUser) {
        setCurrentUser({ ...currentUser, debeCambiarClave: false });
      }

      setCambioClaveSuccess('Contraseña actualizada correctamente.');
      setClaveNueva('');
      setClaveConfirmar('');
      setTimeout(() => {
        setShowOptionalPasswordModal(false);
        setCambioClaveSuccess(null);
      }, 1500);
    } catch (err: any) {
      setCambioClaveError(err.message || 'No se pudo actualizar la contraseña');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Helper to read File as Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Handle uploaded files
  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setFileError(null);

    const pdfFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        pdfFiles.push(f);
      } else {
        setFileError(`El archivo "${f.name}" no es un PDF válido. Por favor suba únicamente archivos PDF.`);
      }
    }

    if (files.length + pdfFiles.length > 3) {
      setFileError('Solo puede cargar de 1 a 3 propuestas para comparar simultáneamente.');
      return;
    }

    try {
      const newEntries: UploadedProposalFile[] = [];
      for (const f of pdfFiles) {
        // Prevent duplicate names
        if (files.some((existing) => existing.name === f.name)) continue;
        const b64 = await readFileAsBase64(f);
        newEntries.push({
          name: f.name,
          size: f.size,
          dataBase64: b64,
        });
      }

      setFiles((prev) => [...prev, ...newEntries]);
    } catch (err: any) {
      setFileError('Error al leer los archivos: ' + err.message);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  // Quick load 3 sample proposals from Costa Rica
  const handleLoadSamples = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const res = await fetch('/api/sample-proposals');
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (!res.ok) throw new Error('No se pudieron obtener las propuestas de ejemplo.');
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
        if (data.defaultProfile) {
          setProfile(data.defaultProfile);
        }
      }
    } catch (err: any) {
      setApiError('Error al cargar ejemplos: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle mandatory coverage checkbox
  const handleToggleCoverage = (id: string) => {
    setProfile((prev) => {
      const exists = prev.coberturasObligatorias.includes(id);
      return {
        ...prev,
        coberturasObligatorias: exists
          ? prev.coberturasObligatorias.filter((item) => item !== id)
          : [...prev.coberturasObligatorias, id],
      };
    });
  };

  // Submit to compare
  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setFileError('Por favor cargue al menos 1 archivo PDF de propuesta.');
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setLoadingStep(0);

    const timer1 = setTimeout(() => setLoadingStep(1), 1500);
    const timer2 = setTimeout(() => setLoadingStep(2), 3200);
    const timer3 = setTimeout(() => setLoadingStep(3), 5000);

    try {
      const payload = {
        files: files.map((f) => ({
          name: f.name,
          dataBase64: f.dataBase64,
        })),
        perfil: profile,
      };

      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Error del servidor (${response.status})`);
      }

      const result: ComparisonResponse = await response.json();
      setComparisonResult(result);

      // Smooth scroll to results
      setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err: any) {
      setApiError(err.message || 'Error al comunicarse con Gemini para comparar las propuestas.');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsLoading(false);
    }
  };

  // Copy WhatsApp message
  const handleCopyMessage = () => {
    if (!comparisonResult?.mensajeWhatsApp) return;
    navigator.clipboard.writeText(comparisonResult.mensajeWhatsApp);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  // Reset comparison
  const handleNewComparison = () => {
    setComparisonResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper for formatting file size
  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1000) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Render semaphore badge
  const renderSemaforo = (semaforo: string, motivo?: string) => {
    const s = (semaforo || '').toLowerCase();
    if (s.includes('verde') || s === 'green') {
      return (
        <div className="flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Semáforo Verde
          </span>
          <span className="text-[11px] text-emerald-700 mt-1 font-medium text-center">
            {motivo || 'Cabe en presupuesto y cumple coberturas'}
          </span>
        </div>
      );
    } else if (s.includes('amarillo') || s === 'yellow') {
      return (
        <div className="flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            Semáforo Amarillo
          </span>
          <span className="text-[11px] text-amber-700 mt-1 font-medium text-center">
            {motivo || 'Cumple coberturas pero excede presupuesto'}
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            Semáforo Rojo
          </span>
          <span className="text-[11px] text-rose-700 mt-1 font-medium text-center">
            {motivo || 'No cumple coberturas obligatorias'}
          </span>
        </div>
      );
    }
  };

  // --- 1. SPINNER WHILE CHECKING AUTH ---
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-[#0B2545] text-sky-300 flex items-center justify-center shadow-lg mb-4">
          <Shield className="w-8 h-8 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Verificando sesión segura...</p>
        <p className="text-xs text-slate-400 mt-1">EDK Corredora de Seguros</p>
      </div>
    );
  }

  // --- 2. LOGIN SCREEN (Reglas 1, 6) ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0B2545] flex flex-col justify-between text-slate-100">
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-slate-800 border border-slate-100">
            {/* Header / Brand */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0B2545] to-[#134074] text-white flex items-center justify-center mx-auto mb-3 shadow-md border border-sky-400/20">
                <Shield className="w-8 h-8 text-sky-300" />
              </div>
              <h1 className="text-xl font-black text-[#0B2545] tracking-tight">
                Comparador de Propuestas EDK
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                EDK Corredora de Seguros · Acceso de Asesores
              </p>
            </div>

            {/* Error Message Display */}
            {loginError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 shadow-sm animate-in fade-in">
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs sm:text-sm font-semibold">
                  {loginError}
                </div>
              </div>
            )}

            {/* Formulario de Login */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Usuario
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="ej. admin"
                  value={loginUsuario}
                  onChange={(e) => setLoginUsuario(e.target.value)}
                  className="w-full text-sm px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] focus:border-transparent transition bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={loginContrasena}
                    onChange={(e) => setLoginContrasena(e.target.value)}
                    className="w-full text-sm px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] focus:border-transparent transition bg-slate-50/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                    title={showLoginPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || !loginUsuario || !loginContrasena}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#0B2545] via-[#134074] to-[#1D4E89] hover:shadow-lg hover:shadow-sky-900/20 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-200" />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <span>Entrar</span>
                )}
              </button>
            </form>

            {/* Aviso confidencial */}
            <div className="mt-8 pt-5 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Sistema exclusivo para asesores y personal autorizado. Las cuentas son creadas por la administración.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-sky-300/60 border-t border-sky-900/40">
          EDK Corredora de Seguros · San José, Costa Rica
        </footer>
      </div>
    );
  }

  // --- 3. PANTALLA OBLIGATORIA DE CAMBIO DE CLAVE (Regla 7) ---
  if (currentUser.debeCambiarClave) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between text-slate-800">
        <header className="bg-[#0B2545] text-white py-4 px-6 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-sky-300" />
            <span className="font-bold text-sm">EDK Corredora de Seguros</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-sky-200 font-medium">
              Conectado como: <strong>{currentUser.nombreCompleto}</strong> ({currentUser.usuario})
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <KeyRound className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-black text-slate-900 text-center">
              Cambio de contraseña requerido
            </h2>
            <p className="text-xs text-slate-500 text-center mt-1 mb-6">
              Por motivos de seguridad, debe actualizar su contraseña temporal antes de acceder al comparador.
            </p>

            {cambioClaveError && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{cambioClaveError}</span>
              </div>
            )}

            {cambioClaveSuccess && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cambioClaveSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva contraseña (mínimo 8 caracteres y un número)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={claveNueva}
                    onChange={(e) => setClaveNueva(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar nueva contraseña
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repita la nueva contraseña"
                  value={claveConfirmar}
                  onChange={(e) => setClaveConfirmar(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] transition"
                />
              </div>

              {/* Checklist */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      claveNueva.length >= 8 ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span className={claveNueva.length >= 8 ? 'font-semibold text-emerald-700' : ''}>
                    Al menos 8 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      /\d/.test(claveNueva) ? 'text-emerald-600' : 'text-slate-300'
                    }`}
                  />
                  <span className={/\d/.test(claveNueva) ? 'font-semibold text-emerald-700' : ''}>
                    Al menos un número
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      claveNueva && claveNueva === claveConfirmar
                        ? 'text-emerald-600'
                        : 'text-slate-300'
                    }`}
                  />
                  <span
                    className={
                      claveNueva && claveNueva === claveConfirmar
                        ? 'font-semibold text-emerald-700'
                        : ''
                    }
                  >
                    Las contraseñas coinciden
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    isChangingPassword ||
                    claveNueva.length < 8 ||
                    !/\d/.test(claveNueva) ||
                    claveNueva !== claveConfirmar
                  }
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#0B2545] hover:bg-[#134074] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-200" />
                      <span>Actualizando...</span>
                    </>
                  ) : (
                    <span>Guardar contraseña y entrar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200">
          EDK Corredora de Seguros · San José, Costa Rica
        </footer>
      </div>
    );
  }

  // --- 4. APLICACIÓN PRINCIPAL (Regla 8: Botón Cerrar sesión visible en todas las pantallas junto al nombre) ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-between">
      {/* Header Institucional con Información del Usuario y Botón Cerrar Sesión */}
      <header className="bg-[#0B2545] text-white border-b border-[#13315C] shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Title & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#134074] to-[#0A1D37] flex items-center justify-center border border-sky-400/30 shadow-inner">
                <Shield className="w-6 h-6 text-sky-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-white font-sans">
                    Comparador de Propuestas EDK
                  </h1>
                  <span className="bg-sky-500/20 text-sky-200 border border-sky-400/30 text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">
                    Costa Rica
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 font-normal">
                  Compara propuestas de seguro de automóvil en minutos. La IA prepara, el asesor decide.
                </p>
              </div>
            </div>

            {/* User Session Bar & Actions */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Quick demo loader */}
              <button
                type="button"
                onClick={handleLoadSamples}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#134074] hover:bg-[#1D4E89] text-sky-100 px-3 py-1.5 rounded-lg border border-sky-300/20 shadow-sm transition hover:border-sky-300/40 disabled:opacity-50"
                title="Cargar 3 cotizaciones reales de ejemplo (Cordillera, Alborada, Protectora del Valle)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Ejemplos (3 aseguradoras)</span>
              </button>

              {/* User badge */}
              <div className="inline-flex items-center gap-2 bg-[#0A1D37]/80 px-3 py-1.5 rounded-xl border border-sky-400/20 text-xs">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-[10px]">
                  {currentUser.usuario.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="font-bold text-white text-xs leading-none">
                    {currentUser.nombreCompleto}
                  </div>
                  <div className="text-[10px] text-sky-300 font-mono leading-tight flex items-center gap-1">
                    <span>@{currentUser.usuario}</span>
                    <span className="text-slate-400">·</span>
                    <span className="capitalize">{currentUser.rol}</span>
                  </div>
                </div>
              </div>

              {/* Botón Cambiar Clave opcional */}
              <button
                type="button"
                onClick={() => setShowOptionalPasswordModal(true)}
                className="p-1.5 text-sky-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                title="Cambiar mi contraseña"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              {/* Botón Cerrar Sesión (Visible en todas las pantallas) */}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white px-3 py-1.5 rounded-lg border border-rose-400/30 transition shadow-sm cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Optional Password Change Modal */}
      {showOptionalPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0B2545]" />
                Cambiar contraseña
              </h3>
              <button
                onClick={() => {
                  setShowOptionalPasswordModal(false);
                  setCambioClaveError(null);
                  setCambioClaveSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {cambioClaveError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {cambioClaveError}
              </div>
            )}
            {cambioClaveSuccess && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                {cambioClaveSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres y un número"
                  value={claveNueva}
                  onChange={(e) => setClaveNueva(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repita la nueva contraseña"
                  value={claveConfirmar}
                  onChange={(e) => setClaveConfirmar(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptionalPasswordModal(false)}
                  className="text-xs px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword || claveNueva.length < 8}
                  className="text-xs px-4 py-2 rounded-lg font-bold bg-[#0B2545] text-white hover:bg-[#134074] disabled:opacity-50"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
        {/* Banner with notice */}
        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 shadow-sm">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-bold">Atención</p>
              <p className="mt-0.5">{apiError}</p>
            </div>
            <button
              onClick={() => setApiError(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
            >
              Cerrar
            </button>
          </div>
        )}

        <form onSubmit={handleCompare} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* SECCIÓN 1: Propuestas (Col 1-5 on desktop) */}
            <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#0B2545] text-white flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">Propuestas</h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {files.length} de 3 cargadas
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-4">
                  Sube de 1 a 3 archivos PDF con las ofertas de las aseguradoras (una propuesta por aseguradora).
                </p>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFilesAdded(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-[#0B2545] hover:bg-slate-50/60'
                  } ${files.length >= 3 ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesAdded(e.target.files)}
                  />
                  <div className="w-12 h-12 mx-auto rounded-full bg-sky-50 flex items-center justify-center text-[#134074] mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {files.length >= 3
                      ? 'Límite de 3 archivos alcanzado'
                      : 'Haz clic para seleccionar o arrastra archivos PDF aquí'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Formato PDF de hasta 15 MB por cotización</p>
                </div>

                {fileError && (
                  <p className="mt-2 text-xs text-rose-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {fileError}
                  </p>
                )}

                {/* Uploaded Files List */}
                <div className="mt-5 space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Archivos cargados ({files.length}):
                  </h3>

                  {files.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-400 font-medium">Ningún archivo cargado aún</p>
                      <button
                        type="button"
                        onClick={handleLoadSamples}
                        className="mt-2 text-xs font-semibold text-sky-700 hover:underline"
                      >
                        ¿Usar propuestas de prueba?
                      </button>
                    </div>
                  ) : (
                    files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatFileSize(file.size)} {file.aseguradora ? `· ${file.aseguradora}` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2"
                          title="Eliminar archivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Listo para análisis con Gemini
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                  >
                    Quitar todos
                  </button>
                </div>
              )}
            </section>

            {/* SECCIÓN 2: Perfil del cliente (Col 6-12 on desktop) */}
            <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#0B2545] text-white flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">Perfil del cliente</h2>
                  </div>
                  <span className="text-xs text-slate-400">Parámetros de validación</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nombre */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Nombre del cliente
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Laura Solís Vargas"
                      value={profile.nombre}
                      onChange={(e) => setProfile({ ...profile, nombre: e.target.value })}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] focus:border-transparent transition"
                    />
                  </div>

                  {/* Vehículo y uso */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      Vehículo y uso
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Toyota Corolla XEi 2022 - Particular"
                      value={profile.vehiculoUso}
                      onChange={(e) => setProfile({ ...profile, vehiculoUso: e.target.value })}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {/* Presupuesto máximo anual */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        Presupuesto máximo anual (colones)
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">₡</span>
                      <input
                        type="number"
                        min="1"
                        step="5000"
                        required
                        value={profile.presupuestoMaximo || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            presupuestoMaximo: e.target.value ? Number(e.target.value) : 0,
                          })
                        }
                        className="w-full text-sm font-semibold pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] focus:border-transparent transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Monto: ₡ {Number(profile.presupuestoMaximo || 0).toLocaleString('es-CR')}
                    </p>
                  </div>

                  {/* Forma de pago preferida */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Forma de pago preferida
                    </label>
                    <select
                      value={profile.formaPago}
                      onChange={(e) => setProfile({ ...profile, formaPago: e.target.value })}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] focus:border-transparent bg-white transition"
                    >
                      <option value="Anual de contado">Anual de contado</option>
                      <option value="Semestral">Semestral (2 cuotas)</option>
                      <option value="Mensual">Mensual (12 cuotas)</option>
                    </select>
                  </div>
                </div>

                {/* Coberturas obligatorias (casillas) */}
                <div className="mt-5">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Coberturas obligatorias para el cliente:
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2.5">
                    Nota: Para cumplir, deben estar incluidas en la prima base. Paquetes opcionales con recargo adicional no califican.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {COBERTURAS_OPCIONES.map((cob) => {
                      const isChecked = profile.coberturasObligatorias.includes(cob.id);
                      return (
                        <button
                          type="button"
                          key={cob.id}
                          onClick={() => handleToggleCoverage(cob.id)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition ${
                            isChecked
                              ? 'bg-sky-50/80 border-[#134074] text-slate-900 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                              isChecked
                                ? 'bg-[#0B2545] border-[#0B2545] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-tight">{cob.label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{cob.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prioridades (área de texto) */}
                <div className="mt-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    Prioridades del cliente
                  </label>
                  <textarea
                    rows={2}
                    value={profile.prioridades}
                    onChange={(e) => setProfile({ ...profile, prioridades: e.target.value })}
                    placeholder="Ej: Priorizar asistencia vial completa y deducibles bajos para colisión. Uso familiar."
                    className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2545] focus:border-transparent transition"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Botón grande "Comparar propuestas" */}
          <div className="flex flex-col items-center justify-center pt-2">
            <button
              type="submit"
              disabled={isLoading || files.length === 0}
              className={`w-full sm:w-auto min-w-[280px] px-8 py-4 rounded-2xl font-black text-base shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-3 ${
                isLoading || files.length === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-[#0B2545] via-[#134074] to-[#1D4E89] text-white hover:shadow-xl hover:shadow-sky-900/20 hover:-translate-y-0.5 cursor-pointer'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-sky-300" />
                  <span>Analizando propuestas...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>Comparar propuestas</span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full font-normal">
                    {files.length} {files.length === 1 ? 'PDF' : 'PDFs'}
                  </span>
                </>
              )}
            </button>
            {files.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">
                * Debe subir al menos 1 archivo PDF en la sección 1 para iniciar la comparación.
              </p>
            )}
          </div>
        </form>

        {/* Indicador de "Analizando propuestas..." */}
        {isLoading && (
          <div className="my-10 p-8 rounded-2xl bg-white border border-sky-100 shadow-md text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 text-[#134074] flex items-center justify-center mx-auto mb-4 relative">
              <RefreshCw className="w-8 h-8 animate-spin text-[#0B2545]" />
              <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Analizando propuestas con Gemini...</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Leyendo y extrayendo minuciosamente cada PDF según las normas técnicas de EDK Corredora.
            </p>

            {/* Stepper info */}
            <div className="mt-6 flex flex-col gap-2 max-w-md mx-auto text-left text-xs">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    loadingStep >= 0 ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  1
                </div>
                <span className={loadingStep >= 0 ? 'font-semibold text-slate-800' : 'text-slate-400'}>
                  Extracción estricta de primas, deducibles y coberturas de cada PDF
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    loadingStep >= 1 ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  2
                </div>
                <span className={loadingStep >= 1 ? 'font-semibold text-slate-800' : 'text-slate-400'}>
                  Verificación de presupuesto y coberturas obligatorias (sin paquetes extra)
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    loadingStep >= 2 ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  3
                </div>
                <span className={loadingStep >= 2 ? 'font-semibold text-slate-800' : 'text-slate-400'}>
                  Cálculo del semáforo y recomendación justificada según prioridades
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    loadingStep >= 3 ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  4
                </div>
                <span className={loadingStep >= 3 ? 'font-semibold text-slate-800' : 'text-slate-400'}>
                  Redacción del mensaje de WhatsApp listo para el cliente
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 3: Resultado */}
        {comparisonResult && !isLoading && (
          <div ref={resultSectionRef} className="mt-12 space-y-8 animate-in fade-in duration-500">
            {/* Header of Section 3 */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-[#0B2545] text-white flex items-center justify-center font-black text-sm">
                    3
                  </span>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Resultado de la Comparación</h2>
                    <p className="text-xs text-slate-500">
                      Cliente: <span className="font-semibold text-slate-700">{profile.nombre || 'Laura Solís Vargas'}</span> ·{' '}
                      Vehículo: <span className="font-semibold text-slate-700">{profile.vehiculoUso || 'Toyota Corolla'}</span> ·{' '}
                      Presupuesto: <span className="font-semibold text-emerald-700">₡ {Number(profile.presupuestoMaximo || 0).toLocaleString('es-CR')}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNewComparison}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Nueva comparación
                  </button>
                </div>
              </div>

              {/* TABLA COMPARATIVA */}
              <div className="mt-6 overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-[#0B2545] text-white">
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] w-52 sticky left-0 bg-[#0B2545] z-10 border-r border-[#13315C]">
                        Criterio / Aseguradora
                      </th>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <th
                          key={idx}
                          className="p-3.5 font-extrabold text-sm border-r border-[#13315C] last:border-r-0 text-center"
                        >
                          <div className="text-white">{aseg.nombre}</div>
                          {aseg.archivoOrigen && (
                            <div className="text-[10px] font-normal text-sky-200 truncate mt-0.5">
                              {aseg.archivoOrigen}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Fila 1: Prima anual */}
                    <tr className="bg-white hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                        Prima anual
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center font-bold text-sm text-[#0B2545] border-r border-slate-200 last:border-r-0">
                          {aseg.primaAnual}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 2: Cabe en presupuesto */}
                    <tr className="bg-slate-50/80 hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-slate-50/80 z-10 border-r border-slate-200">
                        Cabe en presupuesto
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center border-r border-slate-200 last:border-r-0">
                          {aseg.cabeEnPresupuesto ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {aseg.cabeEnPresupuestoTexto || 'Sí'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              {aseg.cabeEnPresupuestoTexto || 'No'}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 3: Deducible colisión */}
                    <tr className="bg-white hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                        Deducible colisión
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0 font-medium">
                          {aseg.deducibleColision}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 4: Deducible robo */}
                    <tr className="bg-slate-50/80 hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-slate-50/80 z-10 border-r border-slate-200">
                        Deducible robo
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0 font-medium">
                          {aseg.deducibleRobo}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 5: RC daños a terceros */}
                    <tr className="bg-white hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                        RC daños a terceros
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
                          {aseg.rcDanosTerceros}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 6: RC lesiones */}
                    <tr className="bg-slate-50/80 hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-slate-50/80 z-10 border-r border-slate-200">
                        RC lesiones
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
                          {aseg.rcLesiones}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 7: Asistencia vial 24/7 */}
                    <tr className="bg-white hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                        Asistencia vial 24/7
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
                          {aseg.asistenciaVial247}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 8: Grúa */}
                    <tr className="bg-slate-50/80 hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-slate-50/80 z-10 border-r border-slate-200">
                        Grúa
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
                          {aseg.grua}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 9: Vehículo sustituto */}
                    <tr className="bg-white hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                        Vehículo sustituto
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
                          {aseg.vehiculoSustituto}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 10: Fenómenos naturales */}
                    <tr className="bg-slate-50/80 hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-slate-50/80 z-10 border-r border-slate-200">
                        Fenómenos naturales
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
                          {aseg.fenomenosNaturales}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 11: Rotura de cristales */}
                    <tr className="bg-white hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                        Rotura de cristales
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
                          {aseg.roturaCristales}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 12: Exclusiones destacadas */}
                    <tr className="bg-slate-50/80 hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-slate-50/80 z-10 border-r border-slate-200">
                        Exclusiones destacadas
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-left text-slate-600 border-r border-slate-200 last:border-r-0 text-[11px] leading-relaxed">
                          {aseg.exclusionesDestacadas}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 13: Cumple obligatorias */}
                    <tr className="bg-white hover:bg-slate-100/60 border-b border-slate-200">
                      <td className="p-3.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                        Cumple obligatorias
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-3.5 text-center border-r border-slate-200 last:border-r-0">
                          {aseg.cumpleObligatorias ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {aseg.cumpleObligatoriasTexto || 'Sí'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              {aseg.cumpleObligatoriasTexto || 'No'}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Fila 14: Semáforo */}
                    <tr className="bg-slate-50/90 hover:bg-slate-100 border-t-2 border-slate-300">
                      <td className="p-4 font-black text-slate-900 sticky left-0 bg-slate-50/90 z-10 border-r border-slate-200 text-sm">
                        Semáforo
                      </td>
                      {comparisonResult.aseguradoras.map((aseg, idx) => (
                        <td key={idx} className="p-4 text-center border-r border-slate-200 last:border-r-0">
                          {renderSemaforo(aseg.semaforo, aseg.motivoSemaforo)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* DEBAJO DE LA TABLA: Dos cuadros destacados */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Cuadro 1: Recomendación preliminar (borrador) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#0B2545] flex items-center justify-center font-bold">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        Recomendación preliminar (borrador)
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Para uso del asesor
                    </span>
                  </div>

                  <div className="bg-sky-50/50 rounded-xl p-4 border border-sky-100">
                    <p className="text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                      {comparisonResult.recomendacionPreliminar}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>
                    Elaborado considerando montos en colones y las prioridades específicas declaradas por el cliente.
                  </span>
                </div>
              </div>

              {/* Cuadro 2: Mensaje sugerido para el cliente (WhatsApp) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Send className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        Mensaje sugerido para el cliente (WhatsApp)
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tono cordial · Máx 8 líneas
                    </span>
                  </div>

                  {/* Simulated WhatsApp Bubble */}
                  <div className="bg-[#EFEAE2] p-4 rounded-xl border border-[#D1D7DB] relative overflow-hidden">
                    <div className="bg-white rounded-lg p-3.5 shadow-sm text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans border border-slate-100">
                      {comparisonResult.mensajeWhatsApp}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer ${
                      copiedSuccess
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#0B2545] hover:bg-[#134074] text-white'
                    }`}
                  >
                    {copiedSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>¡Mensaje copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar mensaje</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(comparisonResult.mensajeWhatsApp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline px-2 py-1"
                  >
                    <span>Abrir en WhatsApp</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom action buttons */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                type="button"
                onClick={handleNewComparison}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-sm transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Nueva comparación</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Texto fijo al pie */}
      <footer className="bg-slate-100 border-t border-slate-200 mt-12 py-5 px-4 text-center">
        <p className="text-xs text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed">
          Borrador generado con IA. Debe ser validado por un asesor contra las condiciones reales de la póliza. No suba datos reales de clientes.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          EDK Corredora de Seguros · San José, Costa Rica · Sistema de Apoyo al Asesor
        </p>
      </footer>
    </div>
  );
}
