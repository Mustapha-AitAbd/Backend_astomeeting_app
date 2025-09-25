// src/controllers/swipeController.js
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');

exports.swipe = async (req, res, next) => {
  try {
    const swiperId = req.user._id;
    const { targetId, action } = req.body;

    // enregistrer swipe (unique par paire)
    const swipe = await Swipe.findOneAndUpdate(
      { swiper: swiperId, target: targetId },
      { action },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (action === 'like') {
      // vérifier si target a déjà liké swiper
      const reciprocal = await Swipe.findOne({ swiper: targetId, target: swiperId, action: 'like' });
      if (reciprocal) {
        // créer match si n'existe pas
        let match = await Match.findOne({ users: { $all: [swiperId, targetId] } });
        if (!match) {
          match = await Match.create({ users: [swiperId, targetId] });
          // TODO: notifier via socket.io / push notification
        }
        return res.json({ swipe, match, matched: true });
      }
    }

    return res.json({ swipe, matched: false });
  } catch (err) { next(err); }
};
