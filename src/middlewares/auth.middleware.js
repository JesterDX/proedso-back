const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ message: 'Sin token' });
    }

    const token = header.split(' ')[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'LLAVE_SECRETA_SUPER_PROEDSO_2026'
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};

module.exports = authMiddleware;
