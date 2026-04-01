const validate = (schema) => (req, res, next) => {
  try {
    // Validate request body
    schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      message: "Validation Error",
      errors: error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
    });
  }
};

module.exports = validate;
