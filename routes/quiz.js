const express = require('express');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const { doc, setDoc, getDocs, collection, writeBatch, deleteDoc, serverTimestamp, query, orderBy } = require('firebase/firestore');



const router = express.Router();

const dataDir = path.join(__dirname, '../data');
const questionsPath = path.join(dataDir, 'questions.json');


// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize questions.json
if (!fs.existsSync(questionsPath)) {
  fs.writeFileSync(questionsPath, JSON.stringify([], null, 2));
}


// === GET ALL QUESTIONS ===
router.get("/quiz", (req, res) => {
  try {
    const questions = JSON.parse(fs.readFileSync(questionsPath));
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: "Failed to load questions", details: err.message });
  }
});

// === GET SINGLE QUESTION ===
router.get("/quiz/:id", (req, res) => {
  try {
    const questions = JSON.parse(fs.readFileSync(questionsPath));
    const question = questions.find(q => q.id === req.params.id);

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json(question);
  } catch (err) {
    res.status(500).json({ error: "Failed to load question", details: err.message });
  }
});

// === CREATE NEW QUESTION ===
router.post("/create-quiz", (req, res) => {
  const { question, options, correctAnswer } = req.body;
  if (!question || !options || correctAnswer === undefined) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const questions = JSON.parse(fs.readFileSync(questionsPath));
    const newQuestion = {
      id: Date.now().toString(),
      question,
      options,
      correctAnswer: parseInt(correctAnswer),
      createdAt: new Date().toISOString()
    };
    questions.push(newQuestion);
    fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2));
    res.json({ success: true, question: newQuestion });
  } catch (err) {
    res.status(500).json({ error: "Failed to save question", details: err.message });
  }
});

// === UPDATE QUESTION ===
router.put("/quiz/:id", (req, res) => {
  const { question, options, correctAnswer } = req.body;
  if (!question || !options || correctAnswer === undefined) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const questions = JSON.parse(fs.readFileSync(questionsPath));
    const index = questions.findIndex(q => q.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Question not found" });
    }

    questions[index] = {
      ...questions[index],
      question,
      options,
      correctAnswer: parseInt(correctAnswer),
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2));
    res.json({ success: true, question: questions[index] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update question", details: err.message });
  }
});

// === DELETE QUESTION ===
router.delete("/quiz/:id", (req, res) => {
  try {
    const questions = JSON.parse(fs.readFileSync(questionsPath));
    const filteredQuestions = questions.filter(q => q.id !== req.params.id);

    if (filteredQuestions.length === questions.length) {
      return res.status(404).json({ error: "Question not found" });
    }

    fs.writeFileSync(questionsPath, JSON.stringify(filteredQuestions, null, 2));
    res.json({ success: true, message: "Question deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete question", details: err.message });
  }
});

// === SAVE QUIZ RESULT ===
router.post("/results", async (req, res) => {
  const { regNumber, score, total, department } = req.body;
  const db = req.app.locals.db;

  if (!regNumber || score == null || total == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1. Use current year as default (e.g., "2024")
    let year = new Date().getFullYear().toString();

    // 2. Try to extract year from registration number (works for both formats):
    //    - "ebsu/2023/123" → extracts "2023"
    //    - "2023123" → extracts "2023"
    const yearMatch = regNumber.match(/(^|\/)(\d{4})/);
    if (yearMatch) year = yearMatch[2]; // Use extracted year if found

    // 3. Save to Firestore (two places for easy access):
    //    - Main collection (all results together)
    //    - Year-based collection (organized by year)
    const resultData = {
      regNumber, // Stored exactly as entered
      score,
      total,
      department: department || "N/A",
      timestamp: serverTimestamp(),
      year // Added for easy filtering
    };

    // Save to main collection
    const resultRef = doc(db, "Results", `${regNumber}_${Date.now()}`);
    await setDoc(resultRef, resultData);

    // Also save to year-based collection
    const yearRef = doc(db, "Results", "EBSU", year, `${regNumber}_${Date.now()}`);
    await setDoc(yearRef, resultData);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save result" });
  }
});

// === GET ALL RESULTS ===
router.get("/results", async (req, res) => {
  const db = req.app.locals.db;

  try {
    const resultsSnapshot = await getDocs(query(collection(db, "Results"),
      orderBy("timestamp", "desc")));
    const results = [];
    resultsSnapshot.forEach(doc => results.push(doc.data()));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Could not load results", details: err.message });
  }
});

// === DOWNLOAD AND CLEAR RESULTS ===
// === DOWNLOAD AND CLEAR RESULTS ===
router.get("/results/download-clear", async (req, res) => {
  const db = req.app.locals.db;

  try {
    const resultsSnapshot = await getDocs(collection(db, "Results"));
    if (resultsSnapshot.empty) {
      return res.status(400).json({ error: "No results to export." });
    }

    // Update fields to include fullName
    const fields = ['regNumber', 'fullName', 'department', 'score', 'total', 'timestamp'];
    const parser = new Parser({ fields });
    const results = [];
    resultsSnapshot.forEach(doc => results.push(doc.data()));
    const csv = parser.parse(results);

    const batch = writeBatch(db);
    resultsSnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.header('Content-Type', 'text/csv');
    res.attachment('quiz_results.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "Failed to export results", details: err.message });
  }
});

router.get("/test-data", async (req, res) => {
  try {
    const testData = {
      regNumber: "TEST_001",
      score: 7,
      total: 10,
      department: "Test Department",
      timestamp: new Date().toISOString()
    };
    await setDoc(doc(db, "Results", "test_id"), testData);
    res.send("Test data added!");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// === CHECK IF USER HAS SUBMITTED QUIZ ===
router.get("/results/:regNumber", async (req, res) => {
  try {
    const regNumber = req.params.regNumber;
    const resultDoc = await getDoc(doc(db, "quiz_results", regNumber));

    if (resultDoc.exists()) {
      return res.json({ hasResult: true, result: resultDoc.data() });
    } else {
      return res.json({ hasResult: false });
    }
  } catch (err) {
    console.error("Error fetching result:", err);
    return res.status(500).json({ error: "Failed to fetch result" });
  }
});


module.exports = router;
