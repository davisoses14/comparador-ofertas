import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths for persistent data files
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'usuarios.json');
const COMPARACIONES_FILE = path.join(DATA_DIR, 'comparaciones.json');
const AUDITORIA_FILE = path.join(DATA_DIR, 'auditoria.json');

// Interface for User in data/usuarios.json
interface UsuarioStorage {
  id: string;
  usuario: string; // nombre corto, sin espacios, en minúsculas
  nombreCompleto: string;
  rol: 'administrador' | 'asesor';
  estado: 'activo' | 'suspendido';
  debeCambiarClave: boolean;
  fechaCreacion: string;
  ultimoAcceso: string | null;
  passwordHash: string; // ONLY bcrypt hash, never plain text
}

// Initialize storage files if they don't exist
function initDataStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Regla 3: Si data/usuarios.json no existe, créalo al arrancar con el administrador inicial:
  // usuario "admin", nombre "Administrador", rol administrador, contraseña temporal "Fundepos2026*" y debeCambiarClave en verdadero.
  if (!fs.existsSync(USERS_FILE)) {
    const adminUser: UsuarioStorage = {
      id: crypto.randomUUID(),
      usuario: 'admin',
      nombreCompleto: 'Administrador',
      rol: 'administrador',
      estado: 'activo',
      debeCambiarClave: true,
      fechaCreacion: new Date().toISOString(),
      ultimoAcceso: null,
      passwordHash: bcrypt.hashSync('Fundepos2026*', 10),
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2), 'utf-8');
    console.log('[Auth] data/usuarios.json inicializado con el usuario admin inicial');
  }

  if (!fs.existsSync(COMPARACIONES_FILE)) {
    fs.writeFileSync(COMPARACIONES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  if (!fs.existsSync(AUDITORIA_FILE)) {
    fs.writeFileSync(AUDITORIA_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function getUsuarios(): UsuarioStorage[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch (err) {
    console.error('Error leyendo usuarios.json:', err);
    return [];
  }
}

function saveUsuarios(usuarios: UsuarioStorage[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(usuarios, null, 2), 'utf-8');
}

function registrarAuditoria(registro: {
  usuarioId?: string;
  usuario?: string;
  accion: string;
  detalles?: string;
  ip?: string;
}) {
  try {
    let logs: any[] = [];
    if (fs.existsSync(AUDITORIA_FILE)) {
      logs = JSON.parse(fs.readFileSync(AUDITORIA_FILE, 'utf-8'));
    }
    logs.push({
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      ...registro,
    });
    fs.writeFileSync(AUDITORIA_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}

function registrarComparacion(registro: {
  usuarioId: string;
  usuario: string;
  cliente: string;
  vehiculo: string;
  presupuesto: number;
  numPropuestas: number;
  aseguradoras: string[];
  recomendacion: string;
}) {
  try {
    let comps: any[] = [];
    if (fs.existsSync(COMPARACIONES_FILE)) {
      comps = JSON.parse(fs.readFileSync(COMPARACIONES_FILE, 'utf-8'));
    }
    comps.push({
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      ...registro,
    });
    fs.writeFileSync(COMPARACIONES_FILE, JSON.stringify(comps, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error registrando comparación:', err);
  }
}

async function startServer() {
  initDataStorage();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const SESSION_COOKIE_NAME = 'bn_session';
  const SESSION_SECRET = process.env.SESSION_SECRET || 'bn-seguros-secret-costa-rica-2026';

  // Middlewares
  app.use(cookieParser(SESSION_SECRET));
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // Initialize Gemini Client
  const apiKey = process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Auth Middleware
  // Regla 5: TODOS los endpoints del comparador exigen sesión válida y usuario activo; si no, responden 401.
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const rawCookie = req.signedCookies[SESSION_COOKIE_NAME];
    if (!rawCookie) {
      return res.status(401).json({ error: 'Sesión no válida o expirada' });
    }

    try {
      const session = JSON.parse(rawCookie);
      if (!session || !session.userId || !session.expiresAt) {
        return res.status(401).json({ error: 'Sesión no válida o expirada' });
      }

      if (Date.now() > session.expiresAt) {
        res.clearCookie(SESSION_COOKIE_NAME);
        return res.status(401).json({ error: 'Sesión no válida o expirada' });
      }

      const usuarios = getUsuarios();
      const user = usuarios.find((u) => u.id === session.userId);

      if (!user) {
        res.clearCookie(SESSION_COOKIE_NAME);
        return res.status(401).json({ error: 'Sesión no válida o expirada' });
      }

      if (user.estado !== 'activo') {
        res.clearCookie(SESSION_COOKIE_NAME);
        return res.status(401).json({ error: 'usuario suspendido, contacte al administrador' });
      }

      (req as any).user = user;
      next();
    } catch (err) {
      res.clearCookie(SESSION_COOKIE_NAME);
      return res.status(401).json({ error: 'Sesión no válida o expirada' });
    }
  }

  // --- AUTH ENDPOINTS ---

  // POST /api/login (usuario y contraseña)
  // Regla 4 & 6: devuelve cookie firmada, httpOnly, que expira en 8 horas. Mensajes claros requeridos.
  app.post('/api/login', (req, res) => {
    const { usuario, contrasena, password } = req.body;
    const rawUser = usuario || '';
    const rawPass = contrasena || password || '';

    if (!rawUser || !rawPass) {
      return res.status(401).json({ error: 'usuario o contraseña incorrectos' });
    }

    const cleanUser = String(rawUser).trim().toLowerCase();
    const usuarios = getUsuarios();
    const user = usuarios.find((u) => u.usuario.toLowerCase() === cleanUser);

    if (!user || !bcrypt.compareSync(String(rawPass), user.passwordHash)) {
      registrarAuditoria({
        usuario: cleanUser,
        accion: 'LOGIN_FALLIDO',
        detalles: 'Credenciales inválidas',
        ip: req.ip,
      });
      return res.status(401).json({ error: 'usuario o contraseña incorrectos' });
    }

    if (user.estado === 'suspendido') {
      registrarAuditoria({
        usuarioId: user.id,
        usuario: user.usuario,
        accion: 'LOGIN_BLOQUEADO',
        detalles: 'Intento de acceso de usuario suspendido',
        ip: req.ip,
      });
      return res.status(403).json({ error: 'usuario suspendido, contacte al administrador' });
    }

    // Actualizar último acceso
    user.ultimoAcceso = new Date().toISOString();
    saveUsuarios(usuarios);

    // Cookie de sesión firmada, httpOnly, expira en 8 horas
    const sessionData = {
      userId: user.id,
      usuario: user.usuario,
      createdAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };

    res.cookie(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      signed: true,
    });

    registrarAuditoria({
      usuarioId: user.id,
      usuario: user.usuario,
      accion: 'LOGIN_EXITOSO',
      detalles: 'Inicio de sesión exitoso',
      ip: req.ip,
    });

    const { passwordHash, ...userClean } = user;
    res.json({ usuario: userClean });
  });

  // POST /api/logout (elimina la cookie)
  app.post('/api/logout', (req, res) => {
    const rawCookie = req.signedCookies[SESSION_COOKIE_NAME];
    if (rawCookie) {
      try {
        const session = JSON.parse(rawCookie);
        registrarAuditoria({
          usuarioId: session?.userId,
          usuario: session?.usuario,
          accion: 'LOGOUT',
          detalles: 'Cierre de sesión manual',
          ip: req.ip,
        });
      } catch {}
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ ok: true, mensaje: 'Sesión finalizada con éxito' });
  });

  // GET /api/yo (devuelve el usuario conectado)
  app.get('/api/yo', requireAuth, (req, res) => {
    const user = (req as any).user as UsuarioStorage;
    const { passwordHash, ...userClean } = user;
    res.json({ usuario: userClean });
  });

  // POST /api/cambiar-clave (mínimo 8 caracteres, al menos un número)
  app.post('/api/cambiar-clave', requireAuth, (req, res) => {
    const user = (req as any).user as UsuarioStorage;
    const { claveActual, claveNueva } = req.body;

    if (!claveNueva || typeof claveNueva !== 'string') {
      return res.status(400).json({ error: 'La nueva contraseña es obligatoria' });
    }

    if (claveNueva.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres' });
    }

    if (!/\d/.test(claveNueva)) {
      return res.status(400).json({ error: 'La nueva contraseña debe contener al menos un número' });
    }

    // Si no está obligado a cambiar clave y provee claveActual, validarla
    if (!user.debeCambiarClave && claveActual) {
      if (!bcrypt.compareSync(String(claveActual), user.passwordHash)) {
        return res.status(400).json({ error: 'La contraseña actual no es correcta' });
      }
    }

    const usuarios = getUsuarios();
    const targetUser = usuarios.find((u) => u.id === user.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    targetUser.passwordHash = bcrypt.hashSync(claveNueva, 10);
    targetUser.debeCambiarClave = false;
    saveUsuarios(usuarios);

    registrarAuditoria({
      usuarioId: user.id,
      usuario: user.usuario,
      accion: 'CAMBIO_CLAVE',
      detalles: 'Contraseña actualizada exitosamente',
      ip: req.ip,
    });

    const { passwordHash, ...userClean } = targetUser;
    res.json({ ok: true, usuario: userClean, mensaje: 'Contraseña actualizada correctamente' });
  });

  // --- COMPARATOR ENDPOINTS (Todos exigen requireAuth) ---

  // Endpoint to fetch sample pre-loaded PDFs from the assignment
  app.get('/api/sample-proposals', requireAuth, (req, res) => {
    try {
      const sampleFiles = [
        {
          name: 'Propuesta_A_Aseguradora_Cordillera.pdf',
          filePath: path.join(__dirname, 'public/assets/aistudio/Propuesta_A_Aseguradora_Cordillera_45e2b828.pdf'),
          aseguradora: 'Aseguradora Cordillera S.A.',
        },
        {
          name: 'Propuesta_B_Seguros_Alborada.pdf',
          filePath: path.join(__dirname, 'public/assets/aistudio/Propuesta_B_Seguros_Alborada_26bdc3b0.pdf'),
          aseguradora: 'Seguros Alborada',
        },
        {
          name: 'Propuesta_C_Protectora_del_Valle.pdf',
          filePath: path.join(__dirname, 'public/assets/aistudio/Propuesta_C_Protectora_del_Valle_422f9421.pdf'),
          aseguradora: 'Protectora del Valle',
        },
      ];

      const loadedFiles = sampleFiles.map((item) => {
        if (fs.existsSync(item.filePath)) {
          const fileBuffer = fs.readFileSync(item.filePath);
          return {
            name: item.name,
            size: fileBuffer.length,
            dataBase64: `data:application/pdf;base64,${fileBuffer.toString('base64')}`,
            aseguradora: item.aseguradora,
          };
        }
        return null;
      }).filter(Boolean);

      res.json({
        files: loadedFiles,
        defaultProfile: {
          nombre: 'Laura Solís Vargas',
          vehiculoUso: 'Toyota Corolla XEi 2022 - Particular',
          presupuestoMaximo: 400000,
          coberturasObligatorias: ['colision', 'robo', 'asistencia'],
          prioridades: 'Priorizar deducibles bajos y asistencia vial completa. Presupuesto ajustado a ₡ 400.000, pero flexible si la cobertura justifica la diferencia.',
          formaPago: 'Anual de contado',
        },
      });
    } catch (error: any) {
      console.error('Error cargando propuestas de ejemplo:', error);
      res.status(500).json({ error: error.message || 'Error al cargar ejemplos' });
    }
  });

  // Placeholder for extract-client-profile if invoked
  app.post('/api/extract-client-profile', requireAuth, async (req, res) => {
    res.json({ ok: true });
  });

  // Endpoint to compare proposals using Gemini
  app.post('/api/compare', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as UsuarioStorage;
      const { files, perfil } = req.body;

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Debe cargar al menos 1 archivo PDF de propuesta.' });
      }

      if (files.length > 3) {
        return res.status(400).json({ error: 'Se permite comparar un máximo de 3 propuestas a la vez.' });
      }

      if (!apiKey) {
        return res.status(500).json({
          error: 'No se ha configurado la variable de entorno GEMINI_API_KEY en el servidor.',
        });
      }

      const coberturasNombres: Record<string, string> = {
        colision: 'Colisión y vuelco',
        robo: 'Robo (total y/o parcial)',
        asistencia: 'Asistencia vial 24/7',
        fenomenos: 'Fenómenos naturales (inundación, deslizamiento, sismo, etc.)',
        sustituto: 'Vehículo sustituto',
      };

      const obligatoriasDesc = (perfil.coberturasObligatorias || [])
        .map((key: string) => `- ${coberturasNombres[key] || key}`)
        .join('\n');

      // Build contents parts for Gemini
      const contentsParts: any[] = [];

      files.forEach((file: { name: string; dataBase64: string }, index: number) => {
        const cleanBase64 = file.dataBase64.replace(/^data:[^;]+;base64,/, '');
        contentsParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: cleanBase64,
          },
        });
        contentsParts.push({
          text: `[DOCUMENTO N° ${index + 1}: Archivo "${file.name}"]`,
        });
      });

      const promptInstructions = `
Eres el motor de análisis experto de la corredora de seguros en Costa Rica "EDK Corredora de Seguros".
Tu objetivo es analizar estrictamente los documentos PDF de cotización adjuntos y compararlos con base en el perfil del cliente suministrado.

DATOS DEL CLIENTE:
- Nombre del cliente: ${perfil.nombre || 'No indicado'}
- Vehículo y uso: ${perfil.vehiculoUso || 'No indicado'}
- Presupuesto máximo anual: ₡ ${Number(perfil.presupuestoMaximo || 0).toLocaleString('es-CR')} colones
- Coberturas obligatorias exigidas por el cliente:
${obligatoriasDesc || '- Ninguna indicada'}
- Prioridades del cliente: ${perfil.prioridades || 'No indicadas'}
- Forma de pago preferida: ${perfil.formaPago || 'No indicada'}

INSTRUCCIONES Y REGLAS DE NEGOCIO ESTRICTAS:
1. EXTRACCIÓN EXACTA: Extrae de cada PDF solo lo que dice el documento explícitamente. Si un dato no aparece o no está mencionado en el documento, escribe estrictamente "no indicado". NUNCA inventes, asumas ni extrapoles información que no conste en la propuesta.
2. VALIDACIÓN DE PRESUPUESTO:
   - "Cabe en presupuesto": Es verdadero (true / "Sí") si la prima anual (incluyendo impuestos como IVA si así lo indica la propuesta) es menor o igual al presupuesto del cliente (₡ ${Number(perfil.presupuestoMaximo || 0).toLocaleString('es-CR')}). Si es mayor, es falso (false / "No"). Indica en el texto el margen o diferencia exacta en colones.
3. VALIDACIÓN DE COBERTURAS OBLIGATORIAS:
   - "Cumple obligatorias": Es verdadero (true / "Sí") ÚNICAMENTE si TODAS las coberturas marcadas como obligatorias por el cliente están efectivamente incluidas en la prima base cotizada.
   - REGLA CRÍTICA: Un paquete opcional o asistencia adicional con costo o prima extra NO CUENTA como incluida en la prima base. Si una cobertura obligatoria requiere pago extra o no está amparada, NO CUMPLE.
4. SEMÁFORO:
   - "verde": si cabe en presupuesto Y cumple todas las coberturas obligatorias.
   - "amarillo": si cumple todas las coberturas obligatorias pero NO cabe en presupuesto (excede el presupuesto máximo).
   - "rojo": si NO cumple las coberturas obligatorias (sin importar el precio).
5. RECOMENDACIÓN PRELIMINAR (BORRADOR PARA ASESOR):
   - Recomienda UNA SOLA propuesta.
   - Justifica la recomendación en MÁXIMO 5 LÍNEAS incluyendo los montos exactos en colones, relacionándolos directamente con las prioridades del cliente.
   - REGLA ESPECIAL: Si una propuesta con semáforo amarillo satisface mejor las prioridades del cliente (por ejemplo, deducibles significativamente menores, mejores coberturas o vehículo sustituto), indícalo claramente y CUANTIFICA la diferencia exacta de prima respecto al presupuesto o a las demás opciones.
6. MENSAJE SUGERIDO PARA EL CLIENTE (WHATSAPP):
   - Redactado para enviar por WhatsApp: MÁXIMO 8 LÍNEAS.
   - Tono cordial, empático y profesional, sin tecnicismos complejos de seguros.
   - Debe contener:
     * El saludo y la propuesta recomendada.
     * Dos razones claras del por qué es la mejor opción.
     * La alternativa (por si desea ajustar costo o cobertura).
     * Un próximo paso para coordinar.
     * NO prometer plazos de entrega ni tiempos específicos.
`;

      contentsParts.push({ text: promptInstructions });

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          aseguradoras: {
            type: Type.ARRAY,
            description: 'Lista de aseguradoras evaluadas (una por cada PDF)',
            items: {
              type: Type.OBJECT,
              properties: {
                nombre: {
                  type: Type.STRING,
                  description: 'Nombre de la aseguradora o plan según el encabezado del documento',
                },
                archivoOrigen: {
                  type: Type.STRING,
                  description: 'Nombre del archivo PDF correspondiente',
                },
                primaAnual: {
                  type: Type.STRING,
                  description: 'Prima anual total exacta según el documento (ej. ₡ 395.000 IVA incluido)',
                },
                primaAnualMonto: {
                  type: Type.NUMBER,
                  description: 'Monto numérico aproximado de la prima anual para comparaciones',
                },
                cabeEnPresupuesto: {
                  type: Type.BOOLEAN,
                  description: 'true si la prima anual <= presupuesto',
                },
                cabeEnPresupuestoTexto: {
                  type: Type.STRING,
                  description: 'Texto descriptivo (ej: Sí (₡ 395.000 <= ₡ 400.000) o No (excede por ₡ 55.000))',
                },
                deducibleColision: {
                  type: Type.STRING,
                  description: 'Deducible colisión o "no indicado"',
                },
                deducibleRobo: {
                  type: Type.STRING,
                  description: 'Deducible robo o "no indicado"',
                },
                rcDanosTerceros: {
                  type: Type.STRING,
                  description: 'Responsabilidad civil daños a terceros (bienes) o "no indicado"',
                },
                rcLesiones: {
                  type: Type.STRING,
                  description: 'Responsabilidad civil lesiones o muerte a terceros o "no indicado"',
                },
                asistenciaVial247: {
                  type: Type.STRING,
                  description: 'Detalle de asistencia vial 24/7 y si está incluida en prima base o es opcional',
                },
                grua: {
                  type: Type.STRING,
                  description: 'Servicio de grúa (km, eventos anuales) o "no indicado"',
                },
                vehiculoSustituto: {
                  type: Type.STRING,
                  description: 'Vehículo sustituto o "no indicado"',
                },
                fenomenosNaturales: {
                  type: Type.STRING,
                  description: 'Fenómenos naturales (inundación, deslizamiento, etc.) o "no indicado"',
                },
                roturaCristales: {
                  type: Type.STRING,
                  description: 'Rotura de cristales o "no indicado"',
                },
                exclusionesDestacadas: {
                  type: Type.STRING,
                  description: 'Exclusiones destacadas del documento',
                },
                cumpleObligatorias: {
                  type: Type.BOOLEAN,
                  description: 'true solo si todas las coberturas obligatorias marcadas están incluidas en la prima base',
                },
                cumpleObligatoriasTexto: {
                  type: Type.STRING,
                  description: 'Sí o No con explicación clara de faltantes',
                },
                semaforo: {
                  type: Type.STRING,
                  description: 'verde, amarillo o rojo exactamente',
                },
                motivoSemaforo: {
                  type: Type.STRING,
                  description: 'Explicación concisa del semáforo',
                },
              },
              required: [
                'nombre',
                'primaAnual',
                'cabeEnPresupuesto',
                'cabeEnPresupuestoTexto',
                'deducibleColision',
                'deducibleRobo',
                'rcDanosTerceros',
                'rcLesiones',
                'asistenciaVial247',
                'grua',
                'vehiculoSustituto',
                'fenomenosNaturales',
                'roturaCristales',
                'exclusionesDestacadas',
                'cumpleObligatorias',
                'cumpleObligatoriasTexto',
                'semaforo',
              ],
            },
          },
          recomendacionPreliminar: {
            type: Type.STRING,
            description: 'Una sola propuesta, justificada en máximo 5 líneas con montos y prioridades del cliente.',
          },
          mensajeWhatsApp: {
            type: Type.STRING,
            description: 'Mensaje para el cliente por WhatsApp, máximo 8 líneas, cordial, sin tecnicismos.',
          },
        },
        required: ['aseguradoras', 'recomendacionPreliminar', 'mensajeWhatsApp'],
      };

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts: contentsParts },
        config: {
          systemInstruction: 'Eres un perito y analista técnico en seguros de automóviles en Costa Rica para EDK Corredora de Seguros. Tu análisis es riguroso, apegado estrictamente a lo que dicen los documentos PDF sin inventar datos.',
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const responseText = aiResponse.text;
      if (!responseText) {
        throw new Error('Gemini no generó ninguna respuesta de texto.');
      }

      const parsedData = JSON.parse(responseText);

      // Regla 9: Guardar comparaciones y auditoría en el servidor asociadas al id del usuario
      registrarComparacion({
        usuarioId: user.id,
        usuario: user.usuario,
        cliente: perfil.nombre || 'No indicado',
        vehiculo: perfil.vehiculoUso || 'No indicado',
        presupuesto: Number(perfil.presupuestoMaximo || 0),
        numPropuestas: files.length,
        aseguradoras: parsedData.aseguradoras?.map((a: any) => a.nombre) || [],
        recomendacion: parsedData.recomendacionPreliminar || '',
      });

      registrarAuditoria({
        usuarioId: user.id,
        usuario: user.usuario,
        accion: 'COMPARACION',
        detalles: `Comparación ejecutada para cliente ${perfil.nombre || 'No indicado'} (${files.length} propuestas)`,
        ip: req.ip,
      });

      res.json(parsedData);
    } catch (error: any) {
      console.error('Error al procesar propuestas con Gemini:', error);
      res.status(500).json({
        error: error.message || 'Ocurrió un error al analizar las propuestas con Gemini.',
      });
    }
  });

  // Serve static files or Vite middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EDK Corredora] Servidor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
