import {
  TestLoadError,
  categoryTitle,
  createAttemptId,
  fetchJson,
  formatCount,
  formatDateTime,
  formatDuration,
  getSectionTitle,
  getTestId,
  modeTitle,
  shuffledCopy,
  subjectTitle,
  validateTestDefinition,
  variantTitle
} from "./utils.js?v=10";
import {
  appendHistory,
  clearProgress,
  getSettings,
  loadProgress,
  saveProgress,
  updateSettings
} from "./storage.js?v=10";
import { calculateResult, isAnswerCorrect } from "./grading.js?v=10";
import {
  appendReviewContent,
  questionInstruction,
  renderQuestionContent,
  renderQuestionOptions
} from "./question-renderers.js?v=10";
import {
  createQuestionOptionOrder,
  evaluateAnswer,
  formatCorrectAnswer,
  getAnswerStatus,
  getFeedbackDetails,
  getFeedbackHeading,
  getEmptyAnswer,
  getQuestionMaxPoints,
  hasAnyAnswer,
  incompleteAnswerMessage,
  isAnswerComplete,
  normalizeAnswer,
  normalizeQuestionOptionOrder,
  updateQuestionAnswer
} from "./question-types.js?v=10";
import { createAttemptQuestionOrder, restoreQuestionOrder } from "./attempt-selection.js?v=10";
import { initAccountLinks } from "./account-widget.js?v=10";
import {
  prepareCloudProgress,
  queueCloudProgress,
  removeCloudProgress,
  saveCompletedAttempt
} from "./cloud-storage.js?v=10";
import { assignmentScope } from "./assignment-records.js?v=10";
import { loadAssignmentContext } from "./assignments.js?v=10";

class TrainerEngine {
  constructor() {
    this.testId = null;
    this.test = null;
    this.questionMap = new Map();
    this.savedProgress = { status: "empty", data: null };
    this.selection = { variantId: null, mode: null };
    this.state = null;
    this.cloud = { signedIn: false, status: "local" };
    this.assignment = null;
    this.progressScope = assignmentScope();

    this.elements = Object.fromEntries([
      "loadingPanel", "errorPanel", "errorTitle", "errorMessage", "errorList",
      "trainerHero", "heroSymbol", "heroEyebrow", "heroTitle", "heroDescription", "heroChips",
      "setupPanel", "variantChoices", "modeChoices", "setupStatus", "startAttemptButton",
      "assignmentPanel", "assignmentClass", "assignmentDeadline", "assignmentConfiguration",
      "referencePanel", "referenceTitle", "referenceList", "cloudStatus",
      "historyLink", "introTitle", "introDescription", "resumeCard", "resumeTitle", "resumeText",
      "resumeButton", "discardButton", "workPanel", "questionCounter", "answeredCounter",
      "correctCounter", "correctCounterLabel", "mistakeCounter", "questionNavigation", "backToSetupButton",
      "restartAttemptButton", "navigationLegend", "activeVariantBadge", "activeModeBadge",
      "progressBar", "questionSection", "questionTitle", "questionHint", "answerContainer",
      "questionContent",
      "feedbackPanel", "questionStatus", "previousButton", "primaryButton", "resultPanel",
      "resultVariantBadge", "resultModeBadge", "resultTitle", "resultSubtitle", "resultScore",
      "resultScoreLabel", "resultPercent", "resultGrade", "resultDuration", "repeatMistakesButton", "newAttemptButton",
      "resultHistoryLink", "printResultButton", "reviewContainer"
    ].map((id) => [id, document.getElementById(id)]));
  }

  async init() {
    this.bindStaticEvents();
    void initAccountLinks();

    try {
      this.testId = getTestId();
      const test = await fetchJson(`data/tests/${encodeURIComponent(this.testId)}.json`);
      const validation = validateTestDefinition(test, this.testId);
      if (!validation.valid) {
        throw new TestLoadError("Структура теста не прошла проверку.", validation.errors);
      }

      this.test = test;
      this.questionMap = new Map(test.questions.map((question) => [question.id, question]));
      this.applyTestMetadata();
      this.assignment = await loadAssignmentContext(test);
      this.progressScope = this.assignment?.scope || assignmentScope();
      this.applyAssignmentContext();
      this.prepareSetup();
      this.cloud = await prepareCloudProgress(test, this.progressScope);
      this.updateCloudStatus(this.cloud.status, this.cloud.message);
      this.savedProgress = loadProgress(test, this.progressScope.scopeKey);
      this.renderResumeCard();
      this.showPanel("setup");
    } catch (error) {
      this.showFatalError(error);
    }
  }

