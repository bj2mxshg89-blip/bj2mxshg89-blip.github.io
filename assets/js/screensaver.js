import { getAccountContext } from "./supabase-client.js?v=10";

const cardPairs = [
  {
    id: "grasshopper-class",
    subject: "biology",
    image: "assets/images/screensaver/bio-grasshopper.webp",
    alt: "Кузнечик",
    question: "К какому классу относится изображённое животное?",
    answer: "К классу Насекомые",
    detail: "У кузнечика три пары ног, а тело разделено на голову, грудь и брюшко."
  },
  {
    id: "grasshopper-type",
    subject: "biology",
    image: "assets/images/screensaver/bio-grasshopper.webp",
    alt: "Кузнечик",
    question: "К какому типу относится кузнечик?",
    answer: "К типу Членистоногие",
    detail: "Для членистоногих характерны членистые конечности и наружный хитиновый покров."
  },
  {
    id: "plant-absorption",
    subject: "biology",
    image: "assets/images/screensaver/bio-seedling.webp",
    alt: "Молодое растение с корневой системой",
    question: "Какой орган растения поглощает воду и минеральные вещества?",
    answer: "Корень",
    detail: "Основное поглощение происходит в зоне корневых волосков."
  },
  {
    id: "plant-vegetative",
    subject: "biology",
    image: "assets/images/screensaver/bio-seedling.webp",
    alt: "Молодое растение с корнем и побегом",
    question: "Какие органы растения относятся к вегетативным?",
    answer: "Корень и побег",
    detail: "Они обеспечивают питание, рост и обмен веществ растения."
  },
  {
    id: "ice-process",
    subject: "chemistry",
    image: "assets/images/screensaver/chem-ice-melting.webp",
    alt: "Таяние льда",
    question: "Какой процесс изображён: физический или химический?",
    answer: "Физический процесс",
    detail: "Состав вещества не изменяется: вода остаётся водой, меняется только агрегатное состояние."
  },
  {
    id: "ice-transition",
    subject: "chemistry",
    image: "assets/images/screensaver/chem-ice-melting.webp",
    alt: "Таяние льда",
    question: "Как называется переход вещества из твёрдого состояния в жидкое?",
    answer: "Плавление",
    detail: "Для воды этот процесс обычно называют таянием льда."
  },
  {
    id: "rust-process",
    subject: "chemistry",
    image: "assets/images/screensaver/chem-rust.webp",
    alt: "Ржавление железа",
    question: "Ржавление железа — физическое или химическое явление?",
    answer: "Химическое явление",
    detail: "Образуются новые вещества — соединения железа, входящие в состав ржавчины."
  },
  {
    id: "rust-sign",
    subject: "chemistry",
    image: "assets/images/screensaver/chem-rust.webp",
    alt: "Два железных гвоздя: чистый и ржавый",
    question: "Какой признак химической реакции хорошо заметен при ржавлении?",
    answer: "Изменение цвета и образование нового вещества",
    detail: "На поверхности железа появляется слой ржавчины с новыми свойствами."
  },
  {
    id: "africa-continent",
    subject: "geography",
    image: "assets/images/screensaver/geo-africa.webp",
    alt: "Рельефная карта Африки",
    question: "Какой материк изображён на рисунке?",
    answer: "Африка",
    detail: "Это второй по площади материк Земли после Евразии."
  },
  {
    id: "africa-lines",
    subject: "geography",
    image: "assets/images/screensaver/geo-africa.webp",
    alt: "Рельефная карта Африки",
    question: "Какой материк пересекают и экватор, и начальный меридиан?",
    answer: "Африка",
    detail: "Материк расположен сразу в Северном, Южном, Западном и Восточном полушариях."
  },
  {
    id: "river-meander",
    subject: "geography",
    image: "assets/images/screensaver/geo-meander.webp",
    alt: "Извилистое русло реки",
    question: "Как называется плавный изгиб речного русла?",
    answer: "Меандр",
    detail: "Меандры особенно характерны для равнинных рек."
  },
  {
    id: "river-banks",
    subject: "geography",
    image: "assets/images/screensaver/geo-meander.webp",
    alt: "Излучина реки",
    question: "На каком берегу излучины течение обычно сильнее размывает породы?",
    answer: "На внешнем, вогнутом берегу",
    detail: "На внутреннем выпуклом берегу течение слабее, поэтому там накапливаются наносы."
  },
  {
    id: "jellyfish-type",
    subject: "biology",
    image: "assets/images/screensaver/bio-jellyfish.webp",
    alt: "Медуза аурелия",
    question: "К какому типу относится медуза?",
    answer: "К типу Кишечнополостные (Стрекающие)"
  },
  {
    id: "jellyfish-class",
    subject: "biology",
    image: "assets/images/screensaver/bio-jellyfish.webp",
    alt: "Медуза аурелия",
    question: "К какому классу относится медуза аурелия?",
    answer: "К классу Сцифоидные"
  },
  {
    id: "snail-type",
    subject: "biology",
    image: "assets/images/screensaver/bio-snail.webp",
    alt: "Наземная улитка",
    question: "К какому типу относится улитка?",
    answer: "К типу Моллюски"
  },
  {
    id: "snail-class",
    subject: "biology",
    image: "assets/images/screensaver/bio-snail.webp",
    alt: "Наземная улитка",
    question: "К какому классу относится улитка?",
    answer: "К классу Брюхоногие"
  },
  {
    id: "frog-type",
    subject: "biology",
    image: "assets/images/screensaver/bio-frog.webp",
    alt: "Лягушка",
    question: "К какому типу относится лягушка?",
    answer: "К типу Хордовые"
  },
  {
    id: "frog-class",
    subject: "biology",
    image: "assets/images/screensaver/bio-frog.webp",
    alt: "Лягушка",
    question: "К какому классу относится лягушка?",
    answer: "К классу Земноводные"
  },
  {
    id: "owl-type",
    subject: "biology",
    image: "assets/images/screensaver/bio-owl.webp",
    alt: "Филин",
    question: "К какому типу относится филин?",
    answer: "К типу Хордовые"
  },
  {
    id: "owl-class",
    subject: "biology",
    image: "assets/images/screensaver/bio-owl.webp",
    alt: "Филин",
    question: "К какому классу относится филин?",
    answer: "К классу Птицы"
  },
  {
    id: "flag-japan-country",
    subject: "geography",
    image: "assets/images/screensaver/flag-japan.svg",
    alt: "Флаг Японии",
    question: "Флаг какой страны изображён?",
    answer: "Япония"
  },
  {
    id: "flag-japan-capital",
    subject: "geography",
    image: "assets/images/screensaver/flag-japan.svg",
    alt: "Флаг Японии",
    question: "Назовите столицу Японии.",
    answer: "Токио"
  },
  {
    id: "flag-france-country",
    subject: "geography",
    image: "assets/images/screensaver/flag-france.svg",
    alt: "Флаг Франции",
    question: "Флаг какой страны изображён?",
    answer: "Франция"
  },
  {
    id: "flag-france-capital",
    subject: "geography",
    image: "assets/images/screensaver/flag-france.svg",
    alt: "Флаг Франции",
    question: "Назовите столицу Франции.",
    answer: "Париж"
  },
  {
    id: "flag-germany-country",
    subject: "geography",
    image: "assets/images/screensaver/flag-germany.svg",
    alt: "Флаг Германии",
    question: "Флаг какой страны изображён?",
    answer: "Германия"
  },
  {
    id: "flag-germany-capital",
    subject: "geography",
    image: "assets/images/screensaver/flag-germany.svg",
    alt: "Флаг Германии",
    question: "Назовите столицу Германии.",
    answer: "Берлин"
  },
  {
    id: "flag-italy-country",
    subject: "geography",
    image: "assets/images/screensaver/flag-italy.svg",
    alt: "Флаг Италии",
    question: "Флаг какой страны изображён?",
    answer: "Италия"
  },
  {
    id: "flag-italy-capital",
    subject: "geography",
    image: "assets/images/screensaver/flag-italy.svg",
    alt: "Флаг Италии",
    question: "Назовите столицу Италии.",
    answer: "Рим"
  },
  {
    id: "darwin-name",
    subject: "biology",
    image: "assets/images/screensaver/scientist-darwin.webp",
    alt: "Портрет Чарлза Дарвина",
    question: "Какой учёный изображён на портрете?",
    answer: "Чарлз Дарвин"
  },
  {
    id: "darwin-theory",
    subject: "biology",
    image: "assets/images/screensaver/scientist-darwin.webp",
    alt: "Портрет Чарлза Дарвина",
    question: "Какую теорию разработал Чарлз Дарвин?",
    answer: "Теорию эволюции путём естественного отбора"
  },
  {
    id: "linnaeus-name",
    subject: "biology",
    image: "assets/images/screensaver/scientist-linnaeus.webp",
    alt: "Портрет Карла Линнея",
    question: "Какой учёный изображён на портрете?",
    answer: "Карл Линней"
  },
  {
    id: "linnaeus-nomenclature",
    subject: "biology",
    image: "assets/images/screensaver/scientist-linnaeus.webp",
    alt: "Портрет Карла Линнея",
    question: "Какую систему научного именования видов ввёл в широкую практику Карл Линней?",
    answer: "Бинарную номенклатуру"
  },
  {
    id: "mendeleev-name",
    subject: "chemistry",
    image: "assets/images/screensaver/scientist-mendeleev.webp",
    alt: "Портрет Дмитрия Менделеева",
    question: "Какой учёный изображён на портрете?",
    answer: "Дмитрий Иванович Менделеев"
  },
  {
    id: "mendeleev-law",
    subject: "chemistry",
    image: "assets/images/screensaver/scientist-mendeleev.webp",
    alt: "Портрет Дмитрия Менделеева",
    question: "Какой фундаментальный закон открыл Д. И. Менделеев?",
    answer: "Периодический закон химических элементов"
  },
  {
    id: "lomonosov-name",
    subject: "chemistry",
    image: "assets/images/screensaver/scientist-lomonosov.webp",
    alt: "Портрет Михаила Ломоносова",
    question: "Какой учёный изображён на портрете?",
    answer: "Михаил Васильевич Ломоносов"
  },
  {
    id: "lomonosov-law",
    subject: "chemistry",
    image: "assets/images/screensaver/scientist-lomonosov.webp",
    alt: "Портрет Михаила Ломоносова",
    question: "Какой закон химии сформулировал М. В. Ломоносов?",
    answer: "Закон сохранения массы веществ"
  }
];

