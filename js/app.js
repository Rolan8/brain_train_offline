// ============================================================
//  BrainTrainer — клиентская логика (offline)
// ============================================================

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const TIME_PER_TASK = 10;
const TASK_COUNT = 10;
const REFILL_THRESHOLD = 2;
const ADVANCE_DELAY = 1500;
const NEXT_FOCUS_DELAY = 250;

const CATEGORIES = [
  { id: 'math_grid',     name: 'Мат-сетка',     icon: '🎲', endlessOnly: true },
  { id: 'wordle',        name: 'Слова',         icon: '🔤', endlessOnly: true },
  { id: 'memory',        name: 'Память',        icon: '🧠' },
  { id: 'concentration', name: 'Концентрация',  icon: '🎯' },
  { id: 'arithmetic',    name: 'Арифметика',    icon: '➗' },
  { id: 'logic',         name: 'Логика',        icon: '🧩' },
  { id: 'sequence',      name: 'Ряды',          icon: '🔢' }
];

const MODES = [
  { id: 'endless', name: 'Бесконечный', icon: '♾',
    desc: 'Без таймера, до выхода' },
  { id: 'timed',   name: 'На время',    icon: '⏱',
    desc: `${TASK_COUNT} задач · ${TIME_PER_TASK} сек на каждую` }
];

const state = {
  category: 'math_grid',
  difficulty: 1,
  mode: 'endless',
  queue: [],
  current: null,
  answered: 0,
  correct: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  timeLeft: 0,
  timerId: null,
  locked: false,
  _wordleKeyHandler: null
};

const screen = document.getElementById('screen');

// ---------- Утилиты ----------
const bestKey = (cat, diff, mode) => `bt_best_${mode}_${cat}_${diff}`;
const getBest = (cat, diff, mode) =>
  Number(localStorage.getItem(bestKey(cat, diff, mode)) || 0);
const setBest = (cat, diff, mode, v) =>
  localStorage.setItem(bestKey(cat, diff, mode), Math.max(v, getBest(cat, diff, mode)));

function setStats(text) {
  const el = document.getElementById('statsBar');
  if (el) el.textContent = text;
}

// Нормализация букв: верхний регистр + Ё → Е
const normalizeWord = (s) => String(s).toUpperCase().replace(/Ё/g, 'Е');

// ---------- Локальная "API" (замена fetch) ----------
async function fetchTasks(count) {
  return generateTasks({
    category:   state.category,
    difficulty: state.difficulty,
    count
  });
}

// Словарь берётся из глобального массива DICTIONARY_WORDS (dictionary.js).
let wordSetPromise = null;

function loadWords() {
  if (!wordSetPromise) {
    try {
      const set = new Set(DICTIONARY_WORDS.map(w => normalizeWord(w)));
      wordSetPromise = Promise.resolve(set);
    } catch (e) {
      console.error('Не удалось собрать словарь', e);
      wordSetPromise = Promise.resolve(new Set());
    }
  }
  return wordSetPromise;
}

let refillPromise = null;
function loadMore() {
  if (refillPromise) return refillPromise;
  refillPromise = fetchTasks(TASK_COUNT)
    .then(more => { state.queue.push(...more); })
    .catch(e => { console.error('Не удалось подгрузить задачи', e); })
    .finally(() => { refillPromise = null; });
  return refillPromise;
}