  applyAssignmentContext() {
    if (!this.elements.assignmentPanel) return;
    if (!this.assignment) {
      this.elements.assignmentPanel.hidden = true;
      return;
    }

    const variant = this.test.variants.find((item) => item.id === this.assignment.variantId);
    this.elements.assignmentClass.textContent = this.assignment.classroomTitle;
    this.elements.assignmentDeadline.textContent = this.assignment.dueAt
      ? formatDateTime(this.assignment.dueAt)
      : "без срока";
    this.elements.assignmentConfiguration.textContent =
      `${variant?.title || this.assignment.variantId} · ${modeTitle(this.assignment.mode)}`;
    this.elements.assignmentPanel.hidden = false;
  }

  bindStaticEvents() {
    this.elements.startAttemptButton.addEventListener("click", () => this.startSelectedAttempt());
    this.elements.resumeButton.addEventListener("click", () => this.resumeSavedAttempt());
    this.elements.discardButton.addEventListener("click", () => this.discardAndStart());
    this.elements.previousButton.addEventListener("click", () => this.goPrevious());
    this.elements.primaryButton.addEventListener("click", () => this.handlePrimaryAction());
    this.elements.backToSetupButton.addEventListener("click", () => this.returnToSetup());
    this.elements.restartAttemptButton.addEventListener("click", () => this.restartAttempt());
    this.elements.repeatMistakesButton.addEventListener("click", () => this.repeatMistakes());
    this.elements.newAttemptButton.addEventListener("click", () => this.showFreshSetup());
    this.elements.printResultButton.addEventListener("click", () => window.print());
    window.addEventListener("beforeunload", () => this.persistProgress());
  }

