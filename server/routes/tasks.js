const express = require('express');
const router = express.Router();
const { generateTasks } = require('../data/tasks');
const words = require('../data/words.json');

// Получить список доступных категорий
router.get('/categories', (req, res) => {
  const categories = [
    { id: 'arithmetic', name: 'Арифметика' },
    { id: 'sequence', name: 'Ряды' },
    { id: 'logic', name: 'Логика' },
    { id: 'memory', name: 'Память' },
    { id: 'concentration', name: 'Концентрация' },
    { id: 'wordle', name: 'Слова' },
    { id: 'math_grid', name: 'Математическая сетка' } // Новая категория
  ];
  res.json(categories);
});

// Получить слова для Wordle
router.get('/words', (req, res) => {
  res.json(words);
});

// Генерация задач
router.get('/', (req, res) => {
  const { category, difficulty = 1, count = 10 } = req.query;
  
  try {
    const tasks = generateTasks({
      category,
      difficulty: parseInt(difficulty),
      count: parseInt(count)
    });
    res.json({ tasks });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;