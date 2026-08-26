"use strict";

const STORAGE_KEY = "prompt-house-standalone-v1";

const blocks = [
  { key: "objective", label: "Оқу мақсаты", color: "green", area: "roof", placeholder: "Оқушылар нені үйренуі керек?" },
  { key: "subject", label: "Пән", color: "red", area: "subject", placeholder: "Мысалы: Биология" },
  { key: "grade", label: "Сынып", color: "blue", area: "grade", placeholder: "Мысалы: 7" },
  { key: "topic", label: "Тақырып", color: "yellow", area: "topic", placeholder: "Нақты тақырыпты жазыңыз" },
  { key: "material", label: "Материал", color: "orange", area: "material", placeholder: "ChatGPT не құрастыруы керек?" },
  { key: "format", label: "Нәтиже форматы", color: "purple", area: "format", placeholder: "Нәтиже қандай түрде ұсынылуы керек?" },
  { key: "constraints", label: "Шектеулер", color: "cyan", area: "constraints", placeholder: "Саны, күрделілігі, тілі және басқа шарттар" },
];

const example = {
  objective: "Фотосинтез үдерісін түсіндіру және білімді тапсырмалар арқылы қолдану",
  subject: "Биология",
  grade: "7",
  topic: "Фотосинтез үдерісінің негізгі кезеңдері",
  material: "Қалыптастырушы бағалауға арналған 3 тапсырма",
  format: "Тапсырма + дескриптор",
  constraints: "Тапсырмалар қарапайымнан күрделіге қарай құрылсын",
};

const root = document.querySelector("#gameRoot");
const liveRegion = document.querySelector("#liveRegion");
const resetButton = document.querySelector("#resetGame");
const closeButton = document.querySelector("#closeGame");

function emptyState() {
  return { view: "example", placed: [], values: Object.fromEntries(blocks.map((block) => [block.key, ""])), result: null };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved?.values) return emptyState();
    return {
      view: ["example", "build", "result"].includes(saved.view) ? saved.view : "example",
      placed: Array.isArray(saved.placed) ? saved.placed.filter((key) => blocks.some((block) => block.key === key)) : [],
      values: { ...emptyState().values, ...saved.values },
      result: saved.result || null,
    };
  } catch {
    return emptyState();
  }
}

let state = loadState();

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Ойын сақтау мүмкін болмаса да жұмысын жалғастырады. */ }
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function announce(message) {
  liveRegion.textContent = message;
}

function gradeLabel(value) {
  return /^\d+$/.test(value) ? `${value}-сынып` : value;
}

function promptText(values) {
  const audience = /^\d+$/.test(values.grade) ? `${values.grade}-сынып оқушылары` : values.grade;
  return [
    `Сен — «${values.subject}» пәнінің тәжірибелі мұғалімі.`,
    `${audience} үшін «${values.topic}» тақырыбы бойынша ${values.material.charAt(0).toLowerCase()}${values.material.slice(1)} құрастыр.`,
    `Мақсат: ${values.objective}.`,
    `Нәтижені «${values.format}» форматында ұсын.`,
    `Келесі шектеулерді ескер: ${values.constraints}.`,
    "Материал аудиторияға сай, түсінікті және көрсетілген мақсатқа жетуге бағытталған болсын.",
  ].join(" ").replace(/\s+/g, " ").trim();
}

function score(values) {
  const topic = values.topic.trim();
  const objective = values.objective.trim();
  const subjectPoints = values.subject.trim() ? 10 : 0;
  const gradePoints = values.grade.trim() ? 10 : 0;
  const topicPoints = !topic ? 0 : topic.length < 12 ? 8 : 15;
  const objectivePoints = !objective ? 0 : objective.length < 20 ? 12 : 20;
  const materialPoints = values.material.trim() ? 15 : 0;
  const formatPoints = values.format.trim() ? 15 : 0;
  const constraintPoints = values.constraints.trim() ? 15 : 0;
  const total = subjectPoints + gradePoints + topicPoints + objectivePoints + materialPoints + formatPoints + constraintPoints;
  return { total, level: total >= 80 ? "Промпт шебері" : total >= 60 ? "Жақсы бастама" : "Құрылым әзірге әлсіз" };
}

function renderHouse(values, { editable = false, placed = blocks.map((block) => block.key) } = {}) {
  const house = node("section", "house");
  house.setAttribute("aria-label", editable ? "Промпт-үй құрастырғышы" : "Дұрыс промпт-үй үлгісі");
  const grid = node("div", "house-grid");
  blocks.forEach((block) => {
    const slot = node("div", `house-slot house-slot--${block.area}`);
    if (!placed.includes(block.key)) {
      slot.append(node("span", "house-placeholder", block.label));
      grid.append(slot);
      return;
    }
    const piece = node("div", `house-block ${block.color}`);
    piece.dataset.key = block.key;
    piece.append(node("strong", "block-label", block.label));
    if (editable) {
      const input = node("textarea", "block-input");
      input.rows = ["roof", "topic", "constraints"].includes(block.area) ? 2 : 1;
      input.value = state.values[block.key];
      input.placeholder = block.placeholder;
      input.setAttribute("aria-label", block.label);
      input.addEventListener("input", () => {
        state.values[block.key] = input.value;
        state.result = null;
        saveState();
      });
      const remove = node("button", "remove-block", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `«${block.label}» блогын алып тастау`);
      remove.addEventListener("click", () => {
        state.placed = state.placed.filter((key) => key !== block.key);
        saveState();
        announce(`«${block.label}» блогы жинаққа қайтарылды`);
        render();
      });
      piece.append(input, remove);
    } else {
      piece.append(node("span", "block-value", block.key === "grade" ? gradeLabel(values[block.key]) : values[block.key]));
    }
    slot.append(piece);
    grid.append(slot);
  });
  house.append(grid);
  return house;
}