// ---------- Меню ----------
function showMenu() {
  document.body.classList.remove('in-game');
  stopTimer();

  if (state._wordleKeyHandler) {
    document.removeEventListener('keydown', state._wordleKeyHandler);
    state._wordleKeyHandler = null;
  }

  state.queue = [];
  state.current = null;
  state.locked = false;
  state.answered = 0;
  state.correct = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;

  const currentCat = CATEGORIES.find(c => c.id === state.category);
  const lockTimed = !!(currentCat && currentCat.endlessOnly);

  screen.innerHTML = `
    <h1>Выберите игру</h1>
    <p class="sub">Настройте параметры и начните.</p>

    <h1 style="font-size:18px;margin:0 0 12px">Режим</h1>
    <div class="grid" id="modes"></div>

    <h1 style="font-size:18px;margin:20px 0 12px">Категория</h1>
    <div class="grid" id="cats"></div>

    <h1 style="font-size:18px;margin:20px 0 12px">Сложность</h1>
    <div class="grid" id="diffs"></div>

    <button class="btn" id="startBtn" style="margin-top:20px">Начать</button>
  `;

  const modes = document.getElementById('modes');
  MODES.forEach(m => {
    const disabled = lockTimed && m.id === 'timed';
    const d = document.createElement('div');
    d.className = `card${state.mode === m.id ? ' active' : ''}${disabled ? ' disabled' : ''}`;
    d.innerHTML = `
      <div class="icon">${m.icon}</div>
      <div class="name">${m.name}</div>
      <div class="sub" style="margin:6px 0 0;font-size:12px">
        ${disabled ? 'Недоступно для этой категории' : m.desc}
      </div>
    `;
    if (!disabled) {
      d.onclick = () => { state.mode = m.id; showMenu(); };
    }
    modes.appendChild(d);
  });

  const cats = document.getElementById('cats');
  CATEGORIES.forEach(c => {
    const d = document.createElement('div');
    d.className = `card${state.category === c.id ? ' active' : ''}`;
    d.innerHTML = `<div class="icon">${c.icon}</div><div class="name">${c.name}</div>`;
    d.onclick = () => {
      state.category = c.id;
      if (c.endlessOnly && state.mode !== 'endless') {
        state.mode = 'endless';
      }
      showMenu();
    };
    cats.appendChild(d);
  });

  const diffs = document.getElementById('diffs');
  [['Легко', 1], ['Средне', 2], ['Сложно', 3]].forEach(([label, lvl]) => {
    const d = document.createElement('div');
    d.className = `card${state.difficulty === lvl ? ' active' : ''}`;
    d.innerHTML = `
      <div class="name">${label}</div>
      <div class="sub" style="margin:6px 0 0;font-size:12px">
        Рекорд: ${getBest(state.category, lvl, state.mode)}
      </div>
    `;
    d.onclick = () => { state.difficulty = lvl; showMenu(); };
    diffs.appendChild(d);
  });

  document.getElementById('startBtn').onclick = startGame;
}

// ---------- Старт сессии ----------
async function startGame() {
  document.body.classList.add('in-game');

  const currentCat = CATEGORIES.find(c => c.id === state.category);
  if (currentCat && currentCat.endlessOnly && state.mode !== 'endless') {
    state.mode = 'endless';
  }

  screen.innerHTML = `<p class="sub" style="text-align:center">Загрузка…</p>`;

  Object.assign(state, {
    queue: [],
    current: null,
    answered: 0,
    correct: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    locked: false
  });

  try {
    state.queue = await fetchTasks(TASK_COUNT);
    nextTask();
  } catch (e) {
    screen.innerHTML = `
      <p class="sub" style="text-align:center">Не удалось загрузить задачи.</p>
      <button class="btn" id="backToMenu">В меню</button>
    `;
    document.getElementById('backToMenu').onclick = showMenu;
  }
}

// ---------- Переход к следующей задаче ----------
function nextTask() {
  if (state.mode === 'timed' && state.answered >= TASK_COUNT) {
    return endGame();
  }

  if (state.queue.length === 0) {
    screen.innerHTML = `<p class="sub" style="text-align:center">Загрузка…</p>`;
    loadMore().then(() => {
      if (state.queue.length) nextTask();
      else endGame();
    });
    return;
  }

  state.current = state.queue.shift();
  renderTask(state.current);

  if (state.mode === 'endless' && state.queue.length <= REFILL_THRESHOLD) {
    loadMore();
  }
}

