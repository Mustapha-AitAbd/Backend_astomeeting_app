// src/controllers/compatibilityController.js
const User = require('../models/User');
const astronomy = require('astronomy-engine');

// ============================================================
// ECLIPTIC LONGITUDE CALCULATION
// ============================================================
function getEclipticLongitude(body, date, latitude, longitude) {
  const astroTime = new astronomy.AstroTime(date);
  const observer = new astronomy.Observer(latitude, longitude, 0);
  
  let eclipticLon;
  
  try {
    const equ = astronomy.Equator(body, astroTime, observer, true, true);
    const ecl = astronomy.Ecliptic(equ.vec);
    eclipticLon = ecl.elon;
  } catch (error) {
    console.error(`Error calculating ${body}:`, error.message);
    eclipticLon = 0;
  }
  
  return eclipticLon;
}

// ============================================================
// PLANETARY POSITIONS CALCULATION
// ============================================================
function calculatePlanetaryPositions(dateOfBirth, latitude, longitude) {
  const date = new Date(dateOfBirth);
  const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter'];
  
  const positions = {};
  
  bodies.forEach(body => {
    let lon = getEclipticLongitude(body, date, latitude, longitude);
    
    // Southern hemisphere mirroring (exactly as Python)
    if (latitude < 0) {
      lon = (lon + 180) % 360;
    }
    
    // Normalize between 0 and 360
    if (lon < 0) {
      lon += 360;
    }
    
    positions[body] = lon;
  });
  
  return positions;
}

