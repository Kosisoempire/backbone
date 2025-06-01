const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const studentsPath = path.join(__dirname, '../data/students.json');
const resultsPath = path.join(__dirname, '../data/results.json');

router.post('/login', (req, res) => {
  const { regNumber, department } = req.body;

  if (!regNumber) {
    return res.status(400).json({ success: false, message: 'Registration number required' });
  }

  const rawData = fs.readFileSync(studentsPath);
  const students = JSON.parse(rawData);

  if (students.includes(regNumber.trim())) {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid registration number' });
  }
});

router.get('/results/:regNumber', async (req, res) => {
  const reg = req.params.regNumber;
  const db = req.app.locals.db;

  try {
    const snapshot = await db.collection("Results")
      .where("regNumber", "==", reg)
      .limit(1)
      .get();

    res.json({
      hasResult: !snapshot.empty,
      existingResult: snapshot.empty ? null : snapshot.docs[0].data()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;