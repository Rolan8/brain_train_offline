const WORDS = require('./words.json');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Согласование числа с существительным:
//   plural(1, 'столб', 'столба', 'столбов') → 'столб'
//   plural(3, ...)                          → 'столба'
//   plural(7, ...)                          → 'столбов'
//   plural(11, ...)                         → 'столбов' (исключение)
function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// Универсальный хелпер: перемешать копию массива
function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pluralYears = (n) => plural(n, 'год', 'года', 'лет');

// ============================================================
//  АРИФМЕТИКА
// ============================================================
function genArithmetic(difficulty) {
  const ops = difficulty === 1 ? ['+', '-']
            : difficulty === 2 ? ['+', '-', '*']
            : ['+', '-', '*', '/'];

  const op = ops[rand(0, ops.length - 1)];
  let a, b, answer;

  if (op === '+')      { const m = difficulty * 20; a = rand(1, m); b = rand(1, m); answer = a + b; }
  else if (op === '-') { const m = difficulty * 20; a = rand(1, m); b = rand(1, a); answer = a - b; }
  else if (op === '*') { const m = 9 + difficulty * 3; a = rand(2, m); b = rand(2, m); answer = a * b; }
  else { const m = 5 + difficulty * 2; b = rand(2, m); answer = rand(2, m); a = b * answer; }

  const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  return {
    id: uid('arith'),
    category: 'arithmetic',
    difficulty,
    type: 'input',
    question: `${a} ${sym} ${b} = ?`,
    answer,
    explanation: `${a} ${sym} ${b} = ${answer}`
  };
}

// ============================================================
//  ПОСЛЕДОВАТЕЛЬНОСТИ
// ============================================================
function genSequence(difficulty) {
  const steps = [
    { d: 2, start: rand(1, 9) },
    { d: 3, start: rand(1, 9) },
    { d: rand(2, 5), start: rand(1, 9) },
    { mul: 2, start: rand(1, 5) },
    { mul: 3, start: rand(1, 4) }
  ];
  const pick = difficulty === 1 ? steps[rand(0, 1)]
             : difficulty === 2 ? steps[rand(0, 3)]
             : steps[rand(0, steps.length - 1)];

  const seq = [pick.start];
  for (let i = 0; i < 4; i++) {
    const last = seq[seq.length - 1];
    seq.push(pick.mul ? last * pick.mul : last + pick.d);
  }
  const answer = seq.pop();

  return {
    id: uid('seq'),
    category: 'sequence',
    difficulty,
    type: 'input',
    question: `Продолжите ряд: ${seq.join(', ')}, ?`,
    answer,
    explanation: pick.mul ? `Каждое число умножается на ${pick.mul}` : `Каждый раз +${pick.d}`
  };
}

// ============================================================
//  WORDLE
// ============================================================
function genWordle(difficulty) {
  const maxAttempts = difficulty === 1 ? 7
                    : difficulty === 2 ? 6
                    : 5;

  // Нормализуем Ё → Е, чтобы игрок не гадал, ставить ли точки
  const raw = WORDS[rand(0, WORDS.length - 1)];
  const target = raw.toUpperCase().replace(/Ё/g, 'Е');
  const wordLength = target.length;

  return {
    id: uid('wordle'),
    category: 'wordle',
    difficulty,
    type: 'wordle',
    wordLength,
    maxAttempts,
    answer: target,
    question: `Угадайте слово из ${wordLength} букв за ${maxAttempts} попыток`,
    explanation: `Загаданное слово: ${target}`
  };
}

// ============================================================
//  ЛОГИКА — шаблонные генераторы
// ============================================================

// 1. Обратное рассуждение
function genReverseNumber(difficulty) {
  const mult = difficulty === 1 ? 2
             : difficulty === 2 ? rand(2, 3)
             : rand(3, 5);
  const secret = rand(2, 4 + difficulty * 3);
  const add = rand(1, 5 + difficulty * 5);
  const result = secret * mult + add;

  return {
    id: uid('logic-rev'),
    category: 'logic',
    difficulty,
    type: 'input',
    question: `Я задумал число, умножил его на ${mult}, затем прибавил ${add} и получил ${result}. Какое число я задумал?`,
    answer: secret,
    explanation: `Обратные действия: (${result} − ${add}) ÷ ${mult} = ${secret}`
  };
}