// ---------- Рендер задачи ----------
function renderTask(task) {
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (task.type === 'memory')    return renderMemoryTask(task);
  if (task.type === 'wordle')    return renderWordleTask(task);
  if (task.type === 'math_grid') return renderMathGridTask(task);

  state.locked = false;

  const isTimed = state.mode === 'timed';
  const current = state.answered + 1;
  const progress = isTimed ? (state.answered / TASK_COUNT) * 100 : 0;

  const counterText = isTimed
    ? `Задача ${current} из ${TASK_COUNT}`
    : `Задача ${current}`;

  const hintHtml = task.questionHint
    ? `<p class="sub" style="text-align:center;margin:0 0 10px">${task.questionHint}</p>`
    : '';

  const qColor = task.questionColor ? ` style="color:${task.questionColor}"` : '';
  const questionBlock = task.questionHtml
    ? task.questionHtml
    : `<div class="question"${qColor}>${task.question}</div>`;

  screen.innerHTML = `
    <div class="task-header">
      <button class="btn-back" id="backBtn" title="Выйти в меню">← В меню</button>
      <span class="task-counter">${counterText}</span>
    </div>
    ${isTimed ? `<div class="progress"><div style="width:${progress}%"></div></div>` : ''}
    ${isTimed ? `<div class="timer">⏱ <span id="time">${TIME_PER_TASK}</span>с</div>` : ''}
    ${hintHtml}
    ${questionBlock}
    <div class="stats" id="statsBar"></div>
    <div id="answerArea"></div>
    <div class="feedback" id="feedback"></div>
  `;

  document.getElementById('backBtn').onclick = exitToMenu;

  const area = document.getElementById('answerArea');

  if (task.type === 'grid-click') {
    renderGridClick(task, area);
  } else if (task.type === 'choice') {
    const wrap = document.createElement('div');
    wrap.className = 'options';
    task.options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'option';
      b.textContent = opt;
      b.onclick = () => submit(opt, b);
      wrap.appendChild(b);
    });
    area.appendChild(wrap);
  } else {
    const row = document.createElement('div');
    row.className = 'input-row';
    row.innerHTML = `
      <input id="ans" type="text" inputmode="numeric" autocomplete="off" placeholder="Ваш ответ">
      <button class="btn" id="okBtn" style="width:auto">OK</button>
    `;
    area.appendChild(row);

    const input = document.getElementById('ans');
    if (!isMobile) input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.repeat) submit(input.value);
    });
    input.addEventListener('paste', e => e.preventDefault());
    document.getElementById('okBtn').onclick = () => submit(input.value);
  }

  setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);

  if (isTimed) startTimer();
}

function renderGridClick(task, area) {
  const { size, cells, symbol } = task.grid;

  const wrap = document.createElement('div');
  wrap.className = 'click-grid';
  wrap.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  cells.forEach((color, i) => {
    const cell = document.createElement('button');
    cell.className = 'click-cell';
    cell.style.color = color;
    cell.textContent = symbol;
    cell.dataset.index = i;
    cell.onclick = () => submit(i, cell);
    wrap.appendChild(cell);
  });

  area.appendChild(wrap);
}

// ---------- Задачи на память ----------

function renderMemoryTask(task) {
  window.scrollTo({ top: 0, behavior: 'instant' });
  stopTimer();
  state.locked = true;

  const isTimed = state.mode === 'timed';
  const current = state.answered + 1;
  const progress = isTimed ? (state.answered / TASK_COUNT) * 100 : 0;

  const counterText = isTimed
    ? `Задача ${current} из ${TASK_COUNT}`
    : `Задача ${current}`;

  screen.innerHTML = `
    <div class="task-header">
      <button class="btn-back" id="backBtn" title="Выйти в меню">← В меню</button>
      <span class="task-counter">${counterText}</span>
    </div>
    ${isTimed ? `<div class="progress"><div style="width:${progress}%"></div></div>` : ''}
    ${isTimed ? `<div class="timer idle" id="timerBar">⏱ <span id="time">${TIME_PER_TASK}</span>с на ответ</div>` : ''}
    <div class="memory-phase">
      <div class="memory-label">${task.memory.label}</div>
      <div class="memory-countdown" id="memCountdown"></div>
      <div class="memory-content" id="memContent">
        ${renderMemoryContent(task.memory)}
      </div>
    </div>
    <div class="stats" id="statsBar"></div>
    <div id="memoryAnswerSlot"></div>
    <div class="feedback" id="feedback"></div>
  `;

  document.getElementById('backBtn').onclick = exitToMenu;

  setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);

  const cdEl = document.getElementById('memCountdown');
  let remaining = Math.ceil(task.memory.duration / 1000);
  if (cdEl) cdEl.textContent = remaining;

  const tick = setInterval(() => {
    remaining--;
    if (cdEl) cdEl.textContent = Math.max(0, remaining);
  }, 1000);

  setTimeout(() => {
    clearInterval(tick);
    if (state.current !== task) return;
    renderMemoryAnswerPhase(task);
  }, task.memory.duration);
}

