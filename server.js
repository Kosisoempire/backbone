const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCB3oLoV2YyX0Io16Ep2rxxbs38W1tIxRo",
  authDomain: "trailquizz.firebaseapp.com",
  projectId: "trailquizz",
  storageBucket: "trailquizz.firebasestorage.app",
  messagingSenderId: "1016471794742",
  appId: "1:1016471794742:web:4214c5184b90113a7d9497"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const settingsRoutes = require('./routes/settings');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize empty files if they don't exist
const files = {
  'students.json': [],
  'questions.json': [],
  'settings.json': { timer: 5, questionsToShow: 10 }
};

Object.entries(files).forEach(([file, defaultContent]) => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
  }
});

app.use('/api', authRoutes);
app.use('/api', quizRoutes);
app.use('/api', settingsRoutes);

// Make db accessible to routes
app.locals.db = db;

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});