function heading(title, lead) {
  const wrap = node("div", "screen-heading");
  wrap.append(node("h1", "", title), node("p", "screen-lead", lead));
  return wrap;
}

function renderExample() {
  root.append(heading("Промпт құрастыру", "Әр түсті бөлшек нақты сұраныстың бір маңызды бөлігін білдіреді"));
  const layout = node("div", "example-layout");
  const text = node("aside", "text-example");
  text.append(node("p", "text-example-kicker", "ДҰРЫС ПРОМПТ ҮЛГІСІ"), node("h2", "", "Дайын мәтіндік нұсқа"), node("p", "text-example-copy", promptText(example)));
  layout.append(renderHouse(example), text);
  const actions = node("div", "actions");
  const start = node("button", "primary-button", "Өзіңіз құрастырып көріңіз");
  start.type = "button";
  start.addEventListener("click", () => {
    state = { ...emptyState(), view: "build" };
    saveState();
    render();
  });
  actions.append(start);
  root.append(layout, actions);
}

function renderBuilder() {
  root.append(heading("Промпт-үйді құрастырыңыз", "Блоктарды таңдаңыз және мәтінді әр бөлшектің ішіне жазыңыз"));
  const layout = node("div", "builder-layout");
  const palette = node("aside", "palette");
  palette.append(node("h2", "", "Құрастыру блоктары"), node("p", "", "Үйге орнату үшін қажетті бөлшекті таңдаңыз."));
  blocks.forEach((block, index) => {
    const isPlaced = state.placed.includes(block.key);
    const button = node("button", `palette-piece ${block.color} size-${(index % 3) + 1}`, isPlaced ? `✓ ${block.label}` : block.label);
    button.type = "button";
    button.disabled = isPlaced;
    button.addEventListener("click", () => {
      state.placed.push(block.key);
      saveState();
      announce(`«${block.label}» блогы орнатылды`);
      render();
      requestAnimationFrame(() => document.querySelector(`.house-block[data-key="${block.key}"] .block-input`)?.focus());
    });
    palette.append(button);
  });
  const stage = node("section", "builder-stage");
  const progress = node("div", "progress");
  progress.append(node("strong", "", `${state.placed.length} / ${blocks.length}`), node("span", "", "блок орнатылды"));
  stage.append(progress, renderHouse(state.values, { editable: true, placed: state.placed }));
  layout.append(palette, stage);
  const actions = node("div", "actions");
  const back = node("button", "secondary-button", "Үлгіні көру");
  back.type = "button";
  back.addEventListener("click", () => { state.view = "example"; saveState(); render(); });
  const check = node("button", "primary-button", "Үйді тексеру");
  check.type = "button";
  check.addEventListener("click", () => {
    const missing = blocks.filter((block) => !state.placed.includes(block.key));
    const empty = blocks.filter((block) => state.placed.includes(block.key) && !state.values[block.key].trim());
    document.querySelector(".error")?.remove();
    if (missing.length || empty.length) {
      const labels = (missing.length ? missing : empty).map((block) => block.label.toLowerCase()).join(", ");
      const message = missing.length ? `Барлық бөлшекті қосыңыз. Жетпейтіндері: ${labels}.` : `Мына блоктарға мәтін жазыңыз: ${labels}.`;
      const error = node("p", "error", message);
      root.insertBefore(error, actions);
      announce(message);
      return;
    }
    state.result = score(state.values);
    state.view = "result";
    saveState();
    render();
  });
  actions.append(back, check);
  root.append(layout, actions);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = node("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  announce("Промпт көшірілді");
}

function renderResult() {
  const result = state.result || score(state.values);
  const card = node("section", "result-card");
  card.append(node("p", "result-kicker", "ҚҰРЫЛЫМНЫҢ БЕРІКТІГІ"), node("div", "score", `${result.total}%`), node("h1", "", result.level));
  card.append(node("p", "", result.total >= 80 ? "Керемет құрылым! Промптыңыз нақты әрі түсінікті." : "Нақтырақ нәтиже алу үшін кейбір блоктарды толықтырыңыз."));
  const output = node("section", "prompt-output");
  output.append(node("strong", "", "Дайын промпт"), node("p", "", promptText(state.values)));
  const actions = node("div", "actions");
  const copy = node("button", "primary-button", "Промптты көшіру");
  copy.type = "button";
  copy.addEventListener("click", () => copyText(promptText(state.values)));
  const edit = node("button", "secondary-button", "Құрылымды өзгерту");
  edit.type = "button";
  edit.addEventListener("click", () => { state.view = "build"; saveState(); render(); });
  const open = node("a", "secondary-button", "ChatGPT-ті ашу");
  open.href = "https://chatgpt.com/";
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  actions.append(copy, edit, open);
  root.append(card, renderHouse(state.values), output, actions);
}

function render() {
  root.replaceChildren();
  liveRegion.textContent = "";
  if (state.view === "build") renderBuilder();
  else if (state.view === "result") renderResult();
  else renderExample();
}

resetButton.addEventListener("click", () => {
  if (!window.confirm("Жауаптарды өшіріп, ойынды қайта бастайсыз ба?")) return;
  state = emptyState();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Бос қалдыруға болады. */ }
  render();
});

closeButton.addEventListener("click", () => {
  window.close();
  setTimeout(() => {
    if (!document.hidden) window.location.replace("about:blank");
  }, 120);
});

render();
