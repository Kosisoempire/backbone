const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const studentsPath = path.join(__dirname, '../data/students.json');
const resultsPath = path.join(__dirname, '../data/results.json');

router.post('/login', (req, res) => {
  const { regNumber } = req.body;
  const rawData = fs.readFileSync(studentsPath);
  const students = JSON.parse(rawData);

  // Case 1: Exact match (original validation)
  if (students.includes(regNumber)) {
    return res.json({ success: true });
  }

  // Case 2: Match after removing slashes (new)
  const normalizedReg = regNumber.replace(/\//g, '');
  if (students.some(student => student.replace(/\//g, '') === normalizedReg)) {
    return res.json({ success: true });
  }

  // Case 3: Match year prefix (e.g., "2024" in "2024123456")
  const yearPrefix = regNumber.match(/^\d{4}/)?.[0];
  if (yearPrefix && students.some(student => student.includes(yearPrefix))) {
    return res.json({ success: true });
  }

  res.status(401).json({ success: false, message: 'Invalid registration number' });
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
