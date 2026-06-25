const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const adjuntosRoutes = require('./routes/adjuntos.routes');
const alumnosRoutes = require('./routes/alumnos.routes');
const estadosAlumnoRoutes = require('./routes/estados-alumno.routes');
const planesCursoRoutes = require('./routes/planes-curso.routes');
const matriculasRoutes = require('./routes/matriculas.routes');
const maquinasRoutes = require('./routes/maquinas.routes');
const pagosRoutes = require('./routes/pagos.routes');
const practicasRoutes = require('./routes/practicas.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const authRoutes = require('./routes/auth.routes'); 
const dashboardRoutes = require('./routes/dashboard.routes'); 
const app = express();

app.disable('etag');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      origin.startsWith('http://localhost:4200') ||
      origin.startsWith('http://192.168.') ||
      origin.endsWith('.vercel.app') // 👈 ¡ESTA LÍNEA ES LA MAGIA! Permite cualquier subdominio de Vercel
    ) {
      return callback(null, true);
    }

    return callback(new Error('No permitido por CORS'));
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});
app.use('/api/dashboard', dashboardRoutes);
app.use('/uploads', cors(), express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  }
}));
app.use('/api/auditoria', auditoriaRoutes);
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'API PROEDSO operativa'
  });
});

// 🔑 PASO 2: Registramos la ruta para habilitar /api/auth/login
app.use('/api/auth', authRoutes); 

app.use('/api/alumnos', alumnosRoutes);
app.use('/api/estados-alumno', estadosAlumnoRoutes);
app.use('/api/planes-curso', planesCursoRoutes);
app.use('/api/matriculas', matriculasRoutes);
app.use('/api/maquinas', maquinasRoutes);
app.use('/api/adjuntos', adjuntosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/practicas', practicasRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 API ejecutándose en http://localhost:${PORT}`);
});