function renderMemoryContent(mem) {
  if (!mem) return '';
  if (mem.kind === 'digits') {
    return `<div class="memory-digits">${mem.items.join(' ')}</div>`;
  }
  if (mem.kind === 'grid') {
    const cells = mem.cells
      .map(c => `<div class="memory-cell${c ? '' : ' empty'}">${c || ''}</div>`)
      .join('');
    return `<div class="memory-grid" style="grid-template-columns:repeat(${mem.size},1fr)">
      ${cells}
    </div>`;
  }
  return '';
}

function renderMemoryAnswerPhase(task) {
  const phase = document.querySelector('.memory-phase');
  const slot  = document.getElementById('memoryAnswerSlot');
  if (!phase || !slot) return;

  if (task.afterMemory) {
    const label   = phase.querySelector('.memory-label');
    const cd      = phase.querySelector('.memory-countdown');
    const content = phase.querySelector('.memory-content');

    if (label)   label.textContent = 'Один символ исчез…';
    if (cd)      cd.style.display = 'none';
    if (content) content.innerHTML = renderMemoryContent(task.afterMemory);

    const empty = phase.querySelector('.memory-cell.empty');
    if (empty) {
      empty.classList.add('flash');
      setTimeout(() => empty.classList.remove('flash'), 700);
    }
  }

  const AFTER_VISIBLE = task.afterMemory ? 1800 : 400;

  setTimeout(() => {
    if (state.current !== task) return;

    phase.style.display = 'none';

    slot.innerHTML = `
      <div class="question" style="font-size:22px;padding:24px 12px">
        ${task.question}
      </div>
      <div id="answerArea"></div>
    `;

    const area = document.getElementById('answerArea');
    state.locked = false;

    if (task.options && task.options.length) {
      const wrap = document.createElement('div');
      wrap.className = 'options';
      task.options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'option';
        b.textContent = opt;
        b.onclick = () => submit(opt, b);
        wrap.appendChild(b);
      });
      area.appendChild(wrap);
    } else {
      const row = document.createElement('div');
      row.className = 'input-row';
      row.innerHTML = `
        <input id="ans" type="text" inputmode="numeric" autocomplete="off" placeholder="Ваш ответ">
        <button class="btn" id="okBtn" style="width:auto">OK</button>
      `;
      area.appendChild(row);

      const input = document.getElementById('ans');
      if (!isMobile) input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.repeat) submit(input.value);
      });
      input.addEventListener('paste', e => e.preventDefault());
      document.getElementById('okBtn').onclick = () => submit(input.value);
    }

    if (state.mode === 'timed') {
      const bar = document.getElementById('timerBar');
      if (bar) {
        bar.classList.remove('idle');
        bar.classList.add('active');
      }
      startTimer();
    }
  }, AFTER_VISIBLE);
}

// ---------- Math Grid ----------