// 2. Рукопожатия
function genHandshakes(difficulty) {
  const n = difficulty === 1 ? rand(3, 5)
          : difficulty === 2 ? rand(5, 9)
          : rand(9, 15);
  const answer = (n * (n - 1)) / 2;
  const place = ['В комнате', 'На встрече', 'На вечеринке', 'В классе'][rand(0, 3)];
  const peopleWord = plural(n, 'человек', 'человека', 'человек');

  return {
    id: uid('logic-hs'),
    category: 'logic',
    difficulty,
    type: 'input',
    question: `${place} ${n} ${peopleWord}, и каждый пожал руку каждому ровно один раз. Сколько всего было рукопожатий?`,
    answer,
    explanation: `Каждый из ${n} жмёт руку ${n - 1} другим, но каждое рукопожатие считается дважды: ${n} × ${n - 1} ÷ 2 = ${answer}`
  };
}

// 3. Столбы / фонари / деревья / кусты
function genFencePosts(difficulty) {
  const objects = [
    { forms: ['столб', 'столба', 'столбов'],   verb: 'расставили' },
    { forms: ['фонарь', 'фонаря', 'фонарей'],  verb: 'установили' },
    { forms: ['дерево', 'дерева', 'деревьев'], verb: 'посадили' },
    { forms: ['куст', 'куста', 'кустов'],      verb: 'посадили' }
  ][rand(0, 3)];

  const count = difficulty === 1 ? rand(4, 7)
              : difficulty === 2 ? rand(6, 12)
              : rand(10, 20);
  const step = difficulty === 1 ? rand(2, 5)
             : difficulty === 2 ? rand(5, 15)
             : rand(10, 40);
  const answer = (count - 1) * step;
  const word = plural(count, objects.forms[0], objects.forms[1], objects.forms[2]);

  return {
    id: uid('logic-fence'),
    category: 'logic',
    difficulty,
    type: 'input',
    question: `Вдоль дороги ${objects.verb} ${count} ${word} на равном расстоянии друг от друга. Расстояние между соседними — ${step} м. Каково расстояние от первого до последнего?`,
    answer,
    explanation: `Промежутков на 1 меньше, чем ${word}: (${count} − 1) × ${step} = ${answer} м`
  };
}

// 4. Весы: яблоко — груша — слива
function genBalanceScale(difficulty) {
  const a = rand(2, 3 + difficulty);
  const b = rand(2, 3 + difficulty);
  const c = difficulty === 1 ? rand(2, 3)
          : difficulty === 2 ? rand(2, 5)
          : rand(3, 8);
  const answer = a * b * c;

  const aWord = plural(a, 'груша', 'груши', 'груш');
  const bWord = plural(b, 'слива', 'сливы', 'слив');
  const cWord = plural(c, 'яблоко', 'яблока', 'яблок');

  return {
    id: uid('logic-balance'),
    category: 'logic',
    difficulty,
    type: 'input',
    question: `1 яблоко уравновешивают ${a} ${aWord}, а 1 груша — ${b} ${bWord}. Сколько слив уравновесят ${c} ${cWord}?`,
    answer,
    explanation: `1 яблоко = ${a} × ${b} = ${a * b} слив, значит ${c} ${cWord} = ${c} × ${a * b} = ${answer} слив`
  };
}

// 5. Сумма последовательных чисел
function genConsecutiveSum(difficulty) {
  const k = difficulty === 1 ? 3
          : difficulty === 2 ? rand(3, 4)
          : rand(4, 6);
  const x = rand(2, 4 + difficulty * 3);
  const sum = k * x + (k * (k - 1)) / 2;
  const largest = x + k - 1;

  return {
    id: uid('logic-consec'),
    category: 'logic',
    difficulty,
    type: 'input',
    question: `Сумма ${k} последовательных натуральных чисел равна ${sum}. Найдите наибольшее из них.`,
    answer: largest,
    explanation: `Это числа от ${x} до ${largest} — их сумма действительно равна ${sum}`
  };
}

// 6. Улитка в колодце
function genSnailInWell(difficulty) {
  const climb = difficulty === 2 ? rand(3, 4) : rand(3, 6);
  const slide = rand(1, climb - 1);
  const depth = climb + rand(2, 5) * (climb - slide) + rand(0, climb - slide - 1);
  const days = Math.ceil((depth - climb) / (climb - slide)) + 1;
  const place = ['колодца', 'ямы', 'глубокой канавы'][rand(0, 2)];

  const daysWord = plural(days, 'день', 'дня', 'дней');

  return {
    id: uid('logic-snail'),
    category: 'logic',
    difficulty,
    type: 'input',
    question: `Улитка ползёт из ${place} глубиной ${depth} м. За день она поднимается на ${climb} м, а за ночь сползает на ${slide} м. За сколько дней она выберется?`,
    answer: days,
    explanation: `За сутки улитка прибавляет ${climb} − ${slide} = ${climb - slide} м. К началу последнего дня она будет на высоте ${(days - 1) * (climb - slide)} м, а на ${days}-й день пройдёт оставшиеся ${depth - (days - 1) * (climb - slide)} м и выберется. Ответ: ${days} ${daysWord}`
  };
}

