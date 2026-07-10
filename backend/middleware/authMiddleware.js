import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hims-super-secret-key-9988';

/**
 * Authentication Middleware
 * Decodes the Bearer token from the Authorization header
 * and attaches the user payload to the request object.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access Denied: Authentication token required.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;

    if (verified.requiresReset && req.path !== '/auth/reset-default-admin' && req.path !== '/auth/logout') {
      return res.status(403).json({ error: 'Password change required: You must change your default superadmin credentials before accessing other routes.' });
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(403).json({ error: 'Access Denied: Invalid or expired token.' });
  }
};

/**
 * Role-Based Access Control Middleware
 * Requires that the authenticated user has one of the allowed roles.
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access Denied: Not authenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access Denied: Role '${req.user.role}' does not have permission to execute this operation.`
      });
    }

    next();
  };
};

export { authenticateToken, authorizeRoles };
