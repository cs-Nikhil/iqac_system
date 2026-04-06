const validateRequest = (validator) => (req, res, next) => {
  const errors = validator(req);

  if (!errors.length) {
    return next();
  }

  return res.status(400).json({
    success: false,
    message: errors[0],
    errors,
  });
};

module.exports = {
  validateRequest,
};
