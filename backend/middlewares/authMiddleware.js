// backend/middlewares/authMiddleware.js
// Middleware to check if user is admin or subadmin
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user JWT token verify hone ke baad aana chahiye
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Aapko yeh action karne ki permission nahi hai." });
    }
    next(); // Agar role match ho gaya, toh aage badho
  };
};

module.exports = { authorizeRoles };