  applyTestMetadata() {
    const { test } = this;
    document.title = `${test.title} — Кабинет учителя`;
    document.documentElement.style.setProperty("--trainer-accent", test.theme?.accent || "#c0522b");
    document.documentElement.style.setProperty("--trainer-soft", test.theme?.soft || "#fff0e9");
    document.documentElement.style.setProperty("--trainer-accent-dark", test.theme?.accent || "#833218");

    this.elements.heroSymbol.textContent = test.symbol;
    this.elements.heroEyebrow.textContent = `${categoryTitle(test.category)} · универсальный движок`;
    this.elements.heroTitle.textContent = test.title;
    this.elements.heroDescription.textContent = test.description;
    this.elements.introTitle.textContent = test.title;
    this.elements.introDescription.textContent = test.description;

    const chips = [
      subjectTitle(test.subject),
      categoryTitle(test.category),
      formatCount(test.questions.length, "задание", "задания", "заданий"),
      formatCount(test.variants.length, "вариант", "варианта", "вариантов")
    ];
    this.elements.heroChips.replaceChildren(...chips.map((label) => {
      const chip = document.createElement("span");
      chip.className = "site-hero-chip";
      chip.textContent = label;
      return chip;
    }));

    const historyUrl = `results.html?id=${encodeURIComponent(test.id)}`;
    this.elements.historyLink.href = historyUrl;
    this.elements.resultHistoryLink.href = historyUrl;

    if (test.reference) {
      this.elements.referenceTitle.textContent = test.reference.title;
      this.elements.referenceList.replaceChildren(...test.reference.items.map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      }));
      this.elements.referencePanel.hidden = false;
    } else {
      this.elements.referencePanel.hidden = true;
    }
  }

  prepareSetup() {
    if (this.assignment) {
      this.selection = {
        variantId: this.assignment.variantId,
        mode: this.assignment.mode
      };
      this.renderVariantChoices();
      this.renderModeChoices();
      this.updateSetupStatus();
      return;
    }

    const settings = getSettings();
    const lastSelection = settings.lastSelection?.[this.test.id] || {};
    const defaultVariant = this.test.variants.some((item) => item.id === lastSelection.variantId)
      ? lastSelection.variantId
      : this.test.variants[0].id;
    const enabledModes = ["training", "test"].filter((mode) => this.test.modes[mode].enabled);
    const defaultMode = enabledModes.includes(lastSelection.mode) ? lastSelection.mode : enabledModes[0];

    this.selection = { variantId: defaultVariant, mode: defaultMode };
    this.renderVariantChoices();
    this.renderModeChoices();
    this.updateSetupStatus();
  }

  renderVariantChoices() {
    this.elements.variantChoices.replaceChildren();
    const variants = this.assignment
      ? this.test.variants.filter((variant) => variant.id === this.assignment.variantId)
      : this.test.variants;
    variants.forEach((variant) => {
      const label = document.createElement("label");
      label.className = "trainer-choice";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "test-variant";
      input.value = variant.id;
      input.checked = this.selection.variantId === variant.id;
      input.disabled = Boolean(this.assignment);
      input.addEventListener("change", () => {
        this.selection.variantId = variant.id;
        this.rememberSelection();
        this.updateSetupStatus();
      });

      const body = document.createElement("span");
      body.className = "trainer-choice-body";
      body.textContent = variant.title;
      const count = document.createElement("small");
      const trainingCount = this.variantQuestionCount(variant, "training");
      const testCount = this.variantQuestionCount(variant, "test");
      count.textContent = trainingCount === testCount
        ? formatCount(trainingCount, "задание", "задания", "заданий")
        : `${trainingCount} в тренировке · ${testCount} в тесте`;
      body.appendChild(count);
      label.append(input, body);
      label.classList.toggle("is-locked", Boolean(this.assignment));
      this.elements.variantChoices.appendChild(label);
    });
  }

  renderModeChoices() {
    const descriptions = {
      training: "Проверка и пояснение после каждого ответа",
      test: "Результат и разбор только после завершения"
    };
    this.elements.modeChoices.replaceChildren();

    ["training", "test"].forEach((mode) => {
      if (!this.test.modes[mode].enabled) return;
      if (this.assignment && mode !== this.assignment.mode) return;
      const label = document.createElement("label");
      label.className = "trainer-choice";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "test-mode";
      input.value = mode;
      input.checked = this.selection.mode === mode;
      input.disabled = Boolean(this.assignment);
      input.addEventListener("change", () => {
        this.selection.mode = mode;
        this.rememberSelection();
        this.updateSetupStatus();
      });

      const body = document.createElement("span");
      body.className = "trainer-choice-body";
      body.textContent = modeTitle(mode);
      const description = document.createElement("small");
      description.textContent = descriptions[mode];
      body.appendChild(description);
      label.append(input, body);
      label.classList.toggle("is-locked", Boolean(this.assignment));
      this.elements.modeChoices.appendChild(label);
    });
  }

  updateSetupStatus() {
    const variant = this.test.variants.find((item) => item.id === this.selection.variantId);
    const count = variant ? this.variantQuestionCount(variant, this.selection.mode) : 0;
    this.elements.setupStatus.textContent = variant
      ? `${this.assignment ? "Назначено учителем · " : ""}${variant.title} · ${modeTitle(this.selection.mode)} · ${formatCount(count, "задание", "задания", "заданий")}`
      : "Выберите вариант и режим.";
  }

  variantQuestionCount(variant, mode) {
    return variant.selectionCount?.[mode] || variant.questionIds.length;
  }

  rememberSelection() {
    if (this.assignment) return;
    const settings = getSettings();
    updateSettings({
      lastSelection: {
        ...(settings.lastSelection || {}),
        [this.test.id]: { ...this.selection }
      }
    });
  }

  renderResumeCard() {
    const { resumeCard, resumeButton, discardButton, resumeTitle, resumeText } = this.elements;
    resumeCard.classList.remove("is-incompatible");
    resumeButton.hidden = false;
    discardButton.textContent = "Начать новую";

    if (this.savedProgress.status === "empty") {
      resumeCard.hidden = true;
      return;
    }

    resumeCard.hidden = false;
    if (this.savedProgress.status === "compatible") {
      const saved = this.savedProgress.data;
      const position = Math.max(0, saved.questionOrder.indexOf(saved.currentQuestionId)) + 1;
      resumeTitle.textContent = "Есть незавершённая попытка";
      resumeText.textContent =
        `${variantTitle(this.test, saved.variantId)} · ${modeTitle(saved.mode)} · ` +
        `задание ${position} из ${saved.questionOrder.length}.`;
      return;
    }

    resumeCard.classList.add("is-incompatible");
    resumeButton.hidden = true;
    discardButton.textContent = "Начать новую попытку";
    resumeTitle.textContent = "Сохранение нельзя продолжить";
    resumeText.textContent = `${this.savedProgress.reason} Текущие данные теста не повреждены.`;
  }

  startSelectedAttempt() {
    this.startAttempt({
      variantId: this.selection.variantId,
      mode: this.selection.mode
    });
  }

  discardAndStart() {
    clearProgress(this.test.id, this.progressScope.scopeKey);
    this.savedProgress = { status: "empty", data: null };
    this.startSelectedAttempt();
  }

  startAttempt({ variantId, mode, questionIds = null, retryOf = null, assignmentId = this.assignment?.id || null }) {
    const variant = this.test.variants.find((item) => item.id === variantId);
    if (!variant || !this.test.modes[mode]?.enabled) {
      this.elements.setupStatus.textContent = "Не удалось определить вариант или режим.";
      return;
    }

    clearProgress(this.test.id, this.progressScope.scopeKey);
    void removeCloudProgress(this.test.id, this.progressScope);
    const isRetry = Boolean(questionIds?.length);
    const order = createAttemptQuestionOrder({
      baseQuestionIds: variant.questionIds,
      selectionCount: this.variantQuestionCount(variant, mode),
      shuffleQuestions: this.test.settings.shuffleQuestions,
      retryQuestionIds: isRetry ? questionIds : null
    }, shuffledCopy);
    const optionOrder = Object.fromEntries(order.map((questionId) => {
      const question = this.questionMap.get(questionId);
      const shuffle = (values) => this.test.settings.shuffleAnswers ? shuffledCopy(values) : [...values];
      return [questionId, createQuestionOptionOrder(question, shuffle)];
    }));
    const answers = Object.fromEntries(order.map((questionId) => {
      const question = this.questionMap.get(questionId);
      return [questionId, getEmptyAnswer(question, optionOrder[questionId])];
    }));

    this.selection = { variantId, mode };
    this.rememberSelection();
    this.state = {
      attemptId: createAttemptId(),
      variantId,
      mode,
      baseQuestionIds: [...variant.questionIds],
      questionOrder: order,
      optionOrder,
      current: 0,
      answers,
      checked: new Set(),
      mistakes: new Set(),
      startedAt: new Date().toISOString(),
      retryOf,
      assignmentId,
      completed: false
    };

    this.showPanel("work");
    this.persistProgress();
    this.renderWork();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  resumeSavedAttempt() {
    if (this.savedProgress.status !== "compatible") return;
    const saved = this.savedProgress.data;
    const variant = this.test.variants.find((item) => item.id === saved.variantId);
    const questionOrder = restoreQuestionOrder(saved.questionOrder, variant.questionIds)
      .filter((id) => this.questionMap.has(id));
    const optionOrder = {};
    questionOrder.forEach((questionId) => {
      const question = this.questionMap.get(questionId);
      const candidate = saved.optionOrder?.[questionId];
      optionOrder[questionId] = normalizeQuestionOptionOrder(question, candidate);
    });
    const answers = {};
    questionOrder.forEach((questionId) => {
      const question = this.questionMap.get(questionId);
      answers[questionId] = normalizeAnswer(
        question,
        saved.selectedAnswers?.[questionId],
        optionOrder[questionId]
      );
    });

    const current = Math.max(0, questionOrder.indexOf(saved.currentQuestionId));
    const startedAt = Number.isNaN(new Date(saved.startedAt).getTime())
      ? new Date().toISOString()
      : saved.startedAt;

    this.selection = { variantId: saved.variantId, mode: saved.mode };
    this.state = {
      attemptId: saved.attemptId || createAttemptId(),
      variantId: saved.variantId,
      mode: saved.mode,
      baseQuestionIds: [...variant.questionIds],
      questionOrder,
      optionOrder,
      current,
      answers,
      checked: new Set(Array.isArray(saved.checkedQuestionIds) ? saved.checkedQuestionIds : []),
      mistakes: new Set(Array.isArray(saved.mistakeQuestionIds) ? saved.mistakeQuestionIds : []),
      startedAt,
      retryOf: saved.retryOf || null,
      assignmentId: saved.assignmentId || null,
      completed: false
    };

    this.showPanel("work");
    this.renderWork();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  persistProgress() {
    if (!this.test || !this.state || this.state.completed || !this.test.settings.saveProgress) return;
    const currentQuestionId = this.state.questionOrder[this.state.current] || null;
    const progress = saveProgress(this.test.id, {
      schemaVersion: 1,
      testId: this.test.id,
      testVersion: this.test.version,
      attemptId: this.state.attemptId,
      variantId: this.state.variantId,
      mode: this.state.mode,
      currentQuestion: this.state.current,
      currentQuestionId,
      baseQuestionIds: [...this.state.baseQuestionIds],
      questionIds: [...this.state.questionOrder],
      questionOrder: [...this.state.questionOrder],
      optionOrder: this.state.optionOrder,
      selectedAnswers: this.state.answers,
      checkedQuestionIds: [...this.state.checked],
      mistakeQuestionIds: [...this.state.mistakes],
      startedAt: this.state.startedAt,
      completedAt: null,
      durationMs: Math.max(0, Date.now() - new Date(this.state.startedAt).getTime()),
      retryOf: this.state.retryOf,
      assignmentId: this.state.assignmentId
    }, this.progressScope.scopeKey);
    queueCloudProgress(
      this.test.id,
      this.test.version,
      progress,
      this.progressScope,
      (status) => this.updateCloudStatus(status)
    );
  }

  updateCloudStatus(status, customMessage = "") {
    if (!this.elements.cloudStatus) return;
    const messages = {
      saving: "Сохраняем прогресс в облаке…",
      synced: "Прогресс сохранён в аккаунте.",
      offline: "Облако недоступно; прогресс сохранён на этом устройстве.",
      local: "Без входа прогресс сохраняется только на этом устройстве."
    };
    this.elements.cloudStatus.textContent = customMessage || messages[status] || messages.local;
    this.elements.cloudStatus.dataset.status = status || "local";
  }

  renderWork() {
    if (!this.state) return;
    const questionId = this.state.questionOrder[this.state.current];
    const question = this.questionMap.get(questionId);
    if (!question) {
      this.showFatalError(new TestLoadError("Вопрос не найден.", [`Не найден id «${questionId}».`]));
      return;
    }

    const selected = this.state.answers[questionId] ??
      getEmptyAnswer(question, this.state.optionOrder[questionId]);
    const isChecked = this.state.checked.has(questionId);
    const correct = isChecked && isAnswerCorrect(question, selected);
    const isTraining = this.state.mode === "training";
    const answeredCount = this.state.questionOrder.filter((id) => {
      const item = this.questionMap.get(id);
      return hasAnyAnswer(item, this.state.answers[id]) &&
        isAnswerComplete(item, this.state.answers[id]);
    }).length;
    const checkedQuestions = this.state.questionOrder.filter((id) => this.state.checked.has(id));
    const checkedScore = checkedQuestions.reduce((score, id) => {
      const item = this.questionMap.get(id);
      const evaluation = evaluateAnswer(item, this.state.answers[id]);
      return {
        earned: score.earned + evaluation.earnedPoints,
        max: score.max + evaluation.maxPoints
      };
    }, { earned: 0, max: 0 });
    const usesPoints = this.state.questionOrder.some((id) => getQuestionMaxPoints(this.questionMap.get(id)) > 1);

    this.elements.questionCounter.textContent = `${this.state.current + 1} / ${this.state.questionOrder.length}`;
    this.elements.answeredCounter.textContent = String(answeredCount);
    this.elements.correctCounterLabel.textContent = usesPoints ? "Баллы" : "Верно";
    this.elements.correctCounter.textContent = isTraining
      ? (usesPoints ? `${checkedScore.earned}/${checkedScore.max}` : String(checkedScore.earned))
      : "—";
    this.elements.mistakeCounter.textContent = isTraining ? String(this.state.mistakes.size) : "—";
    this.elements.activeVariantBadge.textContent = variantTitle(this.test, this.state.variantId);
    this.elements.activeModeBadge.textContent = modeTitle(this.state.mode);
    this.elements.progressBar.style.width = `${((this.state.current + 1) / this.state.questionOrder.length) * 100}%`;
    this.elements.questionSection.textContent = getSectionTitle(this.test, question.section);
    this.elements.questionTitle.textContent = `${this.state.current + 1}. ${question.text}`;
    this.elements.questionHint.textContent = questionInstruction(question);
    renderQuestionContent(this.elements.questionContent, question.content);

    renderQuestionOptions({
      container: this.elements.answerContainer,
      question,
      selected,
      locked: isTraining && isChecked,
      revealCorrect: isTraining && isChecked,
      optionOrder: this.state.optionOrder[questionId],
      onChange: (change) => this.updateAnswer(question, change),
      onEnter: (focusKey) => {
        this.handlePrimaryAction();
        this.restoreAnswerFocus(focusKey);
      }
    });

    this.renderFeedback(question, selected, isChecked, correct);
    this.renderNavigation();

    this.elements.previousButton.disabled = this.state.current === 0 || !this.test.settings.allowBack;
    if (isTraining) {
      this.elements.primaryButton.textContent = !isChecked
        ? "Проверить ответ"
        : this.state.current === this.state.questionOrder.length - 1
          ? "Показать результат"
          : "Следующий вопрос";
      this.elements.questionStatus.textContent = getAnswerStatus(question, selected, {
        mode: this.state.mode,
        isChecked
      });
    } else {
      this.elements.primaryButton.textContent = this.state.current === this.state.questionOrder.length - 1
        ? "Завершить тест"
        : "Сохранить и продолжить";
      this.elements.questionStatus.textContent = getAnswerStatus(question, selected, {
        mode: this.state.mode,
        isChecked: false
      });
    }
  }

  updateAnswer(question, change) {
    if (!this.state || (this.state.mode === "training" && this.state.checked.has(question.id))) return;
    const selected = this.state.answers[question.id] ??
      getEmptyAnswer(question, this.state.optionOrder[question.id]);
    this.state.answers[question.id] = updateQuestionAnswer(question, selected, change);

    this.persistProgress();
    if (change.render === false) {
      this.updateLiveAnswerState(question, this.state.answers[question.id]);
      return;
    }
    this.renderWork();
    this.restoreAnswerFocus(change.focusKey);
  }

  restoreAnswerFocus(focusKey) {
    if (!focusKey) return;
    requestAnimationFrame(() => {
      const escaped = globalThis.CSS?.escape ? CSS.escape(focusKey) : focusKey;
      this.elements.answerContainer.querySelector(`[data-focus-key="${escaped}"]`)?.focus({ preventScroll: true });
    });
  }

  updateLiveAnswerState(question, selected) {
    const answeredCount = this.state.questionOrder.filter((id) => {
      const item = this.questionMap.get(id);
      return hasAnyAnswer(item, this.state.answers[id]) &&
        isAnswerComplete(item, this.state.answers[id]);
    }).length;
    this.elements.answeredCounter.textContent = String(answeredCount);
    this.elements.questionStatus.textContent = getAnswerStatus(question, selected, {
      mode: this.state.mode,
      isChecked: false
    });
    this.elements.questionStatus.style.color = "";
    this.elements.questionStatus.removeAttribute("role");
    const control = this.elements.answerContainer.querySelector("[data-answer-control]");
    control?.removeAttribute("aria-invalid");
    control?.closest(".answer-input-card")?.classList.remove("is-invalid");
    this.renderNavigation();
  }

  renderFeedback(question, selected, isChecked, correct) {
    const panel = this.elements.feedbackPanel;
    panel.replaceChildren();
    panel.className = "trainer-feedback";

    if (this.state.mode !== "training" || !isChecked) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    panel.classList.add(correct ? "is-correct" : "is-wrong");
    const evaluation = evaluateAnswer(question, selected);
    const feedbackDetails = getFeedbackDetails(question, selected, evaluation);
    const heading = document.createElement("h3");
    heading.textContent = getFeedbackHeading(question, selected, evaluation);
    const explanation = document.createElement("p");
    explanation.textContent = question.explanation;
    const discussion = document.createElement("p");
    discussion.className = "trainer-discussion";

    if (correct) {
      discussion.textContent = "Можно кратко сформулировать правило своими словами и переходить дальше.";
    } else {
      discussion.textContent = evaluation.maxPoints > 1
        ? "Разберите каждую ошибочную часть ответа и только затем переходите дальше."
        : feedbackDetails.some((item) => item.label === "Правильный ответ")
          ? "Разберите пояснение и только затем переходите дальше."
          : `Правильный ответ: ${formatCorrectAnswer(question)}. ` +
          "Обсудите, почему выбранный вариант не подходит, и только затем переходите дальше.";
    }

    const detailNodes = feedbackDetails.map(({ label, value }) => {
      const line = document.createElement("p");
      line.className = "trainer-feedback-answer";
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      line.append(strong, document.createTextNode(value));
      return line;
    });
    panel.append(heading, ...detailNodes, explanation, discussion);
  }

  renderNavigation() {
    const nav = this.elements.questionNavigation;
    nav.replaceChildren();
    const isTraining = this.state.mode === "training";
    this.state.questionOrder.forEach((questionId, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.title = `Задание ${index + 1}`;
      button.setAttribute("aria-label", `Перейти к заданию ${index + 1}`);
      if (index === this.state.current) {
        button.classList.add("is-current");
        button.setAttribute("aria-current", "step");
      }

      const question = this.questionMap.get(questionId);
      const selected = this.state.answers[questionId] ??
        getEmptyAnswer(question, this.state.optionOrder[questionId]);
      if (hasAnyAnswer(question, selected)) button.classList.add("is-answered");
      if (isTraining && this.state.checked.has(questionId)) {
        button.classList.add(isAnswerCorrect(question, selected) ? "is-correct" : "is-wrong");
      }

      if (!this.test.settings.allowBack && index !== this.state.current) button.disabled = true;
      button.addEventListener("click", () => {
        this.state.current = index;
        this.persistProgress();
        this.renderWork();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      nav.appendChild(button);
    });

    this.elements.navigationLegend.textContent = isTraining
      ? "✓ — верно, ! — требуется разбор. Статус обозначен не только цветом."
      : "● — ответ сохранён. Правильность откроется после завершения.";
  }

  handlePrimaryAction() {
    if (!this.state) return;
    const questionId = this.state.questionOrder[this.state.current];
    const question = this.questionMap.get(questionId);
    const selected = this.state.answers[questionId] ??
      getEmptyAnswer(question, this.state.optionOrder[questionId]);

    if (this.state.mode === "training") {
      if (!this.state.checked.has(questionId)) {
        if (!isAnswerComplete(question, selected)) {
          this.setQuestionError(incompleteAnswerMessage(question, selected));
          return;
        }
        this.state.checked.add(questionId);
        if (!isAnswerCorrect(question, selected)) this.state.mistakes.add(questionId);
        this.persistProgress();
        this.renderWork();
        this.elements.feedbackPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      if (this.state.current === this.state.questionOrder.length - 1) this.finishAttempt();
      else this.goNext();
      return;
    }

    if (this.state.current === this.state.questionOrder.length - 1) this.finishAttempt();
    else this.goNext();
  }

  goNext() {
    if (this.state.current >= this.state.questionOrder.length - 1) return;
    this.state.current += 1;
    this.persistProgress();
    this.renderWork();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  goPrevious() {
    if (!this.state || !this.test.settings.allowBack || this.state.current === 0) return;
    this.state.current -= 1;
    this.persistProgress();
    this.renderWork();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  setQuestionError(message) {
    this.elements.questionStatus.textContent = `! ${message}`;
    this.elements.questionStatus.style.color = "var(--bad)";
    this.elements.questionStatus.setAttribute("role", "alert");
    const control = this.elements.answerContainer.querySelector("[data-answer-control]");
    control?.setAttribute("aria-invalid", "true");
    control?.closest(".answer-input-card")?.classList.add("is-invalid");
    window.setTimeout(() => {
      this.elements.questionStatus.style.color = "";
      this.elements.questionStatus.removeAttribute("role");
    }, 2000);
  }

  finishAttempt() {
    if (!this.state || this.state.completed) return;
    const incompleteId = this.state.mode === "training"
      ? this.state.questionOrder.find((id) => !this.state.checked.has(id))
      : this.state.questionOrder.find((id) => {
        const question = this.questionMap.get(id);
        return !isAnswerComplete(question, this.state.answers[id]);
      });

    if (incompleteId) {
      this.state.current = this.state.questionOrder.indexOf(incompleteId);
      this.renderWork();
      const incompleteQuestion = this.questionMap.get(incompleteId);
      this.setQuestionError(
        this.state.mode === "training"
          ? "Сначала проверьте ответ на каждое задание."
          : incompleteAnswerMessage(incompleteQuestion, this.state.answers[incompleteId])
      );
      return;
    }

    const completedAt = new Date();
    const result = calculateResult({
      test: this.test,
      questionIds: this.state.questionOrder,
      answers: this.state.answers,
      startedAt: this.state.startedAt,
      completedAt
    });
    result.mistakes.forEach((id) => this.state.mistakes.add(id));
    this.state.completed = true;

    const historyRecord = {
      schemaVersion: 1,
      testId: this.test.id,
      testVersion: this.test.version,
      attemptId: this.state.attemptId,
      variantId: this.state.variantId,
      mode: this.state.mode,
      currentQuestion: this.state.questionOrder.length - 1,
      currentQuestionId: this.state.questionOrder.at(-1),
      questionIds: [...this.state.questionOrder],
      selectedAnswers: this.state.answers,
      checkedQuestionIds: this.state.mode === "training"
        ? [...this.state.checked]
        : [...this.state.questionOrder],
      startedAt: this.state.startedAt,
      completedAt: completedAt.toISOString(),
      durationMs: result.durationMs,
      correctCount: result.correctCount,
      total: result.total,
      earnedPoints: result.earnedPoints,
      maxPoints: result.maxPoints,
      fullyCorrectCount: result.fullyCorrectCount,
      totalQuestions: result.totalQuestions,
      percent: result.percent,
      grade: result.grade,
      mistakeQuestionIds: [...result.mistakes],
      retryOf: this.state.retryOf,
      assignmentId: this.state.assignmentId
    };

    appendHistory(this.test.id, historyRecord);
    clearProgress(this.test.id, this.progressScope.scopeKey);
    this.updateCloudStatus(this.cloud.signedIn ? "saving" : "local", this.cloud.signedIn
      ? "Сохраняем завершённый результат в аккаунте…"
      : "Результат сохранён в этом браузере.");
    void saveCompletedAttempt(historyRecord).then((outcome) => {
      this.updateCloudStatus(outcome.synced ? "synced" : outcome.reason === "signed-out" ? "local" : "offline",
        outcome.synced ? "Результат сохранён в аккаунте." : "Результат сохранён на этом устройстве.");
    });
    this.savedProgress = { status: "empty", data: null };
    this.renderResult(result);
    this.showPanel("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderResult(result) {
    this.elements.resultVariantBadge.textContent = variantTitle(this.test, this.state.variantId);
    this.elements.resultModeBadge.textContent = modeTitle(this.state.mode);
    this.elements.resultTitle.textContent = this.state.retryOf ? "Работа над ошибками завершена" : "Попытка завершена";
    const thresholds = this.test.grading.thresholds;
    this.elements.resultSubtitle.textContent =
      `Оценка рассчитана по шкале: ${thresholds["3"]}% — «3», ` +
      `${thresholds["4"]}% — «4», ${thresholds["5"]}% — «5».`;
    const usesPoints = result.maxPoints !== result.totalQuestions;
    this.elements.resultScore.textContent = usesPoints
      ? `${result.earnedPoints}/${result.maxPoints}`
      : `${result.correctCount}/${result.total}`;
    this.elements.resultScoreLabel.textContent = usesPoints ? "баллы" : "верно";
    this.elements.resultPercent.textContent = `${result.percent}%`;
    this.elements.resultGrade.textContent = String(result.grade);
    this.elements.resultDuration.textContent = formatDuration(result.durationMs);
    this.elements.repeatMistakesButton.hidden = result.mistakes.length === 0;
    this.elements.repeatMistakesButton.dataset.questionIds = result.mistakes.join(",");

    const heading = document.createElement("h2");
    heading.textContent = "Разбор всех ответов";
    const fragment = document.createDocumentFragment();
    fragment.appendChild(heading);

    this.state.questionOrder.forEach((questionId, index) => {
      const question = this.questionMap.get(questionId);
      const selected = this.state.answers[questionId] ??
        getEmptyAnswer(question, this.state.optionOrder[questionId]);
      const evaluation = evaluateAnswer(question, selected);
      const correct = evaluation.isFullyCorrect;
      const item = document.createElement("article");
      item.className = `trainer-review-item${correct ? "" : " is-wrong"}`;

      const top = document.createElement("div");
      top.className = "trainer-review-top";
      const title = document.createElement("strong");
      title.textContent = `${index + 1}. ${question.text}`;
      const status = document.createElement("span");
      status.className = "trainer-review-status";
      status.textContent = correct ? "✓ Верно" : "! Ошибка";
      top.append(title, status);

      item.append(top);
      appendReviewContent(item, question, selected, evaluation);
      fragment.appendChild(item);
    });

    this.elements.reviewContainer.replaceChildren(fragment);
  }

  repeatMistakes() {
    const questionIds = this.elements.repeatMistakesButton.dataset.questionIds
      ?.split(",")
      .filter((id) => this.questionMap.has(id)) || [];
    if (!questionIds.length) return;
    this.assignment = null;
    this.progressScope = assignmentScope();
    this.applyAssignmentContext();
    this.startAttempt({
      variantId: this.state.variantId,
      mode: "training",
      questionIds,
      retryOf: this.state.attemptId,
      assignmentId: null
    });
  }

  returnToSetup() {
    this.persistProgress();
    this.savedProgress = loadProgress(this.test, this.progressScope.scopeKey);
    this.renderResumeCard();
    this.showPanel("setup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  restartAttempt() {
    if (!this.state) return;
    const confirmed = window.confirm("Начать эту попытку заново? Текущий прогресс будет заменён.");
    if (!confirmed) return;
    this.startAttempt({ variantId: this.state.variantId, mode: this.state.mode });
  }

  showFreshSetup() {
    this.state = null;
    this.savedProgress = loadProgress(this.test, this.progressScope.scopeKey);
    this.renderResumeCard();
    this.showPanel("setup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showPanel(name) {
    this.elements.loadingPanel.hidden = true;
    this.elements.errorPanel.hidden = name !== "error";
    this.elements.setupPanel.hidden = name !== "setup";
    this.elements.workPanel.hidden = name !== "work";
    this.elements.resultPanel.hidden = name !== "result";
  }

  showFatalError(error) {
    console.error(error);
    const normalized = error instanceof TestLoadError
      ? error
      : new TestLoadError("Произошла непредвиденная ошибка.", [
        error instanceof Error ? error.message : String(error)
      ]);
    this.elements.errorTitle.textContent = "Не удалось открыть тест";
    this.elements.errorMessage.textContent = normalized.message;
    this.elements.errorList.replaceChildren(...normalized.details.map((detail) => {
      const item = document.createElement("li");
      item.textContent = detail;
      return item;
    }));
    this.showPanel("error");
  }
}

if (typeof document !== "undefined") {
  const engine = new TrainerEngine();
  engine.init();
}

export { TrainerEngine };
