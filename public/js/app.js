// ============================================================
//  BrainTrainer — клиентская логика
// ============================================================

const API = '/api/tasks';
const TIME_PER_TASK = 20;
const TASK_COUNT = 10;
const REFILL_THRESHOLD = 2;
const ADVANCE_DELAY = 1500;   // пауза перед автопереходом (мс)
const NEXT_FOCUS_DELAY = 250; // задержка фокуса на кнопке «Далее» (мс)

const CATEGORIES = [
  { id: 'arithmetic', name: 'Арифметика', icon: '➗' },
  { id: 'sequence',   name: 'Ряды',        icon: '🔢' },
  { id: 'logic',      name: 'Логика',      icon: '🧩' },
  { id: 'memory',     name: 'Память',      icon: '🧠' },
  { id: 'concentration', name: 'Концентрация', icon: '🎯'}   
];

const MODES = [
  { id: 'timed',   name: 'На время',    icon: '⏱',
    desc: `${TASK_COUNT} задач · ${TIME_PER_TASK} сек на каждую` },
  { id: 'endless', name: 'Бесконечный', icon: '♾',
    desc: 'Без таймера, до выхода' }
];

const state = {
  category: 'arithmetic',
  difficulty: 1,
  mode: 'timed',
  queue: [],
  current: null,
  answered: 0,
  correct: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  timeLeft: 0,
  timerId: null,
  locked: false
};

const screen = document.getElementById('screen');
const statsBar = document.getElementById('statsBar');

// ---------- Утилиты ----------
const bestKey = (cat, diff, mode) => `bt_best_${mode}_${cat}_${diff}`;
const getBest = (cat, diff, mode) =>
  Number(localStorage.getItem(bestKey(cat, diff, mode)) || 0);
const setBest = (cat, diff, mode, v) =>
  localStorage.setItem(bestKey(cat, diff, mode), Math.max(v, getBest(cat, diff, mode)));

function setStats(text) { statsBar.textContent = text; }

// ---------- API ----------
async function fetchTasks(count) {
  const res = await fetch(
    `${API}?category=${state.category}&difficulty=${state.difficulty}&count=${count}`
  );
  if (!res.ok) throw new Error('Failed to load tasks');
  const data = await res.json();
  return data.tasks;
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
  stopTimer();
  state.queue = [];
  state.current = null;
  state.locked = false;
  state.answered = 0;
  state.correct = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  setStats('');

  screen.innerHTML = `
    <h1>Выберите тренировку</h1>
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
    const d = document.createElement('div');
    d.className = `card${state.mode === m.id ? ' active' : ''}`;
    d.innerHTML = `
      <div class="icon">${m.icon}</div>
      <div class="name">${m.name}</div>
      <div class="sub" style="margin:6px 0 0;font-size:12px">${m.desc}</div>
    `;
    d.onclick = () => { state.mode = m.id; showMenu(); };
    modes.appendChild(d);
  });

  const cats = document.getElementById('cats');
  CATEGORIES.forEach(c => {
    const d = document.createElement('div');
    d.className = `card${state.category === c.id ? ' active' : ''}`;
    d.innerHTML = `<div class="icon">${c.icon}</div><div class="name">${c.name}</div>`;
    d.onclick = () => { state.category = c.id; showMenu(); };
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
  if (task.type === 'memory') return renderMemoryTask(task);

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
    input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.repeat) submit(input.value);
    });
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
// ---------- Задачи на память ----------

function renderMemoryTask(task) {
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
    <div id="memoryAnswerSlot"></div>
    <div class="feedback" id="feedback"></div>
  `;

  document.getElementById('backBtn').onclick = exitToMenu;

  // Обратный отсчёт фазы памяти
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

  // 1) Если есть afterMemory — заменяем содержимое сетки НА МЕСТЕ,
  //    чтобы пользователь сразу увидел, какая клетка опустела
  if (task.afterMemory) {
    const label   = phase.querySelector('.memory-label');
    const cd      = phase.querySelector('.memory-countdown');
    const content = phase.querySelector('.memory-content');

    if (label)   label.textContent = 'Один символ исчез…';
    if (cd)      cd.style.display = 'none';
    if (content) content.innerHTML = renderMemoryContent(task.afterMemory);

    // Короткая вспышка на пустой клетке — притягиваем взгляд
    const empty = phase.querySelector('.memory-cell.empty');
    if (empty) {
      empty.classList.add('flash');
      setTimeout(() => empty.classList.remove('flash'), 700);
    }
  }

  // 2) Даём зафиксировать изменение, затем прячем и спрашиваем
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
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.repeat) submit(input.value);
      });
      document.getElementById('okBtn').onclick = () => submit(input.value);
    }

    // В режиме «на время» таймер стартует только теперь
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

  // Снимаем фокус с input, чтобы автоповтор Enter никуда не прилетел
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

    // В бесконечном режиме даём время прочитать объяснение
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

  const wrap = document.createElement('div');
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

  // Фокус — с небольшой задержкой.
  // Так второй Enter (или автоповтор клавиши) не «промотает» задачу вперёд.
  setTimeout(() => btn.focus(), NEXT_FOCUS_DELAY);
}

function highlightCorrect(task) {
  if (task.type !== 'choice') return;
  document.querySelectorAll('.option').forEach(o => {
    if (o.textContent === String(task.answer)) o.classList.add('correct');
  });
}

// ---------- Итоги ----------
function endGame() {
  stopTimer();
  state.current = null;

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

  setStats('');
  document.getElementById('again').onclick = startGame;
  document.getElementById('menu').onclick = showMenu;
}

// ---------- Выход в меню ----------
function exitToMenu() {
  if (!state.current && state.queue.length === 0 && state.answered === 0) {
    return showMenu();
  }

  if (state.mode === 'endless' && state.answered > 0) {
    if (confirm('Завершить сессию и посмотреть результат?')) {
      stopTimer();
      state.queue = [];
      endGame();
    }
    return;
  }

  const msg = state.answered === 0
    ? 'Выйти в меню? Прогресс не сохранится.'
    : `Выйти в меню? Текущий счёт ${state.score} не сохранится.`;

  if (!confirm(msg)) return;

  stopTimer();
  state.queue = [];
  state.current = null;
  state.locked = true;
  showMenu();
}

// ---------- Глобальные шорткаты ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (state.current || state.answered > 0)) {
    exitToMenu();
  }
});

// ---------- Старт ----------
showMenu();