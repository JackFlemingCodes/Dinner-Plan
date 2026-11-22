// Dinner Plan — suggests meals and picks who cooks them.
// All data lives in localStorage, so nothing needs a server.

const STORAGE_KEY = "dinner-plan-v1";

const STARTER_MEALS = [
  "Spaghetti bolognese",
  "Tacos",
  "Chicken stir-fry",
  "Homemade pizza",
  "Chili",
  "Roast chicken & veg",
  "Fish & chips",
  "Curry & rice",
  "Burgers",
  "Mac & cheese",
  "Fajitas",
  "Soup & grilled cheese",
  "Lasagna",
  "Salmon & potatoes",
  "Breakfast for dinner",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------- State ----------

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.people) && Array.isArray(saved.meals)) {
      return {
        people: saved.people,
        meals: saved.meals,
        history: Array.isArray(saved.history) ? saved.history : [],
        week: Array.isArray(saved.week) ? saved.week : [],
      };
    }
  } catch (_) {
    // Fall through to defaults.
  }
  return { people: [], meals: [...STARTER_MEALS], history: [], week: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // Storage can be unavailable (private mode etc.); the app still works for this visit.
  }
}

const state = loadState();
let tonight = null; // { meal, cook, locked }

// ---------- Picking logic ----------

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// How many times each person has cooked in recent history.
function cookCounts() {
  const counts = Object.fromEntries(state.people.map((p) => [p, 0]));
  for (const entry of state.history.slice(0, 30)) {
    if (entry.cook in counts) counts[entry.cook]++;
  }
  return counts;
}

// Pick the person who has cooked the least lately; never the same person twice in a row
// (when there's more than one person). `exclude` lets a re-roll skip the current pick.
function pickCook(exclude) {
  let candidates = state.people.filter((p) => p !== exclude);
  if (candidates.length === 0) candidates = [...state.people];
  if (candidates.length === 0) return null;

  const lastCook = state.history[0] && state.history[0].cook;
  if (candidates.length > 1) {
    const withoutLast = candidates.filter((p) => p !== lastCook);
    if (withoutLast.length) candidates = withoutLast;
  }

  const counts = cookCounts();
  const fewest = Math.min(...candidates.map((p) => counts[p] ?? 0));
  return randomItem(candidates.filter((p) => (counts[p] ?? 0) === fewest));
}

// Pick a meal that hasn't been eaten recently.
function pickMeal(exclude) {
  let candidates = state.meals.filter((m) => m !== exclude);
  if (candidates.length === 0) candidates = [...state.meals];
  if (candidates.length === 0) return null;

  const recentWindow = Math.min(7, candidates.length - 1);
  const recent = new Set(state.history.slice(0, recentWindow).map((h) => h.meal));
  const fresh = candidates.filter((m) => !recent.has(m));
  return randomItem(fresh.length ? fresh : candidates);
}

function planWeek() {
  const days = 7;

  // Cooks: order by who has cooked least, then hand out turns round-robin so it's even.
  const counts = cookCounts();
  const lastCook = state.history[0] && state.history[0].cook;
  const cookOrder = shuffle(state.people).sort((a, b) => {
    if (a === lastCook) return 1;
    if (b === lastCook) return -1;
    return counts[a] - counts[b];
  });

  // Meals: no repeats until we run out, and avoid what was eaten recently.
  const recent = new Set(state.history.slice(0, 7).map((h) => h.meal));
  let mealPool = [];
  const nextMeal = (prev) => {
    if (mealPool.length === 0) {
      const fresh = shuffle(state.meals.filter((m) => !recent.has(m)));
      const stale = shuffle(state.meals.filter((m) => recent.has(m)));
      mealPool = [...fresh, ...stale];
      recent.clear(); // second pass through the list doesn't need to avoid anything
    }
    // Avoid the same meal two nights running when the pool restarts.
    if (mealPool[0] === prev && mealPool.length > 1) {
      [mealPool[0], mealPool[1]] = [mealPool[1], mealPool[0]];
    }
    return mealPool.shift();
  };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const plan = [];
  let prevMeal = null;
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const meal = nextMeal(prevMeal);
    prevMeal = meal;
    plan.push({
      date: date.toISOString(),
      meal,
      cook: cookOrder.length ? cookOrder[i % cookOrder.length] : null,
    });
  }
  return plan;
}

