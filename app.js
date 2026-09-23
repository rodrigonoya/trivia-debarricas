const state = { questions: [], config: null, selected: [], current: 0, score: 0, answered: false, answerTimer: null, audioContext: null };
const $ = (selector) => document.querySelector(selector);

function playDropSound(type = "click") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audioContext ||= new AudioContext();
    const context = state.audioContext;
    if (context.state === "suspended") context.resume();
    const now = context.currentTime;
    const duration = type === "answer" ? 0.34 : 0.16;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(type === "answer" ? 900 : 1250, now);
    oscillator.frequency.exponentialRampToValueAtTime(type === "answer" ? 260 : 430, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(type === "answer" ? 0.18 : 0.12, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  } catch {
    // Audio is decorative; the trivia remains fully functional if unavailable.
  }
}

const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

async function loadData() {
  const [questionsResponse, configResponse] = await Promise.all([fetch("questions.json"), fetch("config.json")]);
  if (!questionsResponse.ok || !configResponse.ok) throw new Error("No se pudieron cargar los datos");
  state.questions = await questionsResponse.json();
  state.config = await configResponse.json();
  if (state.questions.length < state.config.questionsPerQuiz) throw new Error("No hay suficientes preguntas");
}

function startQuiz() {
  clearTimeout(state.answerTimer);
  state.selected = shuffle(state.questions).slice(0, state.config.questionsPerQuiz).map((question) => ({
    ...question,
    options: shuffle(question.options.map((text, index) => ({ text, correct: index === question.correct })))
  }));
  state.current = 0;
  state.score = 0;
  state.answered = false;
  $("#intro-view").hidden = true;
  $("#quiz-view").hidden = false;
  $("#final-view").hidden = true;
  $("#progress-dots").hidden = false;
  renderQuestion();
}

function showIntro() {
  clearTimeout(state.answerTimer);
  $("#intro-view").hidden = false;
  $("#quiz-view").hidden = true;
  $("#final-view").hidden = true;
  $("#progress-dots").hidden = true;
}

function renderQuestion() {
  const question = state.selected[state.current];
  $("#progress").textContent = `Pregunta ${state.current + 1} de ${state.selected.length}`;
  $("#progress-dots").innerHTML = state.selected.map((_, index) => {
    const status = index < state.current ? "completed" : index === state.current ? "current" : "pending";
    return `<span class="progress-dot ${status}" aria-label="Pregunta ${index + 1}"></span>`;
  }).join("");
  $("#question").textContent = question.question;
  $("#options").innerHTML = "";
  $("#result").textContent = "";
  $("#result").className = "result";
  $("#next-btn").hidden = true;
  $("#quiz-view").classList.remove("has-answer");
  state.answered = false;
  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.text;
    button.addEventListener("click", () => { playDropSound("click"); checkAnswer(button, option); });
    $("#options").append(button);
  });
}

function checkAnswer(selectedButton, selectedOption) {
  if (state.answered) return;
  state.answered = true;
  playDropSound("answer");
  const buttons = [...$("#options").querySelectorAll("button")];
  buttons.forEach((button) => { button.disabled = true; });
  const correctButton = buttons.find((button) => questionOptionText(button) && state.selected[state.current].options.find((option) => option.text === questionOptionText(button))?.correct);
  if (selectedOption.correct) {
    state.score += 1;
    selectedButton.classList.add("is-correct");
    $("#result").textContent = state.config.texts.correct;
    $("#result").className = "result correct";
  } else {
    selectedButton.classList.add("is-wrong");
    if (correctButton) correctButton.classList.add("is-correct");
    $("#result").textContent = state.config.texts.incorrect;
    $("#result").className = "result incorrect";
  }
  $("#next-btn").textContent = state.config.texts.next;
  $("#next-btn").hidden = false;
  $("#quiz-view").classList.add("has-answer");
  state.answerTimer = setTimeout(nextQuestion, state.config.answerDelayMs ?? 2200);
}

function questionOptionText(button) { return button.textContent; }

function nextQuestion() {
  if (!state.answered) return;
  clearTimeout(state.answerTimer);
  if (state.current < state.selected.length - 1) {
    state.current += 1;
    renderQuestion();
  } else {
    renderFinal();
  }
}

function renderFinal() {
  const result = [...state.config.results].sort((a, b) => b.minimumScore - a.minimumScore).find((item) => state.score >= item.minimumScore);
  $("#quiz-view").hidden = true;
  $("#final-view").hidden = false;
  $("#progress-dots").hidden = true;
  $("#final-score").textContent = `Tu puntaje: ${state.score}/${state.selected.length}`;
  $("#final-title").textContent = result.title;
  $("#final-copy").innerHTML = `${result.message}<br><strong>¡Tenés un ${result.discount} de descuento en tu compra para usar ahora!</strong><br>${state.config.finalInstruction}<br>${state.config.finalThanks}`;
  $("#restart-btn").textContent = state.config.texts.restart;
}

$("#next-btn").addEventListener("click", () => { playDropSound(); nextQuestion(); });
$("#start-btn").addEventListener("click", () => { playDropSound(); startQuiz(); });
$("#restart-btn").addEventListener("click", () => { playDropSound(); showIntro(); });
$("#reset-btn").addEventListener("click", () => { playDropSound(); showIntro(); });
$("#final-logo-btn").addEventListener("click", () => { playDropSound(); showIntro(); });

loadData().then(() => {
  const preview = new URLSearchParams(window.location.search).get("preview");
  if (preview === "quiz") startQuiz();
  else if (preview === "answered") {
    startQuiz();
    const firstButton = $("#options button");
    const wrongOption = state.selected[0].options.find((option) => !option.correct) || state.selected[0].options[0];
    checkAnswer(firstButton, wrongOption);
  }
  else if (preview === "final") {
    startQuiz();
    state.score = Math.min(3, state.selected.length);
    renderFinal();
  }
  else showIntro();
}).catch((error) => {
  console.error(error);
  $("#quiz-view").hidden = true;
  $("#load-error").hidden = false;
});