const elements = Object.fromEntries([
  "accessGate", "launcher", "settingsForm", "questionDuration", "settingsError", "show", "stage",
  "slide", "slideImage", "slideText", "timer", "timerLabel", "timerValue", "progress", "controls",
  "fatalError", "fatalErrorText"
].map((id) => [id, document.getElementById(id)]));

const subjectThemes = {
  biology: "theme-biology",
  chemistry: "theme-chemistry",
  geography: "theme-geography"
};

let deck = [];
let pairIndex = 0;
let phase = "question";
let questionDurationMs = 20000;
const answerDurationMs = 6000;
let phaseStartedAt = 0;
let pausedElapsed = 0;
let playing = true;
let frameId = 0;
let controlsTimer = 0;
let wakeLock = null;
let touchStartX = null;

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function selectedSubjects() {
  return [...elements.settingsForm.querySelectorAll('input[name="subject"]:checked')]
    .map((input) => input.value);
}

function savePreferences(subjects, questionDuration) {
  try {
    localStorage.setItem("teacherScreensaverSettings", JSON.stringify({
      version: 2,
      subjects,
      questionDuration
    }));
  } catch (_) {
    // The presentation also works when local storage is disabled.
  }
}

function restorePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("teacherScreensaverSettings") || "null");
    if (!saved) return;
    const allowed = new Set(saved.subjects || []);
    elements.settingsForm.querySelectorAll('input[name="subject"]').forEach((input) => {
      input.checked = allowed.has(input.value);
    });
    const legacyDurations = { "30": "15", "40": "20", "60": "30" };
    const duration = saved.version === 2
      ? String(saved.questionDuration)
      : legacyDurations[String(saved.duration)];
    if (["15", "20", "30"].includes(duration)) {
      elements.questionDuration.value = duration;
    }
  } catch (_) {
    // Ignore malformed local preferences.
  }
}

