require('dotenv').config(); // ⬅️ OBLIGATOIRE

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const connectDB = require('../config/db');
const User = require('../models/User');


faker.locale = 'fr';

const TOTAL_USERS = 1000;

// 🔹 Générer une photo selon le genre
function generateGenderPhoto(gender) {
  if (gender === 'M') {
    return `https://randomuser.me/api/portraits/men/${faker.number.int({ min: 0, max: 99 })}.jpg`;
  }
  if (gender === 'F') {
    return `https://randomuser.me/api/portraits/women/${faker.number.int({ min: 0, max: 99 })}.jpg`;
  }
  return faker.image.avatar();
}

// 🔹 Générer un user complet
function generateUser() {
  const gender = faker.helpers.arrayElement(['M', 'F', 'Other']);

  const firstName = faker.person.firstName(
    gender === 'M' ? 'male' : gender === 'F' ? 'female' : undefined
  );

  const lastName = faker.person.lastName();
  const photoUrl = generateGenderPhoto(gender);

  const createdAt = faker.date.past({ years: 2 });

  return {
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    phone: faker.phone.number(),
    password: 'Password123', // ⚠️ sera hashé par le pre('save')
    gender,
    age: faker.number.int({ min: 18, max: 60 }),
    dateOfBirth: faker.date.birthdate({ min: 18, max: 60, mode: 'age' }),
    bio: faker.lorem.sentence({ min: 5, max: 20 }),
    country: faker.location.country(),
    city: faker.location.city(),

    registrationMethod: faker.helpers.arrayElement(['email', 'google', 'phone']),
    provider: faker.helpers.arrayElement(['local', 'google']),
    emailVerified: faker.datatype.boolean(),
    phoneVerified: faker.datatype.boolean(),
    profileCompleted: true,

    photos: [
      {
        url: photoUrl,
        isMain: true,
        uploadedAt: faker.date.past()
      }
    ],

    avatar: photoUrl,

    preference: {
      genderPreference: faker.helpers.arrayElement(['M', 'F', 'Both']),
      minAge: faker.number.int({ min: 18, max: 30 }),
      maxAge: faker.number.int({ min: 31, max: 60 }),
      distanceMaxKm: faker.number.int({ min: 10, max: 100 })
    },

    location: {
      type: 'Point',
      coordinates: [
        faker.location.longitude(),
        faker.location.latitude()
      ]
    },

    subscription: {
      plan: faker.helpers.arrayElement(['free', 'premium']),
      active: faker.datatype.boolean(),
      duration: faker.helpers.arrayElement(['1month', '3months', '6months']),
      expiresAt: faker.date.future()
    },

    createdAt,
    lastActive: faker.date.between({ from: createdAt, to: new Date() })
  };
}

// 🚀 MAIN FUNCTION
async function seedUsers() {
  try {
    await connectDB();

    console.log('🧹 Suppression des anciens users...');
    await User.deleteMany({});

    console.log(`🚀 Génération de ${TOTAL_USERS} utilisateurs...`);
    const users = [];

    for (let i = 0; i < TOTAL_USERS; i++) {
      users.push(generateUser());
    }

    // ⚠️ utiliser create() pour déclencher pre('save')
    await User.create(users);

    console.log('✅ 1000 fake users insérés avec succès');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur seed:', error);
    process.exit(1);
  }
}

seedUsers();
