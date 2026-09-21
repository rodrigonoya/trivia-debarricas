const state = { questions: [], config: null, selected: [], current: 0, score: 0, answered: false };
const $ = (selector) => document.querySelector(selector);

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
  renderQuestion();
}

function showIntro() {
  $("#intro-view").hidden = false;
  $("#quiz-view").hidden = true;
  $("#final-view").hidden = true;
}

function renderQuestion() {
  const question = state.selected[state.current];
  $("#progress").textContent = `Pregunta ${state.current + 1} de ${state.selected.length}`;
  $("#question").textContent = question.question;
  $("#options").innerHTML = "";
  $("#result").textContent = "";
  $("#result").className = "result";
  $("#next-btn").hidden = true;
  state.answered = false;
  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.text;
    button.addEventListener("click", () => checkAnswer(button, option));
    $("#options").append(button);
  });
}

function checkAnswer(selectedButton, selectedOption) {
  if (state.answered) return;
  state.answered = true;
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
}

function questionOptionText(button) { return button.textContent; }

function nextQuestion() {
  if (!state.answered) return;
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
  $("#final-score").textContent = `Tu puntaje: ${state.score}/${state.selected.length}`;
  $("#final-title").textContent = result.title;
  $("#final-copy").innerHTML = `${result.message}<br><strong>¡Tenés un ${result.discount} de descuento en tu compra para usar ahora!</strong><br>${state.config.finalInstruction}<br>${state.config.finalThanks}`;
  $("#restart-btn").textContent = state.config.texts.restart;
}

$("#next-btn").addEventListener("click", nextQuestion);
$("#start-btn").addEventListener("click", startQuiz);
$("#restart-btn").addEventListener("click", showIntro);

loadData().then(showIntro).catch((error) => {
  console.error(error);
  $("#quiz-view").hidden = true;
  $("#load-error").hidden = false;
});