// ============================================================
// ANGULAR DIFFERENCE (shortest arc between two angles)
// ============================================================
function angularDifference(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

// ============================================================
// PAIR SCORING (exactly as Python)
// ============================================================
function scorePair(diff1, diff2, diff3, diff4) {
  let score = 0;
  
  // Same person (diff1 vs diff2)
  if (Math.abs(diff1 - diff2) <= 2) score += 5;
  else if (Math.abs(diff1 - diff2) <= 4) score += 4;
  else if (Math.abs(diff1 - diff2) <= 6) score += 2;
  else if (Math.abs((diff1 + diff2) - 180) <= 2) score += 5;
  else if (Math.abs((diff1 + diff2) - 180) <= 4) score += 4;
  else if (Math.abs((diff1 + diff2) - 180) <= 6) score += 2;
  
  // Cross comparison (diff3 vs diff4)
  if (Math.abs(diff3 - diff4) <= 2) score += 5;
  else if (Math.abs(diff3 - diff4) <= 4) score += 4;
  else if (Math.abs(diff3 - diff4) <= 6) score += 2;
  else if (Math.abs((diff3 + diff4) - 180) <= 2) score += 5;
  else if (Math.abs((diff3 + diff4) - 180) <= 4) score += 4;
  else if (Math.abs((diff3 + diff4) - 180) <= 6) score += 2;
  
  return score;
}

// ============================================================
// SINGLE PLANET SCORING (exactly as Python)
// ============================================================
function scoreSingle(diff) {
  if (diff <= 1) return 5;
  else if (diff <= 3) return 4;
  else if (diff <= 6) return 2;
  else if (Math.abs(diff - 180) <= 3) return 3;  // opposition
  else if (Math.abs(diff - 120) <= 3) return 3;  // trine
  else if (Math.abs(diff - 90) <= 3) return 2;   // square
  else if (Math.abs(diff - 60) <= 3) return 2;   // sextile
  else return 0;
}

// ============================================================
// MAPPING PERCENTUALE (exactly as Python)
// ============================================================
function mapPercentuale(x, soglia = 0.4, maxVal = 4.0, step = 0.5) {
  const y = Math.min(maxVal, (maxVal / soglia) * x);
  return Math.round(y / step) * step;
}

// ============================================================
// COMPATIBILITY CALCULATION (MATCHING PYTHON LOGIC)
// ============================================================
function calculateCompatibility(user1Positions, user2Positions) {
  // Planet pairs to analyze (exactly as Python)
  const pairs = [
    ['Venus', 'Jupiter'],
    ['Mars', 'Venus'],
    ['Sun', 'Venus'],
    ['Sun', 'Jupiter'],
    ['Venus', 'Mercury'],
    ['Moon', 'Mars']
  ];
  
  const singles = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter'];
  
  // Calculate pair scores
  const pairScores = {};
  pairs.forEach(([p1, p2]) => {
    const diff1 = angularDifference(user1Positions[p1], user1Positions[p2]);
    const diff2 = angularDifference(user2Positions[p1], user2Positions[p2]);
    const diff3 = angularDifference(user1Positions[p1], user2Positions[p2]);
    const diff4 = angularDifference(user1Positions[p2], user2Positions[p1]);
    
    pairScores[`${p1}-${p2}`] = scorePair(diff1, diff2, diff3, diff4);
  });
  
  // Calculate single planet scores
  const singleScores = {};
  singles.forEach(planet => {
    const diff = angularDifference(user1Positions[planet], user2Positions[planet]);
    singleScores[planet] = scoreSingle(diff);
  });
  
  // Calculate the three main compatibility scores (EXACTLY as Python)
  const intesaEmotiva = 
    pairScores['Venus-Jupiter'] +
    pairScores['Sun-Venus'] +
    singleScores['Venus'] +
    singleScores['Jupiter'];
  
  const intesaFisica = 
    pairScores['Mars-Venus'] +
    pairScores['Moon-Mars'] +
    singleScores['Mars'];
  
  const intesaMentale = 
    pairScores['Venus-Mercury'] +
    pairScores['Sun-Jupiter'] +
    singleScores['Mercury'];
  
  // Map to final scores using Python's logic
  const emoFinale = mapPercentuale(intesaEmotiva / 30);
  const fisFinale = mapPercentuale(intesaFisica / 25);
  const menFinale = mapPercentuale(intesaMentale / 25);
  
  const totalScore = emoFinale + fisFinale + menFinale;
  const accettato = totalScore > 3;
  
  return {
    intesaEmotiva: emoFinale,
    intesaFisica: fisFinale,
    intesaMentale: menFinale,
    totalScore: totalScore,
    accettato: accettato,
    // Keep raw scores for debugging
    rawScores: {
      intesaEmotivaRaw: intesaEmotiva,
      intesaFisicaRaw: intesaFisica,
      intesaMentaleRaw: intesaMentale
    }
  };
}

// ============================================================
// USER CLASSIFICATION (THRESHOLD-BASED)
// ============================================================
function classifyUsers(compatibilityResults) {
  const high = [];
  const medium = [];
  const low = [];
  
  compatibilityResults.forEach(result => {
    const totalScore = result.compatibility.totalScore;
    
    // Classification based on total score
    if (totalScore > 3) {
      high.push(result);
    } else if (totalScore >= 2.5) {
      medium.push(result);
    } else {
      low.push(result);
    }
  });
  
  // Sort each category by total score (DETERMINISTIC)
  const sortByTotal = (a, b) => b.compatibility.totalScore - a.compatibility.totalScore;
  high.sort(sortByTotal);
  medium.sort(sortByTotal);
  low.sort(sortByTotal);
  
  return { high, medium, low };
}

// ============================================================
// RANDOM SELECTION FROM CATEGORY
// ============================================================
function getRandomItems(array, count) {
  if (array.length <= count) {
    return [...array]; // Return all if not enough items
  }
  
  // Fisher-Yates shuffle
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
}

// ============================================================
// OPPOSITE GENDER DETERMINATION
// ============================================================
function getOppositeGender(userGender) {
  if (userGender === 'M') return 'F';
  if (userGender === 'F') return 'M';
  return null;
}

// ============================================================
// CALCULATE AGE FROM DATE OF BIRTH
// ============================================================
function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

// ============================================================
// AGE DIFFERENCE CHECK (NEW)
// ============================================================
function isWithinAgeRange(currentUserAge, otherUserAge, maxDifference = 7) {
  if (currentUserAge === null || otherUserAge === null) return false;
  return Math.abs(currentUserAge - otherUserAge) <= maxDifference;
}

// ============================================================
// FORMAT USER DATA FOR FRONTEND - CORRECTED VERSION
// ============================================================
function formatUserData(result, category, categoryLabel) {
  // Convert scores from 0-4 scale to percentages (0-100)
  const intesaEmotivaPercent = (result.compatibility.intesaEmotiva / 4) * 100;
  const intesaFisicaPercent = (result.compatibility.intesaFisica / 4) * 100;
  const intesaMentalePercent = (result.compatibility.intesaMentale / 4) * 100;
  
  return {
    id: result.user.id,
    name: result.user.name,
    firstName: result.user.firstName || null,  // ✅ AJOUT
    lastName: result.user.lastName || null,
    email: result.user.email,
    gender: result.user.gender,
    age: result.user.age,
    city: result.user.city,
    photos: result.user.photos,
    location: result.user.location,
    statistics: {
      intesaEmotiva: result.compatibility.intesaEmotiva,
      intesaFisica: result.compatibility.intesaFisica,
      intesaMentale: result.compatibility.intesaMentale,
      intesaEmotivaPercent: intesaEmotivaPercent,
      intesaFisicaPercent: intesaFisicaPercent,
      intesaMentalePercent: intesaMentalePercent,
      totalScore: result.compatibility.totalScore,
      accettato: result.compatibility.accettato
    },
    category,
    categoryLabel
  };
}

// ============================================================
// DIAGNOSTIC ENDPOINT - Pour voir la distribution des scores
// ============================================================
exports.getCompatibilityDiagnostics = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    
    if (!currentUser || !currentUser.dateOfBirth || !currentUser.location?.coordinates) {
      return res.status(400).json({ 
        success: false, 
        message: 'Données utilisateur incomplètes' 
      });
    }
    
    const [userLongitude, userLatitude] = currentUser.location.coordinates;
    const currentUserPositions = calculatePlanetaryPositions(
      currentUser.dateOfBirth,
      userLatitude,
      userLongitude
    );
    
    const targetGender = getOppositeGender(currentUser.gender);
    // Calculate current user's age
    const currentUserAge = calculateAge(currentUser.dateOfBirth);
    
    if (!currentUserAge) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot calculate age from date of birth' 
      });
    }
    
    const searchFilter = {
      _id: { $ne: currentUser._id },
      dateOfBirth: { $exists: true, $ne: null },
      'location.coordinates': { $exists: true }
    };
    
    if (currentUser.gender === 'M' || currentUser.gender === 'F') {
      searchFilter.gender = targetGender;
    }
    
    const allUsers = await User.find(searchFilter)
      .select('name email dateOfBirth location gender');
    
    const compatibilityResults = [];
    const filteredByAge = [];
    
    for (const user of allUsers) {
      try {
        // Calculate user's age
        const userAge = calculateAge(user.dateOfBirth);
        
        // Check age difference
        if (!isWithinAgeRange(currentUserAge, userAge)) {
          filteredByAge.push({ name: user.name, age: userAge });
          continue;
        }
        
        const [otherLongitude, otherLatitude] = user.location.coordinates;
        const otherUserPositions = calculatePlanetaryPositions(
          user.dateOfBirth,
          otherLatitude,
          otherLongitude
        );
        
        const compatibility = calculateCompatibility(currentUserPositions, otherUserPositions);
        
        compatibilityResults.push({
          name: user.name,
          id: user._id,
          age: userAge,
          compatibility
        });
      } catch (error) {
        console.error(`Error for ${user.name}:`, error.message);
      }
    }
    
    // Classifier
    const { high, medium, low } = classifyUsers(
      compatibilityResults.map(r => ({
        user: { id: r.id, name: r.name, age: r.age },
        compatibility: r.compatibility
      }))
    );
    
    // Créer un résumé détaillé
    const detailedResults = compatibilityResults
      .sort((a, b) => b.compatibility.totalScore - a.compatibility.totalScore)
      .map(r => ({
        name: r.name,
        age: r.age,
        scores: {
          emotiva: `${r.compatibility.intesaEmotiva}/4`,
          fisica: `${r.compatibility.intesaFisica}/4`,
          mentale: `${r.compatibility.intesaMentale}/4`,
          total: `${r.compatibility.totalScore}/12`,
          accettato: r.compatibility.accettato ? 'SI' : 'NO'
        },
        category: high.find(h => h.user.name === r.name) ? 'HIGH' :
                  medium.find(m => m.user.name === r.name) ? 'MEDIUM' : 'LOW'
      }));
    
    res.status(200).json({
      success: true,
      currentUser: {
        age: currentUserAge
      },
      totalUsers: allUsers.length,
      filteredByAge: {
        count: filteredByAge.length,
        users: filteredByAge
      },
      afterAgeFilter: compatibilityResults.length,
      classification: {
        high: high.length,
        medium: medium.length,
        low: low.length
      },
      thresholds: {
        high: 'Total > 3',
        medium: 'Total >= 2.5 (but <= 3)',
        low: 'Total < 2.5'
      },
      statistics: {
        averageScores: {
          emotiva: (compatibilityResults.reduce((s, r) => s + r.compatibility.intesaEmotiva, 0) / compatibilityResults.length).toFixed(2),
          fisica: (compatibilityResults.reduce((s, r) => s + r.compatibility.intesaFisica, 0) / compatibilityResults.length).toFixed(2),
          mentale: (compatibilityResults.reduce((s, r) => s + r.compatibility.intesaMentale, 0) / compatibilityResults.length).toFixed(2),
          total: (compatibilityResults.reduce((s, r) => s + r.compatibility.totalScore, 0) / compatibilityResults.length).toFixed(2)
        },
        highest: Math.max(...compatibilityResults.map(r => r.compatibility.totalScore)),
        lowest: Math.min(...compatibilityResults.map(r => r.compatibility.totalScore))
      },
      allResults: detailedResults
    });
    
  } catch (err) {
    console.error('Diagnostic error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur',
      error: err.message 
    });
  }
};

