const express = require('express');
const router = express.Router();
const { generateTasks, CATEGORIES } = require('../data/tasks');

router.get('/categories', (_req, res) => res.json(CATEGORIES));

router.get('/', (req, res) => {
  const { category = 'arithmetic', difficulty = 1, count = 10 } = req.query;
  try {
    const tasks = generateTasks({
      category,
      difficulty: Math.min(3, Math.max(1, Number(difficulty))),
      count: Math.min(50, Math.max(1, Number(count)))
    });
    res.json({ tasks });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;