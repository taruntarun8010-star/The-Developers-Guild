// backend/middlewares/requireRole.js
module.exports = function(requiredRole) {
  return function(req, res, next) {
    if (!req.admin || !req.admin.role) {
      return res.status(401).json({ message: 'Admin authentication required.' });
    }
    if (req.admin.role !== requiredRole && req.admin.role !== 'super_admin') {
      return res.status(403).json({ message: 'Insufficient permissions.' });
    }
    next();
  };
};