function renderMathGridTask(task) {
  window.scrollTo({ top: 0, behavior: 'instant' });
  stopTimer();
  state.locked = false;

  const lockedSet   = new Set();
  const selectedSet = new Set();
  let currentTarget = task.target;
  let currentSum    = 0;
  let finished      = false;

  const CELLS = task.grid;
  const TOTAL = CELLS.length;
  const showSum = task.difficulty === 1;
  const headClass = showSum ? 'mg-row-head' : 'mg-row-head mg-row-head--nosum';

  screen.innerHTML = `
    <div class="task-header">
      <button class="btn-back" id="backBtn" title="Выйти в меню">← В меню</button>
      <span class="task-counter">Собрано: <span id="mgLocked">0</span> / ${TOTAL}</span>
    </div>

    <div class="mg-table" id="mgTable">
      <div class="${headClass}">
        <div class="mg-head-title">
          Получи число <span class="mg-target-inline" id="mgTarget">${currentTarget}</span>
        </div>
        ${showSum ? `<div class="mg-head-sum" id="mgSum">0</div>` : ''}
      </div>
      <div class="mg-row-grid" id="mathGrid"></div>
    </div>

    <div class="stats" id="statsBar"></div>

    <div class="math-grid-controls">
      <button class="btn ghost" id="mgReset">Сброс хода</button>
    </div>
    <div class="feedback" id="feedback"></div>
  `;

  document.getElementById('backBtn').onclick = exitToMenu;

  const gridEl        = document.getElementById('mathGrid');
  const targetEl      = document.getElementById('mgTarget');
  const sumEl         = document.getElementById('mgSum');
  const lockedCountEl = document.getElementById('mgLocked');
  const feedback      = document.getElementById('feedback');

  CELLS.forEach((num, i) => {
    const b = document.createElement('button');
    b.className = 'mg-cell';
    b.type = 'button';
    b.textContent = num;
    b.dataset.index = i;
    b.onclick = () => onCellClick(i, b);
    gridEl.appendChild(b);
  });

  const cellEls = Array.from(gridEl.children);

  function updateUI() {
    targetEl.textContent = currentTarget;
    if (sumEl) sumEl.textContent = currentSum;
    lockedCountEl.textContent = lockedSet.size;

    cellEls.forEach((el, i) => {
      el.classList.toggle('locked',   lockedSet.has(i));
      el.classList.toggle('selected', selectedSet.has(i));
      el.disabled = lockedSet.has(i);
    });
  }

  function finalizeVictory() {
    finished = true;
    cellEls.forEach((_, i) => {
      if (!lockedSet.has(i)) lockedSet.add(i);
    });
    updateUI();

    state.answered++;
    state.correct++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    const bonus = 15 * task.difficulty;
    state.score += bonus;
    setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);

    feedback.className = 'feedback ok';
    feedback.textContent = `🏆 Победа! Бонус +${bonus} очков`;
    showNextButton();
  }

  function collectValidTargets() {
    const remaining = [];
    cellEls.forEach((_, i) => {
      if (!lockedSet.has(i)) remaining.push({ i, v: CELLS[i] });
    });

    const valuesSet = new Set(remaining.map(x => x.v));
    const candidates = [];
    const n = remaining.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const s2 = remaining[i].v + remaining[j].v;
        if (!valuesSet.has(s2)) candidates.push(s2);

        for (let k = j + 1; k < n; k++) {
          const s3 = s2 + remaining[k].v;
          if (!valuesSet.has(s3)) candidates.push(s3);
        }
      }
    }
    return { remaining, candidates };
  }

  function generateNewTarget() {
    const { candidates } = collectValidTargets();
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function onCellClick(index, el) {
    if (finished) return;
    if (lockedSet.has(index)) return;
    if (selectedSet.has(index)) return;

    const val = CELLS[index];

    if (currentSum + val > currentTarget) {
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 320);
      return;
    }

    currentSum += val;
    selectedSet.add(index);
    updateUI();

    if (currentSum !== currentTarget) return;

    selectedSet.forEach(i => lockedSet.add(i));
    selectedSet.clear();

    const points = 3 * task.difficulty;
    state.score += points;
    setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);

    feedback.className = 'feedback ok';
    feedback.textContent = `+${points} очков · убрано ${lockedSet.size} из ${TOTAL}`;

    const { remaining } = collectValidTargets();
    if (remaining.length <= 1) {
      finalizeVictory();
      return;
    }

    const nextTarget = generateNewTarget();
    if (nextTarget === null) {
      finalizeVictory();
      return;
    }

    currentTarget = nextTarget;
    currentSum = 0;
    updateUI();
  }

  document.getElementById('mgReset').onclick = () => {
    if (finished) return;
    selectedSet.clear();
    currentSum = 0;
    updateUI();
  };

  updateUI();
  setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);
}

// ---------- Wordle ----------