// 7. Возраст: мать и дочь, отец и сын, бабушка и внучка
function genAges(difficulty) {
  const pairs = [
    { dat1: 'Матери',  nom1: 'Мать',    dat2: 'дочери', gen2: 'дочери', label2: 'дочери' },
    { dat1: 'Отцу',    nom1: 'Отец',    dat2: 'сыну',   gen2: 'сына',   label2: 'сыну'   },
    { dat1: 'Бабушке', nom1: 'Бабушка', dat2: 'внучке', gen2: 'внучки', label2: 'внучке' }
  ];
  const p = pairs[rand(0, pairs.length - 1)];

  const diff = difficulty === 2 ? rand(20, 30) : rand(22, 40);
  const childAge = rand(6, 10 + difficulty * 3);
  const sum = diff + childAge * 2;

  const yearsSum  = pluralYears(sum);
  const yearsDiff = pluralYears(diff);

  return {
    id: uid('logic-age'),
    category: 'logic',
    difficulty,
    type: 'input',
    question:
      `${p.dat1} и ${p.dat2} вместе ${sum} ${yearsSum}. ` +
      `${p.nom1} старше ${p.gen2} на ${diff} ${yearsDiff}. ` +
      `Сколько лет ${p.label2}?`,
    answer: childAge,
    explanation:
      `Если бы возраст сравнялся, сумма была бы ${sum} − ${diff} = ${sum - diff}. ` +
      `Делим пополам: ${sum - diff} ÷ 2 = ${childAge} — столько лет ${p.label2}`
  };
}

// 8. Встреча поездов / машин / велосипедистов
function genMeeting(difficulty) {
  const subjects = [
    { num: 'Два', many: 'поезда',        verb: 'выехали' },
    { num: 'Две', many: 'машины',        verb: 'выехали' },
    { num: 'Два', many: 'велосипедиста', verb: 'выехали' }
  ];
  const s = subjects[rand(0, subjects.length - 1)];

  const v1 = rand(3, 8) * (difficulty === 3 ? 10 : 5);
  const v2 = rand(3, 8) * (difficulty === 3 ? 10 : 5);
  const hours = rand(2, 3 + difficulty);
  const distance = (v1 + v2) * hours;
  const from = ['из городов A и B', 'из двух посёлков', 'из пунктов А и Б'][rand(0, 2)];

  const hoursWord = plural(hours, 'час', 'часа', 'часов');

  return {
    id: uid('logic-meet'),
    category: 'logic',
    difficulty,
    type: 'input',
    question: `${s.num} ${s.many} ${s.verb} одновременно навстречу друг другу ${from}, расстояние между которыми ${distance} км. Скорости — ${v1} км/ч и ${v2} км/ч. Через сколько часов они встретятся?`,
    answer: hours,
    explanation: `Скорость сближения: ${v1} + ${v2} = ${v1 + v2} км/ч. Время до встречи: ${distance} ÷ ${v1 + v2} = ${hours} ${hoursWord}`
  };
}