// ============================================================
// MAIN CONTROLLER
// ============================================================
exports.getCompatibilityResults = async (req, res) => {
  try {
    // Fetch current user
    const currentUser = await User.findById(req.user.id);
    
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Validate required data
    if (!currentUser.dateOfBirth || !currentUser.location || !currentUser.location.coordinates) {
      return res.status(400).json({ 
        success: false, 
        message: 'Birth date or location data missing.' 
      });
    }
    
    if (!currentUser.gender) {
      return res.status(400).json({ 
        success: false, 
        message: 'Gender not defined.' 
      });
    }
    
    // Calculate current user's age
    const currentUserAge = calculateAge(currentUser.dateOfBirth);
    
    if (!currentUserAge) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot calculate age from date of birth.' 
      });
    }
    
    const [userLongitude, userLatitude] = currentUser.location.coordinates;
    
    // Calculate current user's planetary positions
    const currentUserPositions = calculatePlanetaryPositions(
      currentUser.dateOfBirth,
      userLatitude,
      userLongitude
    );
    
    // Determine target gender
    const targetGender = getOppositeGender(currentUser.gender);
    
    // Build search filter
    const searchFilter = {
      _id: { $ne: currentUser._id },
      dateOfBirth: { $exists: true, $ne: null },
      'location.coordinates': { $exists: true }
    };
    
    if (currentUser.gender === 'M' || currentUser.gender === 'F') {
      searchFilter.gender = targetGender;
    } else {
      searchFilter.gender = { $ne: 'Other' };
    }
    
    // Fetch all potential matches
    const allUsers = await User.find(searchFilter)
      .select('name firstName lastName email dateOfBirth location photos gender city');
    
    if (allUsers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No users available',
        highCompatibilityList: [],
        mediumCompatibilityList: [],
        lowCompatibilityList: [],
        summary: { totalReturned: 0 }
      });
    }
    
    // Calculate compatibility with each user (DETERMINISTIC)
    const compatibilityResults = [];
    let filteredByAgeCount = 0;
    
    for (const user of allUsers) {
      try {
        // Calculate user's age from dateOfBirth
        const userAge = calculateAge(user.dateOfBirth);
        
        // Check age difference (NEW CONDITION)
        if (!isWithinAgeRange(currentUserAge, userAge)) {
          filteredByAgeCount++;
          continue;
        }
        
        const [otherLongitude, otherLatitude] = user.location.coordinates;
        
        const otherUserPositions = calculatePlanetaryPositions(
          user.dateOfBirth,
          otherLatitude,
          otherLongitude
        );
        
        const compatibility = calculateCompatibility(currentUserPositions, otherUserPositions);
        
        compatibilityResults.push({
          user: {
            id: user._id,
            name: user.name,
            firstName: user.firstName || null,  // ✅ AJOUT
            lastName: user.lastName || null,
            email: user.email,
            gender: user.gender,
            age: userAge,  // Use calculated age
            city: user.city,
            photos: user.photos,
            location: user.location
          },
          compatibility
        });
      } catch (error) {
        console.error(`Error calculating compatibility for ${user.name}:`, error.message);
      }
    }
    
    if (compatibilityResults.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No compatible users within age range',
        highCompatibilityList: [],
        mediumCompatibilityList: [],
        lowCompatibilityList: [],
        summary: { 
          totalReturned: 0,
          filteredByAge: filteredByAgeCount
        }
      });
    }
    
    // Classify users into categories (DETERMINISTIC)
    const { high, medium, low } = classifyUsers(compatibilityResults);
    
    // Debug logging détaillé
    console.log('\n📊 CLASSIFICATION RESULTS:');
    console.log(`Total users fetched: ${allUsers.length}`);
    console.log(`Filtered by age (±7 years): ${filteredByAgeCount}`);
    console.log(`Users analyzed: ${compatibilityResults.length}`);
    console.log(`High compatibility (>3): ${high.length} users`);
    console.log(`Medium compatibility (2.5-3): ${medium.length} users`);
    console.log(`Low compatibility (<2.5): ${low.length} users`);
    
    // Afficher les statistiques de distribution des scores
    console.log('\n📈 SCORE DISTRIBUTION:');
    const allScores = compatibilityResults.map(r => ({
      name: r.user.name,
      age: r.user.age,
      emotiva: r.compatibility.intesaEmotiva,
      fisica: r.compatibility.intesaFisica,
      mentale: r.compatibility.intesaMentale,
      total: r.compatibility.totalScore,
      accettato: r.compatibility.accettato
    }));
    
    // Trier par score total
    allScores.sort((a, b) => b.total - a.total);
    
    // Afficher TOP 5 et BOTTOM 5
    console.log('TOP 5:');
    allScores.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i+1}. ${s.name} (age ${s.age}): E=${s.emotiva} F=${s.fisica} M=${s.mentale} | Total=${s.total} | Accepted=${s.accettato ? 'SI' : 'NO'}`);
    });
    
    if (allScores.length > 5) {
      console.log('BOTTOM 5:');
      allScores.slice(-5).forEach((s, i) => {
        console.log(`  ${i+1}. ${s.name} (age ${s.age}): E=${s.emotiva} F=${s.fisica} M=${s.mentale} | Total=${s.total} | Accepted=${s.accettato ? 'SI' : 'NO'}`);
      });
    }
    
    if (high.length > 0) {
      console.log('\n🌟 TOP 3 HIGH COMPATIBILITY:');
      high.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i+1}. ${item.user.name} (age ${item.user.age}): Total=${item.compatibility.totalScore}/12`);
        console.log(`     Emotiva=${item.compatibility.intesaEmotiva}, Fisica=${item.compatibility.intesaFisica}, Mentale=${item.compatibility.intesaMentale}`);
      });
    } else {
      console.log('\n⚠️ AUCUN UTILISATEUR HIGH COMPATIBILITY TROUVÉ!');
    }
    
    // Random selection from each category (as per requirements)
    const selectedFromHigh = getRandomItems(high, 5);
    const selectedFromMedium = getRandomItems(medium, 2);
    const selectedFromLow = getRandomItems(low, 3);
    
    // Format data for frontend
    const highList = selectedFromHigh.map(result => 
      formatUserData(result, 'high', 'High Compatibility')
    );
    
    const mediumList = selectedFromMedium.map(result => 
      formatUserData(result, 'medium', 'Medium Compatibility')
    );
    
    const lowList = selectedFromLow.map(result => 
      formatUserData(result, 'low', 'Low Compatibility')
    );
    
    // Send response
    res.status(200).json({
      success: true,
      totalUsersAnalyzed: compatibilityResults.length,
      currentUser: {
        id: currentUser._id,
        name: currentUser.name,
        age: currentUserAge,  // Use calculated age
        location: currentUser.location
      },
      highCompatibilityList: highList,
      mediumCompatibilityList: mediumList,
      lowCompatibilityList: lowList,
      summary: {
        totalFetched: allUsers.length,
        filteredByAge: filteredByAgeCount,
        totalClassified: {
          high: high.length,
          medium: medium.length,
          low: low.length
        },
        totalSelected: {
          high: highList.length,
          medium: mediumList.length,
          low: lowList.length
        },
        totalReturned: highList.length + mediumList.length + lowList.length,
        scoreDistribution: {
          averageEmotiva: (compatibilityResults.reduce((sum, r) => sum + r.compatibility.intesaEmotiva, 0) / compatibilityResults.length).toFixed(2),
          averageFisica: (compatibilityResults.reduce((sum, r) => sum + r.compatibility.intesaFisica, 0) / compatibilityResults.length).toFixed(2),
          averageMentale: (compatibilityResults.reduce((sum, r) => sum + r.compatibility.intesaMentale, 0) / compatibilityResults.length).toFixed(2),
          averageTotal: (compatibilityResults.reduce((sum, r) => sum + r.compatibility.totalScore, 0) / compatibilityResults.length).toFixed(2),
          highestScore: Math.max(...compatibilityResults.map(r => r.compatibility.totalScore)),
          lowestScore: Math.min(...compatibilityResults.map(r => r.compatibility.totalScore))
        }
      }
    });
    
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: err.message 
    });
  }
};