function renderWordleTask(task) {
  window.scrollTo({ top: 0, behavior: 'instant' });
  stopTimer();
  state.locked = false;

  if (state._wordleKeyHandler) {
    document.removeEventListener('keydown', state._wordleKeyHandler);
    state._wordleKeyHandler = null;
  }

  const LEN = task.wordLength;
  const MAX = task.maxAttempts;
  const TARGET = normalizeWord(task.answer);

  // Сколько раз каждая буква встречается в загаданном слове
  const letterCount = {};
  for (const ch of TARGET) {
    letterCount[ch] = (letterCount[ch] || 0) + 1;
  }

  // Позиции уже отгаданных букв: { 'Ы': 1, 'А': 0, ... }
  const knownCorrect = {};

  const attempts = [];
  let currentGuess = '';
  let finished = false;

  screen.innerHTML = `
    <div class="task-header">
      <button class="btn-back" id="backBtn">← В меню</button>
      <span class="task-counter">Попыток: <span id="attemptsLeft">${MAX}</span></span>
    </div>
    <p class="sub" style="text-align:center">${task.question}</p>
    <div class="wordle-grid" id="wordleGrid"></div>
    <div class="stats" id="statsBar"></div>
    <div class="wordle-keyboard" id="wordleKeyboard"></div>
    <div class="feedback" id="feedback"></div>
  `;

  document.getElementById('backBtn').onclick = exitToMenu;

  const gridEl = document.getElementById('wordleGrid');
  const kbEl = document.getElementById('wordleKeyboard');
  const feedback = document.getElementById('feedback');
  const attemptsLeftEl = document.getElementById('attemptsLeft');

  const CELL_SIZE = 56;
  const CELL_GAP  = 6;
  gridEl.style.maxWidth = `${LEN * CELL_SIZE + (LEN - 1) * CELL_GAP}px`;

  for (let r = 0; r < MAX; r++) {
    const row = document.createElement('div');
    row.className = 'wordle-row';
    row.style.gridTemplateColumns = `repeat(${LEN}, 1fr)`;
    for (let c = 0; c < LEN; c++) {
      const cell = document.createElement('div');
      cell.className = 'wordle-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      row.appendChild(cell);
    }
    gridEl.appendChild(row);
  }

  const KB_ROWS = ['ЙЦУКЕНГШЩЗХЪ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮЁ'];
  KB_ROWS.forEach(letters => {
    const row = document.createElement('div');
    row.className = 'wordle-kb-row';
    letters.split('').forEach(letter => {
      const key = document.createElement('button');
      key.className = 'wordle-key';
      key.textContent = letter;
      key.dataset.key = letter;
      key.onclick = () => handleLetter(letter);
      row.appendChild(key);
    });
    kbEl.appendChild(row);
  });

  const ctrlRow = document.createElement('div');
  ctrlRow.className = 'wordle-kb-row';
  const enterBtn = document.createElement('button');
  enterBtn.className = 'wordle-key wide';
  enterBtn.textContent = 'Ввод';
  enterBtn.onclick = handleEnter;
  const backBtn2 = document.createElement('button');
  backBtn2.className = 'wordle-key wide';
  backBtn2.textContent = '⌫';
  backBtn2.onclick = handleBackspace;
  ctrlRow.appendChild(enterBtn);
  ctrlRow.appendChild(backBtn2);
  kbEl.appendChild(ctrlRow);

  function updateCurrentRow() {
    for (let c = 0; c < LEN; c++) {
      const cell = gridEl.querySelector(
        `.wordle-cell[data-row="${attempts.length}"][data-col="${c}"]`
      );
      if (cell) cell.textContent = currentGuess[c] || '';
    }
  }

  function handleLetter(letter) {
    if (finished || currentGuess.length >= LEN) return;
    currentGuess += letter;
    updateCurrentRow();
  }

  function handleBackspace() {
    if (finished) return;
    currentGuess = currentGuess.slice(0, -1);
    updateCurrentRow();
  }

  async function handleEnter() {
    if (finished) return;

    if (currentGuess.length !== LEN) {
      feedback.className = 'feedback err';
      feedback.textContent = `Нужно слово из ${LEN} букв`;
      return;
    }

    const guess = normalizeWord(currentGuess);

    const words = await loadWords();
    if (words.size > 0 && !words.has(guess)) {
      feedback.className = 'feedback err';
      feedback.textContent = `Слова «${currentGuess}» нет в словаре`;
      return;
    }

    feedback.textContent = '';
    attempts.push(currentGuess);

    const states = new Array(LEN).fill('absent');
    const remaining = TARGET.split('');

    // Шаг 1: точные попадания → correct
    for (let i = 0; i < LEN; i++) {
      if (guess[i] === TARGET[i]) {
        states[i] = 'correct';
        remaining[i] = null;
      }
    }

    // Шаг 2: present / absent / known для остальных букв
    for (let i = 0; i < LEN; i++) {
      if (states[i] === 'correct') continue;

      const letter = guess[i];

      // Если буква уже отгадана ранее и в слове она ровно одна —
      // не подсвечиваем её вне правильной позиции вообще
      if (knownCorrect[letter] !== undefined && letterCount[letter] === 1) {
        states[i] = 'absent';
        continue;
      }

      // Если буква встречается в слове 2+ раза — работает обычная логика:
      // ищем её в remaining и подсвечиваем жёлтым, если ещё есть незакрытые позиции
      const idx = remaining.indexOf(letter);
      if (idx !== -1) {
        states[i] = 'present';
        remaining[idx] = null;
      }
    }

    // Запоминаем новые правильно угаданные буквы
    for (let i = 0; i < LEN; i++) {
      if (states[i] === 'correct') {
        knownCorrect[guess[i]] = i;
      }
    }

    // ----- Отрисовка ячеек -----
    for (let c = 0; c < LEN; c++) {
      const cell = gridEl.querySelector(
        `.wordle-cell[data-row="${attempts.length - 1}"][data-col="${c}"]`
      );
      cell.textContent = currentGuess[c];
      cell.classList.add(states[c]);
    }

    // ----- Отрисовка клавиатуры -----
    const pr = { correct: 3, present: 2, absent: 1 };
    for (let c = 0; c < LEN; c++) {
      const key = kbEl.querySelector(`.wordle-key[data-key="${guess[c]}"]`);
      if (!key) continue;
      const cur = key.dataset.state;
      if (!cur || pr[states[c]] > pr[cur]) {
        key.dataset.state = states[c];
        key.classList.remove('correct', 'present', 'absent');
        key.classList.add(states[c]);
      }
    }

    attemptsLeftEl.textContent = MAX - attempts.length;

    if (guess === TARGET) {
      finished = true;
      setTimeout(() => finishWordle(true), 300);
      return;
    }

    if (attempts.length >= MAX) {
      finished = true;
      setTimeout(() => finishWordle(false), 300);
      return;
    }

    currentGuess = '';
  }

  function finishWordle(won) {
    if (state._wordleKeyHandler) {
      document.removeEventListener('keydown', state._wordleKeyHandler);
      state._wordleKeyHandler = null;
    }

    state.answered++;
    if (won) {
      state.correct++;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      const points = 10 * task.difficulty * 2;
      state.score += points;
      feedback.className = 'feedback ok';
      feedback.textContent = `Угадали за ${attempts.length} попыток! +${points} очков`;
    } else {
      state.streak = 0;
      feedback.className = 'feedback err';
      feedback.textContent = `Не угадали. Слово: ${TARGET}`;
    }
    setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);

    showNextButton();
  }

  const onKeyDown = (e) => {
    if (finished) return;
    if (e.key === 'Enter') { e.preventDefault(); handleEnter(); }
    else if (e.key === 'Backspace') { e.preventDefault(); handleBackspace(); }
    else {
      const k = e.key.toUpperCase();
      if (k.length === 1 && /[А-ЯЁ]/.test(k)) handleLetter(k);
    }
  };
  document.addEventListener('keydown', onKeyDown);
  state._wordleKeyHandler = onKeyDown;

  setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);
}