// ============================================================
//  Классические задачи (редкая добавка, ~7% выпадений)
// ============================================================
const LOGIC_STATIC = [
  { difficulty: 1,
    question: 'У Маши 3 яблока, у Пети в 2 раза больше. Сколько всего яблок?',
    options: ['6', '9', '12'], answer: '9',
    explanation: 'У Пети 3 × 2 = 6. Всего 3 + 6 = 9' },

  { difficulty: 1,
    question: 'Что тяжелее: 1 кг ваты или 1 кг железа?',
    options: ['Вата', 'Железо', 'Одинаково'], answer: 'Одинаково',
    explanation: 'Оба весят 1 кг' },

  { difficulty: 1,
    question: 'Продолжите ряд: 2, 4, 6, 8, ?',
    options: ['9', '10', '12'], answer: '10',
    explanation: 'Каждое число больше предыдущего на 2' },

  { difficulty: 2,
    question: 'Продолжите: 1, 1, 2, 3, 5, 8, ?',
    options: ['11', '12', '13', '15'], answer: '13',
    explanation: 'Числа Фибоначчи: каждое = сумма двух предыдущих' },

  { difficulty: 2,
    question: 'Кирпич весит 1 кг плюс полкирпича. Сколько весит кирпич?',
    options: ['1 кг', '1.5 кг', '2 кг'], answer: '2 кг',
    explanation: 'x = 1 + x/2 → x/2 = 1 → x = 2' },

  { difficulty: 2,
    question: 'Сколько месяцев в году содержат 28 дней?',
    options: ['1', '2', '12'], answer: '12',
    explanation: 'В каждом месяце есть как минимум 28 дней' },

  { difficulty: 3,
    question: 'Сколько раз в сутки часовая и минутная стрелки совпадают?',
    options: ['20', '22', '24'], answer: '22',
    explanation: 'Каждые 12 часов — 11 раз, за сутки 22' },

  { difficulty: 3,
    question: 'Отцу и сыну вместе 55 лет. Отец старше сына на 27 лет. Сколько лет сыну?',
    options: ['14', '20', '27'], answer: '14',
    explanation: '(55 − 27) ÷ 2 = 14 — столько лет сыну. Отцу 14 + 27 = 41 год' },

  { difficulty: 3,
    question: 'В корзине 5 яблок. Как раздать их 5 детям, чтобы одно яблоко осталось в корзине?',
    options: ['Никак', 'Отдать одно яблоко вместе с корзиной', 'Разрезать одно яблоко'],
    answer: 'Отдать одно яблоко вместе с корзиной',
    explanation: 'Пятому ребёнку вручают корзину вместе с последним яблоком' },

  { difficulty: 3,
    question: 'На двух руках 10 пальцев. Сколько пальцев на 10 руках?',
    options: ['50', '100', '20'], answer: '50',
    explanation: '10 рук × 5 пальцев = 50' },

  { difficulty: 3,
    question: 'Часы показывают 15:15. Какой угол между часовой и минутной стрелками?',
    options: ['0°', '7.5°', '30°'], answer: '7.5°',
    explanation: 'Минутная на 90°, часовая сдвинулась на 15/60 × 30° = 7.5° от 3-х часов. 90° − (90° − 7.5°) = 7.5°' }
];

// ============================================================
//  ПАМЯТЬ — шаблонные генераторы
// ============================================================

function genMemorySequence(difficulty, reverse = false) {
  const len = difficulty === 1 ? 4
            : difficulty === 2 ? rand(5, 6)
            : rand(7, 8);

  const items = [];
  let prev = -1;
  for (let i = 0; i < len; i++) {
    let d;
    do { d = rand(0, 9); } while (d === prev);
    items.push(d);
    prev = d;
  }

  const duration = 1200 + len * 350;
  const answer = reverse ? [...items].reverse().join('') : items.join('');

  return {
    id: uid(reverse ? 'mem-rev' : 'mem-seq'),
    category: 'memory',
    difficulty,
    type: 'memory',
    memoryType: 'sequence',
    memory: {
      kind: 'digits',
      items,
      duration,
      label: reverse
        ? 'Запомните последовательность. Вводить будете в обратном порядке'
        : 'Запомните последовательность'
    },
    question: reverse
      ? 'Введите цифры в обратном порядке (без пробелов)'
      : 'Введите цифры по порядку (без пробелов)',
    answer,
    explanation: `Показанные цифры: ${items.join(' ')}`
  };
}

function genMemoryGridCount(difficulty) {
  const size = difficulty === 1 ? 3 : 4;
  const uniqueCount = difficulty === 1 ? 3
                    : difficulty === 2 ? 4
                    : 5;

  const POOL = ['⭐', '🍎', '🍋', '🍇', '🌸', '🐱', '🐶', '🦊', '🐻', '🎈'];
  const chosen = shuffleArr(POOL).slice(0, uniqueCount);

  const target = chosen[rand(0, chosen.length - 1)];
  const total = size * size;
  const targetCount = rand(1, Math.min(Math.floor(total / 2), size + 2));

  const cells = [];
  for (let i = 0; i < targetCount; i++) cells.push(target);
  for (let i = targetCount; i < total; i++) {
    const other = chosen.filter(c => c !== target);
    cells.push(other[rand(0, other.length - 1)]);
  }
  const shuffled = shuffleArr(cells);

  const duration = 1800 + total * 120;

  return {
    id: uid('mem-grid-count'),
    category: 'memory',
    difficulty,
    type: 'memory',
    memoryType: 'grid-count',
    memory: {
      kind: 'grid',
      size,
      cells: shuffled,
      duration,
      label: 'Запомните, сколько каких символов'
    },
    question: `Сколько раз встретился символ ${target}?`,
    answer: targetCount,
    explanation: `Символ ${target} встречался ${targetCount} раз(а)`
  };
}