function currentPair() {
  return deck[pairIndex] || deck[0] || cardPairs[0];
}

function animateSlide() {
  elements.slide.classList.remove("is-changing");
  void elements.slide.offsetWidth;
  elements.slide.classList.add("is-changing");
}

function renderSlide() {
  const pair = currentPair();
  const isAnswer = phase === "answer";
  elements.slide.className = `screensaver-slide ${subjectThemes[pair.subject]}${isAnswer ? " is-answer" : ""}`;
  elements.slideImage.src = pair.image;
  elements.slideImage.alt = pair.alt;
  elements.slideText.textContent = isAnswer ? pair.answer : pair.question;
  const revealButton = elements.controls.querySelector('[data-action="reveal"]');
  revealButton.textContent = isAnswer ? "Вернуть вопрос" : "Показать ответ";
  animateSlide();
}

function resetPhase(nextPhase = "question") {
  phase = nextPhase;
  pausedElapsed = 0;
  phaseStartedAt = performance.now();
  renderSlide();
  updateTiming(0);
  if (playing) startTicker();
}

function nextPair() {
  if (!deck.length) return;
  pairIndex += 1;
  if (pairIndex >= deck.length) {
    deck = shuffled(deck);
    pairIndex = 0;
  }
  resetPhase("question");
}

