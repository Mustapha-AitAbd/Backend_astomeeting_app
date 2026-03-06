// 🎯 seeds/generateUsers.js
// Script pour générer 1000 utilisateurs réalistes

// ⚠️ IMPORTANT: Charger les variables d'environnement EN PREMIER
require('dotenv').config();

const axios = require('axios');
const { faker } = require('@faker-js/faker');
const { cloudinary } = require('../config/cloudinary'); // Utilise votre config existante

// Vérifier que Cloudinary est configuré
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ ERREUR: Variables Cloudinary manquantes dans .env');
  console.error('Vérifiez que vous avez:');
  console.error('  - CLOUDINARY_CLOUD_NAME');
  console.error('  - CLOUDINARY_API_KEY');
  console.error('  - CLOUDINARY_API_SECRET');
  process.exit(1);
}

// 📋 Données réalistes
const LOCATIONS = [
  { country: 'Morocco', cities: ['Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tangier', 'Agadir'] },
  { country: 'France', cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes'] },
  { country: 'USA', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle'] },
  { country: 'Canada', cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa'] },
  { country: 'UK', cities: ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Edinburgh'] },
  { country: 'Germany', cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'] },
  { country: 'Spain', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao'] },
  { country: 'Italy', cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence'] }
];

const BIOS = [
  "Passionné de voyages et de nouvelles rencontres 🌍",
  "Amateur de bonne cuisine et de soirées entre amis 🍷",
  "Sportif dans l'âme, toujours partant pour une aventure 🏃",
  "Artiste créatif cherchant l'inspiration partout ✨",
  "Entrepreneur ambitieux avec un cœur d'or 💼",
  "Amoureux de la nature et des randonnées 🏔️",
  "Cinéphile et lecteur assidu 📚🎬",
  "Musicien passionné, la vie est une mélodie 🎵",
  "Yogi et adepte de la méditation 🧘",
  "Gamer le week-end, professionnel en semaine 🎮",
  "Photographe amateur capturant les moments précieux 📸",
  "Chef amateur qui aime expérimenter en cuisine 👨‍🍳",
  "Danseur né, toujours prêt à bouger 💃",
  "Féru de technologie et d'innovation 💻",
  "Simple, authentique et plein de vie ❤️",
  "Aventurier urbain en quête de nouvelles expériences 🌃",
  "Passionné de fitness et de bien-être 💪",
  "Amoureux des animaux et de la vie simple 🐕",
  "Esprit libre qui aime profiter de chaque instant ⚡",
  "Créatif le jour, rêveur la nuit ✨"
];

// 🎲 Fonctions utilitaires
function getRandomLocation() {
  const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const city = location.cities[Math.floor(Math.random() * location.cities.length)];
  return { country: location.country, city };
}

function getCoordinatesForCity(city, country) {
  const coords = {
    'Casablanca': [-7.6163, 33.5731],
    'Rabat': [-6.8498, 33.9716],
    'Marrakech': [-7.9811, 31.6295],
    'Paris': [2.3522, 48.8566],
    'New York': [-74.0060, 40.7128],
    'London': [-0.1276, 51.5074],
    'Toronto': [-79.3832, 43.6532],
    'Berlin': [13.4050, 52.5200],
    'Madrid': [-3.7038, 40.4168],
    'Rome': [12.4964, 41.9028]
  };
  
  if (coords[city]) {
    return [
      coords[city][0] + (Math.random() - 0.5) * 0.1,
      coords[city][1] + (Math.random() - 0.5) * 0.1
    ];
  }
  
  return [(Math.random() - 0.5) * 360, (Math.random() - 0.5) * 180];
}

// 📸 Upload photo sur Cloudinary (utilise votre config existante)
async function uploadPhotoToCloudinary(gender, firstName, lastName) {
  try {
    // API RandomUser.me - photos réalistes gratuites
    const genderParam = gender === 'F' ? 'women' : 'men';
    const randomNum = Math.floor(Math.random() * 99);
    const photoUrl = `https://randomuser.me/api/portraits/${genderParam}/${randomNum}.jpg`;
    
    console.log(`   📸 Téléchargement photo ${genderParam}/${randomNum}...`);
    
    // Télécharger l'image
    const response = await axios.get(photoUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000
    });
    const buffer = Buffer.from(response.data, 'binary');
    
    // Upload via Cloudinary (utilise votre config)
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'dating-app-users',
          public_id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'fill', gravity: 'face' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('   ❌ Erreur upload Cloudinary:', error.message);
            reject(error);
          } else {
            console.log(`   ✅ Photo uploadée: ${result.secure_url.substring(0, 50)}...`);
            resolve(result.secure_url);
          }
        }
      );
      
      uploadStream.end(buffer);
    });
    
  } catch (error) {
    console.error(`   ⚠️  Erreur photo ${firstName} ${lastName}:`, error.message);
    // Fallback: avatar généré
    return `https://ui-avatars.com/api/?name=${firstName}+${lastName}&size=800&background=random&color=fff`;
  }
}

// 👤 Générer un utilisateur
async function generateUser(index) {
  const gender = Math.random() > 0.5 ? 'F' : 'M';
  const firstName = gender === 'F' 
    ? faker.person.firstName('female') 
    : faker.person.firstName('male');
  const lastName = faker.person.lastName();
  const location = getRandomLocation();
  const registrationMethods = ['email', 'google', 'phone'];
  const registrationMethod = registrationMethods[Math.floor(Math.random() * registrationMethods.length)];
  
  console.log(`\n👤 [${index}] Génération: ${firstName} ${lastName} (${gender})`);
  
  // Upload photo
  const photoUrl = await uploadPhotoToCloudinary(gender, firstName, lastName);
  
  // Générer âge et date de naissance cohérents
  const age = faker.number.int({ min: 18, max: 55 });
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - age;
  const dateOfBirth = new Date(
    birthYear,
    faker.number.int({ min: 0, max: 11 }),
    faker.number.int({ min: 1, max: 28 })
  );
  
  // Préférences d'âge réalistes
  const minAge = Math.max(18, age - 10);
  const maxAge = Math.min(60, age + 15);
  
  const user = {
    // Infos de base
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ 
      firstName: firstName.toLowerCase(), 
      lastName: lastName.toLowerCase(),
      provider: faker.helpers.arrayElement(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'])
    }).toLowerCase(),
    gender,
    age,
    dateOfBirth,
    
    // Bio
    bio: BIOS[Math.floor(Math.random() * BIOS.length)],
    
    // Localisation
    country: location.country,
    city: location.city,
    location: {
      type: 'Point',
      coordinates: getCoordinatesForCity(location.city, location.country)
    },
    
    // Contact
    phone: registrationMethod === 'phone' 
      ? faker.phone.number('+212-6########') 
      : undefined,
    registrationMethod,
    
    // Photos
    photos: [{
      url: photoUrl,
      isMain: true,
      uploadedAt: new Date()
    }],
    avatar: photoUrl,
    
    // Authentification
    password: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // Hash de "Password123!"
    googleId: registrationMethod === 'google' ? faker.string.uuid() : undefined,
    provider: registrationMethod === 'google' ? 'google' : 'local',
    
    // Vérifications
    emailVerified: Math.random() > 0.2, // 80%
    phoneVerified: registrationMethod === 'phone' ? Math.random() > 0.3 : false,
    profileCompleted: Math.random() > 0.15, // 85%
    
    // Préférences
    preference: {
      ageRange: {
        min: minAge,
        max: maxAge
      },
      maxDistance: faker.helpers.arrayElement([20, 30, 50, 75, 100]),
      interestedIn: gender === 'F' ? 'M' : 'F'
    },
    
    // Abonnement
    subscription: (() => {
      const isPremium = Math.random() > 0.7; // 30% premium
      if (isPremium) {
        const duration = faker.helpers.arrayElement(['1month', '3months', '6months']);
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + (duration === '1month' ? 1 : duration === '3months' ? 3 : 6));
        
        return {
          plan: 'premium',
          active: true,
          duration,
          expiresAt,
          stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`
        };
      }
      return {
        plan: 'free',
        active: false,
        duration: null,
        expiresAt: null,
        stripeCustomerId: null
      };
    })(),
    
    // Dates
    createdAt: faker.date.past({ years: 1 }),
    lastActive: faker.date.recent({ days: 30 })
  };
  
  console.log(`   ✅ Utilisateur généré`);
  return user;
}

// 🚀 Générer tous les utilisateurs
async function generateUsers(count = 1000) {
  console.log(`\n🚀 Génération de ${count} utilisateurs avec photos Cloudinary...\n`);
  const users = [];
  const startTime = Date.now();
  
  for (let i = 1; i <= count; i++) {
    try {
      const user = await generateUser(i);
      users.push(user);
      
      if (i % 10 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const avg = (elapsed / i).toFixed(1);
        const remaining = ((count - i) * avg / 60).toFixed(1);
        console.log(`\n📊 Progression: ${i}/${count} (${(i/count*100).toFixed(1)}%) - Temps restant: ~${remaining}min\n`);
      }
      
      // Pause pour éviter rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
      
    } catch (error) {
      console.error(`\n❌ Erreur utilisateur ${i}:`, error.message);
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\n✅ ${users.length}/${count} utilisateurs générés en ${totalTime} minutes`);
  
  return users;
}

module.exports = { generateUsers };