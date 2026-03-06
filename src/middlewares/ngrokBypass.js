// ─────────────────────────────────────────────────────────────────────────────
// NGROK BYPASS MIDDLEWARE
// Ajoute ce middleware dans app.js AVANT toutes tes routes et fichiers statiques
//
//   app.use(require('./middlewares/ngrokBypass'));
//   app.use(express.static(...))   ← après
//   app.use('/api/auth', ...)      ← après
// ─────────────────────────────────────────────────────────────────────────────

module.exports = (req, res, next) => {
  const host = req.headers.host || '';

  // Détecte si la requête vient via ngrok
  if (host.includes('ngrok')) {

    // Si le query param bypass est déjà présent → on laisse passer
    if (req.query['ngrok-skip-browser-warning']) {
      return next();
    }

    // Sinon on redirige vers la même URL avec le param bypass
    // ngrok détecte ce param et skip la page d'avertissement
    const separator = req.url.includes('?') ? '&' : '?';
    const redirectUrl = req.url + separator + 'ngrok-skip-browser-warning=true';
    return res.redirect(302, redirectUrl);
  }

  next();
};