function previousPair() {
  if (!deck.length) return;
  pairIndex = (pairIndex - 1 + deck.length) % deck.length;
  resetPhase("question");
}

function toggleReveal() {
  resetPhase(phase === "question" ? "answer" : "question");
}

function currentPhaseDurationMs() {
  return phase === "question" ? questionDurationMs : answerDurationMs;
}

function updateTiming(elapsed) {
  const duration = currentPhaseDurationMs();
  const remainingSeconds = Math.max(0, Math.ceil((duration - elapsed) / 1000));
  const phaseLabel = phase === "question" ? "Вопрос" : "Ответ";
  const line = elements.progress.querySelector("span");
  line.style.transform = `scaleX(${Math.max(0, Math.min(1, elapsed / duration))})`;
  elements.timer.dataset.phase = phase;
  elements.timerLabel.textContent = phaseLabel;
  elements.timerValue.textContent = `00:${String(remainingSeconds).padStart(2, "0")}`;
  elements.timer.setAttribute("aria-label", `${phaseLabel}: осталось ${remainingSeconds} секунд`);
}

function tick(now) {
  if (!playing) return;
  const elapsed = now - phaseStartedAt;
  const duration = currentPhaseDurationMs();
  updateTiming(elapsed);
  if (elapsed >= duration) {
    if (phase === "question") resetPhase("answer");
    else nextPair();
    return;
  }
  frameId = requestAnimationFrame(tick);
}

function startTicker() {
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(tick);
}

function setPlaying(next) {
  if (playing === next) return;
  playing = next;
  const toggle = elements.controls.querySelector('[data-action="toggle"]');
  toggle.textContent = playing ? "Пауза" : "Продолжить";
  if (playing) {
    phaseStartedAt = performance.now() - pausedElapsed;
    startTicker();
    scheduleControlsHide();
  } else {
    pausedElapsed = Math.min(currentPhaseDurationMs(), performance.now() - phaseStartedAt);
    cancelAnimationFrame(frameId);
    showControls(false);
  }
}

