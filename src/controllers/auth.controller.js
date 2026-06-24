const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Conexión a tu Postgres de PROEDSO

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscar al usuario por correo electrónico
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'El correo electrónico no está registrado.' });
    }

    const usuario = result.rows[0];

    // 2. Comprobar la contraseña encriptada mediante Bcrypt
    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    // 3. Generar el Token JWT firmado de forma segura
    // Nota: 'JWT_SECRET' se configurará en las variables de entorno de Render
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos
      },
      process.env.JWT_SECRET || 'LLAVE_SECRETA_SUPER_PROEDSO_2026',
      { expiresIn: '24h' }
    );

    // 4. Enviar respuesta exitosa con los datos del perfil (¡Hola Yesly!)
    res.status(200).json({
      message: '¡Bienvenido al sistema PROEDSO!',
      data: {
        token,
        usuario: {
          id: usuario.id,
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          rol: usuario.rol
        }
      }
    });

  } catch (error) {
    console.error('Error crítico en login backend:', error);
    res.status(500).json({ message: 'Hubo un error interno en el servidor.' });
  }
};

module.exports = { login };