module.exports = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'leader') {
    return res.status(403).send('Доступ запрещен. Только для лидера.');
  }
  next();
};