// ---------- Rendering ----------

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDay(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function renderTonight() {
  const box = $("tonight-result");
  box.replaceChildren();

  if (!tonight) {
    box.className = "result empty";
    box.textContent = state.people.length
      ? "Press the button to pick a meal and a cook."
      : "Add at least one cook below, then press the button.";
  } else {
    box.className = "result";
    box.append(el("span", "meal", tonight.meal ?? "No meals in the list"));
    if (tonight.cook) {
      box.append("Cooked by ", el("span", "cook", tonight.cook));
    } else {
      box.append("Add a cook to choose who makes it.");
    }
    if (tonight.locked) {
      box.append(el("br"), el("span", "locked", "✓ Locked in"));
    }
  }

  const has = Boolean(tonight) && !tonight.locked;
  $("reroll-meal").disabled = !has || state.meals.length < 2;
  $("reroll-cook").disabled = !has || state.people.length < 2;
  $("accept-tonight").disabled = !has || !tonight.meal || !tonight.cook;
}

function renderPeople() {
  const list = $("people-list");
  list.replaceChildren();
  const counts = cookCounts();
  for (const person of state.people) {
    const li = el("li");
    li.append(el("span", null, person));
    if (counts[person]) li.append(el("span", "count", `· ${counts[person]}`));
    const btn = el("button", "remove", "×");
    btn.title = `Remove ${person}`;
    btn.addEventListener("click", () => {
      state.people = state.people.filter((p) => p !== person);
      saveState();
      renderAll();
    });
    li.append(btn);
    list.append(li);
  }
  $("people-empty").hidden = state.people.length > 0;
}

function renderMeals() {
  const list = $("meals-list");
  list.replaceChildren();
  for (const meal of state.meals) {
    const li = el("li");
    li.append(el("span", null, meal));
    const btn = el("button", "remove", "×");
    btn.title = `Remove ${meal}`;
    btn.addEventListener("click", () => {
      state.meals = state.meals.filter((m) => m !== meal);
      saveState();
      renderAll();
    });
    li.append(btn);
    list.append(li);
  }
}

function renderWeek() {
  const list = $("week-list");
  list.replaceChildren();
  for (const day of state.week) {
    const li = el("li");
    li.append(
      el("span", "day", formatDay(day.date)),
      el("span", "what", day.meal ?? "—"),
      el("span", "who", day.cook ?? "Add a cook")
    );
    list.append(li);
  }
}

function renderHistory() {
  const list = $("history-list");
  list.replaceChildren();
  for (const entry of state.history.slice(0, 10)) {
    const li = el("li");
    li.append(el("span", "date", formatDay(entry.date)), `${entry.meal} — ${entry.cook}`);
    list.append(li);
  }
  $("history-empty").hidden = state.history.length > 0;
  $("clear-history").hidden = state.history.length === 0;
}

function renderAll() {
  renderTonight();
  renderPeople();
  renderMeals();
  renderWeek();
  renderHistory();
}

// ---------- Events ----------

function addUnique(list, raw) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return false;
  if (list.some((x) => x.toLowerCase() === value.toLowerCase())) return false;
  list.push(value);
  return true;
}

$("person-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("person-input");
  if (addUnique(state.people, input.value)) {
    saveState();
    renderAll();
  }
  input.value = "";
  input.focus();
});

$("meal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("meal-input");
  if (addUnique(state.meals, input.value)) {
    saveState();
    renderAll();
  }
  input.value = "";
  input.focus();
});

$("pick-tonight").addEventListener("click", () => {
  tonight = { meal: pickMeal(), cook: pickCook(), locked: false };
  renderTonight();
});

$("reroll-meal").addEventListener("click", () => {
  tonight.meal = pickMeal(tonight.meal);
  renderTonight();
});

$("reroll-cook").addEventListener("click", () => {
  tonight.cook = pickCook(tonight.cook);
  renderTonight();
});

$("accept-tonight").addEventListener("click", () => {
  state.history.unshift({ date: new Date().toISOString(), meal: tonight.meal, cook: tonight.cook });
  state.history = state.history.slice(0, 100);
  tonight.locked = true;
  saveState();
  renderAll();
});

$("plan-week").addEventListener("click", () => {
  state.week = planWeek();
  saveState();
  renderWeek();
});

$("reset-meals").addEventListener("click", () => {
  for (const meal of STARTER_MEALS) addUnique(state.meals, meal);
  saveState();
  renderAll();
});

$("clear-history").addEventListener("click", () => {
  state.history = [];
  saveState();
  renderAll();
});

renderAll();
