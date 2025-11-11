// src/controllers/swipeController.js
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');

exports.swipe = async (req, res, next) => {
  try {
    const swiperId = req.user._id;
    const { targetId, action } = req.body;

    // save swipe (unique per pair)
    const swipe = await Swipe.findOneAndUpdate(
      { swiper: swiperId, target: targetId },
      { action },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (action === 'like') {
      // check if target has already liked swiper
      const reciprocal = await Swipe.findOne({ swiper: targetId, target: swiperId, action: 'like' });
      if (reciprocal) {
        // create match if not existing
        let match = await Match.findOne({ users: { $all: [swiperId, targetId] } });
        if (!match) {
          match = await Match.create({ users: [swiperId, targetId] });
          // TODO: notify via socket.io / push notification
        }
        return res.json({ swipe, match, matched: true });
      }
    }

    return res.json({ swipe, matched: false });
  } catch (err) { next(err); }
};