function showControls(autoHide = true) {
  elements.stage.classList.remove("is-controls-hidden");
  window.clearTimeout(controlsTimer);
  if (autoHide && playing) scheduleControlsHide();
}

function scheduleControlsHide() {
  window.clearTimeout(controlsTimer);
  controlsTimer = window.setTimeout(() => {
    elements.stage.classList.add("is-controls-hidden");
  }, 2600);
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (_) {
    wakeLock = null;
  }
}

async function enterFullscreen() {
  if (document.fullscreenElement || !elements.stage.requestFullscreen) return;
  try { await elements.stage.requestFullscreen(); } catch (_) { /* Fullscreen can be enabled manually. */ }
}

async function startPresentation(subjects, duration) {
  deck = shuffled(cardPairs.filter((pair) => subjects.includes(pair.subject)));
  pairIndex = 0;
  questionDurationMs = Number(duration) * 1000;
  playing = true;
  elements.controls.querySelector('[data-action="toggle"]').textContent = "Пауза";
  elements.launcher.hidden = true;
  elements.show.hidden = false;
  document.body.classList.add("is-presenting");
  resetPhase("question");
  showControls();
  await enterFullscreen();
  await requestWakeLock();
}

async function exitPresentation() {
  cancelAnimationFrame(frameId);
  window.clearTimeout(controlsTimer);
  if (wakeLock) await wakeLock.release().catch(() => {});
  wakeLock = null;
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  elements.show.hidden = true;
  elements.launcher.hidden = false;
  document.body.classList.remove("is-presenting");
  playing = true;
}

function setupEvents() {
  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const subjects = selectedSubjects();
    if (!subjects.length) {
      elements.settingsError.textContent = "Выберите хотя бы один предмет.";
      return;
    }
    elements.settingsError.textContent = "";
    const duration = Number(elements.questionDuration.value);
    savePreferences(subjects, duration);
    await startPresentation(subjects, duration);
  });

  elements.controls.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "previous") previousPair();
    if (action === "next") nextPair();
    if (action === "toggle") setPlaying(!playing);
    if (action === "reveal") toggleReveal();
    if (action === "exit") await exitPresentation();
    showControls();
  });

  ["pointermove", "pointerdown"].forEach((name) => {
    elements.stage.addEventListener(name, () => showControls());
  });

  elements.stage.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });

  elements.stage.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (delta > 90) previousPair();
    if (delta < -90) nextPair();
    touchStartX = null;
  }, { passive: true });

  window.addEventListener("keydown", async (event) => {
    if (elements.show.hidden) return;
    if (event.code === "Space") { event.preventDefault(); setPlaying(!playing); }
    if (event.key === "ArrowLeft") previousPair();
    if (event.key === "ArrowRight") nextPair();
    if (event.key === "Enter") toggleReveal();
    if (event.key.toLowerCase() === "f") await enterFullscreen();
    if (event.key.toLowerCase() === "x") await exitPresentation();
    showControls();
  });

  document.addEventListener("visibilitychange", () => {
    if (!elements.show.hidden && playing && document.visibilityState === "visible") void requestWakeLock();
  });
}

async function init() {
  setupEvents();
  restorePreferences();
  try {
    const account = await getAccountContext({ refresh: true });
    if (!account.signedIn) {
      window.location.replace("account.html");
      return;
    }
    if (account.profile?.role !== "teacher") {
      window.location.replace("dashboard.html");
      return;
    }
    elements.accessGate.hidden = true;
    elements.launcher.hidden = false;
  } catch (error) {
    console.error(error);
    elements.accessGate.hidden = true;
    elements.fatalErrorText.textContent = error?.message || "Проверьте интернет-соединение и повторите попытку.";
    elements.fatalError.hidden = false;
  }
}

init();