function genMemoryGridMissing(difficulty) {
  const size = difficulty === 1 ? 3 : 4;
  const total = size * size;
  const uniqueCount = difficulty === 1 ? 3 : 4;

  const POOL = ['⭐', '🍎', '🍋', '🍇', '🌸', '🐱', '🐶', '🦊', '🐻', '🎈'];
  const chosen = shuffleArr(POOL).slice(0, uniqueCount);

  const missing = chosen[0];
  const rest = chosen.slice(1);
  const cells = [missing];
  for (let i = 1; i < total; i++) {
    cells.push(rest[(i - 1) % rest.length]);
  }
  const shuffled = shuffleArr(cells);

  const after = [...shuffled];
  after[after.indexOf(missing)] = '';

  const duration = 2000 + total * 120;

  const options = shuffleArr(chosen);

  return {
    id: uid('mem-grid-missing'),
    category: 'memory',
    difficulty,
    type: 'memory',
    memoryType: 'grid-missing',
    memory: {
      kind: 'grid',
      size,
      cells: shuffled,
      duration,
      label: 'Запомните все символы'
    },
    afterMemory: {
      kind: 'grid',
      size,
      cells: after
    },
    question: 'Какой символ пропал?',
    options,
    answer: missing,
    explanation: `Пропал символ ${missing}`
  };
}

function pickMemory(difficulty) {
  if (difficulty === 1) {
    return Math.random() < 0.5 ? genMemorySequence(difficulty) : genMemoryGridCount(difficulty);
  }

  const r = Math.random();
  if (r < 0.35) return genMemorySequence(difficulty, false);
  if (r < 0.60) return genMemorySequence(difficulty, true);
  if (r < 0.80) return genMemoryGridCount(difficulty);
  return genMemoryGridMissing(difficulty);
}

// ============================================================
//  КОНЦЕНТРАЦИЯ — шаблонные генераторы
// ============================================================

function genStroop(difficulty) {
  const COLORS = [
    { name: 'Красный',    hex: '#e74c3c' },
    { name: 'Синий',      hex: '#3498db' },
    { name: 'Зелёный',    hex: '#27ae60' },
    { name: 'Жёлтый',     hex: '#f1c40f' },
    { name: 'Фиолетовый', hex: '#9b59b6' }
  ];

  const optionCount = difficulty === 1 ? 3 : 4;
  const chosen = shuffleArr(COLORS).slice(0, optionCount);

  const word = chosen[rand(0, chosen.length - 1)];
  let ink;
  do {
    ink = chosen[rand(0, chosen.length - 1)];
  } while (ink.name === word.name);

  return {
    id: uid('conc-stroop'),
    category: 'concentration',
    difficulty,
    type: 'choice',
    question: word.name.toUpperCase(),
    questionColor: ink.hex,
    questionHint: 'Кликните на ЦВЕТ текста, а не на само слово',
    options: shuffleArr(chosen.map(c => c.name)),
    answer: ink.name,
    explanation: `Слово «${word.name.toUpperCase()}» написано цветом «${ink.name}»`
  };
}

function genFindDifferent(difficulty) {
  const size = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6;
  const total = size * size;
  const targetIndex = rand(0, total - 1);

  let baseColor, diffColor;
  if (difficulty === 1) {
    const pairs = [
      ['#e74c3c', '#3498db'],
      ['#2ecc71', '#f1c40f'],
      ['#9b59b6', '#1abc9c'],
      ['#e67e22', '#2c3e50']
    ];
    const p = pairs[rand(0, pairs.length - 1)];
    baseColor = p[0];
    diffColor = p[1];
  } else if (difficulty === 2) {
    baseColor = '#3498db';
    diffColor = '#5dade2';
  } else {
    baseColor = '#3498db';
    diffColor = '#3d9bdd';
  }

  const cells = [];
  for (let i = 0; i < total; i++) {
    cells.push(i === targetIndex ? diffColor : baseColor);
  }

  return {
    id: uid('conc-diff'),
    category: 'concentration',
    difficulty,
    type: 'grid-click',
    grid: { size, cells, symbol: '●' },
    question: 'Найдите отличающийся кружок и кликните по нему',
    answer: targetIndex,
    explanation: `Отличающийся кружок — строка ${Math.floor(targetIndex / size) + 1}, столбец ${targetIndex % size + 1}`
  };
}

