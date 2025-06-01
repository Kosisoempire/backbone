const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const settingsPath = path.join(__dirname, '../data/settings.json');

// Initialize settings file if it doesn't exist
if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({
        timer: 5,
        questionsToShow: 10
    }, null, 2));
}

// Get quiz settings
router.get('/quiz-settings', (req, res) => {
    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath));
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: "Failed to load settings", details: err.message });
    }
});

// Update quiz settings
router.post('/quiz-settings', (req, res) => {
    const { timer, questionsToShow } = req.body;

    if (!timer || !questionsToShow) {
        return res.status(400).json({ error: "Missing settings fields" });
    }

    try {
        const settings = {
            timer: parseInt(timer),
            questionsToShow: parseInt(questionsToShow),
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ error: "Failed to save settings", details: err.message });
    }
});

module.exports = router;