// middlewares/checkProfileCompleted.js
const checkProfileCompleted = async (req, res, next) => {
  try {
    if (!req.user.profileCompleted) {
      return res.status(403).json({
        success: false,
        message: 'Please complete your profile first',
        profileCompleted: false
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = checkProfileCompleted;