function genCountLetter(difficulty) {
  const LEN = difficulty === 1 ? 25 : difficulty === 2 ? 40 : 60;
  const LETTERS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЫЭЮЯ';

  const uniqCount = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5;
  const pool = shuffleArr(LETTERS.split('')).slice(0, uniqCount);

  const target = pool[0];
  const others = pool.slice(1);

  const targetCount = rand(3, 6);
  const letters = [];
  for (let i = 0; i < targetCount; i++) letters.push(target);
  while (letters.length < LEN) {
    letters.push(others[rand(0, others.length - 1)]);
  }
  const shuffled = shuffleArr(letters);

  return {
    id: uid('conc-count'),
    category: 'concentration',
    difficulty,
    type: 'input',
    questionHtml:
      `<div class="letter-stream">${shuffled.join('')}</div>` +
      `<div class="sub" style="text-align:center;margin:0 0 14px">Сколько раз встречается буква «${target}»?</div>`,
    question: `Сколько раз встречается буква «${target}»?`,
    answer: targetCount,
    explanation: `Буква «${target}» встречается ${targetCount} раз(а)`
  };
}

function pickConcentration(difficulty) {
  const r = Math.random();
  if (r < 0.4) return genStroop(difficulty);
  if (r < 0.7) return genFindDifferent(difficulty);
  return genCountLetter(difficulty);
}

// ============================================================
//  Реестры генераторов логики
// ============================================================
const LOGIC_EASY_GENERATORS = [
  genReverseNumber,
  genFencePosts
];

const LOGIC_HARD_GENERATORS = [
  genHandshakes,
  genBalanceScale,
  genConsecutiveSum,
  genSnailInWell,
  genAges,
  genMeeting
];

const STATIC_CHANCE = 0.07;

const staticKey = (t, difficulty) => `${difficulty}::${t.question}`;

function pickLogic(difficulty, ctx = {}) {
  const usedStatic = ctx.usedStatic || (ctx.usedStatic = new Set());
  const usedGens   = ctx.usedGenerators || (ctx.usedGenerators = new Set());

  if (Math.random() < STATIC_CHANCE) {
    const pool = LOGIC_STATIC.filter(t =>
      t.difficulty === difficulty && !usedStatic.has(staticKey(t, difficulty))
    );
    if (pool.length) {
      const t = pool[rand(0, pool.length - 1)];
      usedStatic.add(staticKey(t, difficulty));
      return {
        id: uid('logic-static'),
        category: 'logic',
        difficulty,
        type: 'choice',
        question: t.question,
        options: t.options,
        answer: t.answer,
        explanation: t.explanation
      };
    }
  }

  let pool;
  if (difficulty === 1) {
    pool = LOGIC_EASY_GENERATORS;
  } else {
    const useHard = Math.random() < (difficulty === 3 ? 0.75 : 0.5);
    pool = useHard ? LOGIC_HARD_GENERATORS : LOGIC_EASY_GENERATORS;
  }

  const fresh = pool.filter(g => !usedGens.has(g.name));
  const candidates = fresh.length ? fresh : pool;

  const gen = candidates[rand(0, candidates.length - 1)];
  usedGens.add(gen.name);

  if (usedGens.size >= pool.length) usedGens.clear();

  return gen(difficulty);
}

// ============================================================
//  РЕЕСТР ГЕНЕРАТОРОВ ПО КАТЕГОРИЯМ
// ============================================================
const GENERATORS = {
  arithmetic:    genArithmetic,
  sequence:      genSequence,
  logic:         pickLogic,
  memory:        pickMemory,
  concentration: pickConcentration,
  wordle:        genWordle
};

function generateTasks({ category = 'arithmetic', difficulty = 1, count = 10 }) {
  const gen = GENERATORS[category];
  if (!gen) throw new Error(`Unknown category: ${category}`);

  const diff = Number(difficulty);
  const out = [];

  if (category === 'logic') {
    const ctx = {};
    for (let i = 0; i < count; i++) out.push(pickLogic(diff, ctx));
  } else {
    for (let i = 0; i < count; i++) out.push(gen(diff));
  }

  return out;
}

module.exports = { generateTasks, CATEGORIES: Object.keys(GENERATORS) };