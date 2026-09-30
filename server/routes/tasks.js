const express = require('express');
const router = express.Router();

const { generateTasks, CATEGORIES } = require('../data/tasks');
const WORDS = require('../data/words.json');
const russianWords = require('russian-words');

// Набор длин берём из words.json — какие слова загадываем, такие и разрешаем вводить
const LENGTHS = new Set(WORDS.map(w => w.length));

// Большой словарь для проверки: russian-words, нормализованный Ё → Е,
// отфильтрованный по длинам из words.json
const VALID_WORDS = new Set(
  russianWords
    .map(w => w.toUpperCase().replace(/Ё/g, 'Е'))
    .filter(w => LENGTHS.has(w.length))
);

// ---------- Роуты ----------

// Список категорий
router.get('/categories', (req, res) => {
  res.json({ categories: CATEGORIES });
});

// Генерация задач
router.get('/', (req, res) => {
  const { category = 'arithmetic', difficulty = 1, count = 10 } = req.query;
  try {
    const tasks = generateTasks({
      category,
      difficulty: Number(difficulty),
      count: Number(count)
    });
    res.json({ tasks });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Словарь для клиентской проверки Wordle
router.get('/words', (req, res) => {
  res.json({ words: [...VALID_WORDS] });
});

module.exports = router;