// GET COMPATIBILITY WITH A SPECIFIC USER
exports.getCompatibilityWithUser = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(req.params.userId)
      .select('name firstName lastName dateOfBirth location gender city country photos socialLinks');

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Current user not found' });
    }
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    if (!currentUser.dateOfBirth || !currentUser.location?.coordinates) {
      return res.status(400).json({ success: false, message: 'Current user data incomplete' });
    }
    if (!targetUser.dateOfBirth || !targetUser.location?.coordinates) {
      return res.status(400).json({ success: false, message: 'Target user data incomplete' });
    }

    const [userLon, userLat] = currentUser.location.coordinates;
    const [targetLon, targetLat] = targetUser.location.coordinates;

    const currentPositions = calculatePlanetaryPositions(
      currentUser.dateOfBirth, userLat, userLon
    );
    const targetPositions = calculatePlanetaryPositions(
      targetUser.dateOfBirth, targetLat, targetLon
    );

    const compatibility = calculateCompatibility(currentPositions, targetPositions);

    // Convert to percentages (0–100)
    const intesaEmotivaPercent  = (compatibility.intesaEmotiva  / 4) * 100;
    const intesaFisicaPercent   = (compatibility.intesaFisica   / 4) * 100;
    const intesaMentalePercent  = (compatibility.intesaMentale  / 4) * 100;

    res.status(200).json({
      success: true,
      compatibility: {
        ...compatibility,
        intesaEmotivaPercent,
        intesaFisicaPercent,
        intesaMentalePercent,
      },
    });
  } catch (err) {
    console.error('getCompatibilityWithUser error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};