// ---------- Таймер ----------
function startTimer() {
  stopTimer();
  state.timeLeft = TIME_PER_TASK;
  const el = document.getElementById('time');

  state.timerId = setInterval(() => {
    state.timeLeft--;
    if (el) el.textContent = state.timeLeft;
    if (state.timeLeft <= 0) {
      stopTimer();
      submit(null);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

// ---------- Проверка ответа ----------
function submit(value, btnEl) {
  if (state.locked || !state.current) return;
  state.locked = true;
  stopTimer();

  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  const task = state.current;
  const norm = v =>
    String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/,/g, '.')
      .replace(/\s+/g, '');
  const isCorrect = value !== null && norm(value) === norm(task.answer);

  state.answered++;

  const feedback = document.getElementById('feedback');
  let autoAdvance = true;

  if (isCorrect) {
    state.correct++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    let points = 10 * task.difficulty;
    if (state.mode === 'timed') points += Math.floor(state.timeLeft / 2);
    state.score += points;

    if (btnEl) btnEl.classList.add('correct');
    feedback.className = 'feedback ok';
    feedback.textContent = `Верно! +${points} очков`;
  } else {
    state.streak = 0;
    if (btnEl) btnEl.classList.add('wrong');
    feedback.className = 'feedback err';
    feedback.textContent = value === null
      ? `Время вышло. Ответ: ${task.answer}`
      : `Неверно. Ответ: ${task.answer} — ${task.explanation}`;
    highlightCorrect(task);

    if (state.mode === 'endless') {
      autoAdvance = false;
      showNextButton();
    }
  }

  setStats(`Очки: ${state.score} · Стрик: ${state.streak}`);

  if (autoAdvance) {
    setTimeout(() => {
      if (!state.current) return;
      state.current = null;
      nextTask();
    }, ADVANCE_DELAY);
  }
}

function showNextButton() {
  const feedback = document.getElementById('feedback');
  if (!feedback) return;

  if (feedback.querySelector('.next-btn-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'next-btn-wrap';
  wrap.style.marginTop = '18px';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Далее →';
  btn.onclick = () => {
    if (!state.current) return;
    state.current = null;
    nextTask();
  };
  wrap.appendChild(btn);
  feedback.appendChild(wrap);

  setTimeout(() => btn.focus(), NEXT_FOCUS_DELAY);
}

function highlightCorrect(task) {
  if (task.type === 'choice') {
    document.querySelectorAll('.option').forEach(o => {
      if (o.textContent === String(task.answer)) o.classList.add('correct');
    });
  } else if (task.type === 'grid-click') {
    const cells = document.querySelectorAll('.click-cell');
    const idx = Number(task.answer);
    if (cells[idx]) cells[idx].classList.add('correct');
  }
}

// ---------- Итоги ----------
function endGame() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  stopTimer();
  state.current = null;

  if (state._wordleKeyHandler) {
    document.removeEventListener('keydown', state._wordleKeyHandler);
    state._wordleKeyHandler = null;
  }

  if (state.answered > 0) {
    setBest(state.category, state.difficulty, state.mode, state.score);
  }

  const accuracy = state.answered
    ? Math.round((state.correct / state.answered) * 100)
    : 0;

  const modeLabel = state.mode === 'timed' ? 'На время' : 'Бесконечный';

  screen.innerHTML = `
    <div class="result">
      <h1>Готово!</h1>
      <p class="sub">${modeLabel} · уровень ${state.difficulty}</p>
      <div class="score">${state.score}</div>
      <div class="row">Правильных: ${state.correct} / ${state.answered} (${accuracy}%)</div>
      <div class="row">Лучший стрик: ${state.bestStreak}</div>
      <div class="row">Рекорд в этом режиме: ${getBest(state.category, state.difficulty, state.mode)}</div>
      <div style="margin-top:24px;display:grid;gap:10px">
        <button class="btn" id="again">Ещё раз</button>
        <button class="btn ghost" id="menu">В меню</button>
      </div>
    </div>
  `;

  document.getElementById('again').onclick = startGame;
  document.getElementById('menu').onclick = showMenu;
}

// ---------- Модальное окно подтверждения ----------
function showConfirm({
  title = '',
  message = '',
  confirmText = 'Да',
  cancelText = 'Отмена'
} = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        ${title ? `<div class="modal-title">${title}</div>` : ''}
        <div class="modal-text">${message}</div>
        <div class="modal-actions">
          <button class="btn ghost modal-cancel" type="button">${cancelText}</button>
          <button class="btn modal-confirm" type="button">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let closed = false;
    const cleanup = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 150);
      resolve(result);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    };

    overlay.querySelector('.modal-confirm').onclick = () => cleanup(true);
    overlay.querySelector('.modal-cancel').onclick  = () => cleanup(false);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
    document.addEventListener('keydown', onKey);

    setTimeout(() => overlay.querySelector('.modal-confirm').focus(), 30);
  });
}

// ---------- Выход в меню ----------
async function exitToMenu() {
  if (!state.current && state.queue.length === 0 && state.answered === 0) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    return showMenu();
  }

  if (state.mode === 'endless' && state.answered > 0) {
    const ok = await showConfirm({
      title: 'Завершить сессию?',
      message: 'Показать результат текущей партии?',
      confirmText: 'Показать',
      cancelText: 'Продолжить'
    });
    if (ok) {
      stopTimer();
      state.queue = [];
      endGame();
    }
    return;
  }

  const message = state.answered === 0
    ? 'Прогресс не сохранится.'
    : `Текущий счёт ${state.score} не сохранится.`;

  const ok = await showConfirm({
    title: 'Выйти в меню?',
    message,
    confirmText: 'Выйти',
    cancelText: 'Остаться'
  });
  if (!ok) return;

  stopTimer();
  state.queue = [];
  state.current = null;
  state.locked = true;
  window.scrollTo({ top: 0, behavior: 'instant' });
  showMenu();
}

// ---------- Глобальные шорткаты ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (state.current || state.answered > 0)) {
    exitToMenu();
  }
});

// ---------- Прогрев словаря и старт ----------
loadWords();
showMenu();