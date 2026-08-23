const ROLE = "__ROLE__";
const STORAGE_KEY = "textbook-registry-smoke-state";

function initialState() {
  return {
    book_registry_students: [
      { id: "s1", last_name: "Иванов", first_name: "Максим" },
      { id: "s2", last_name: "Петрова", first_name: "Анна" }
    ],
    book_registry_textbooks: [
      { id: "b1", title: "Биология, 8 класс", quantity: 2 },
      { id: "b2", title: "Алгебра, 8 класс", quantity: 1 }
    ],
    book_registry_loans: [
      { id: "l1", student_id: "s1", textbook_id: "b1" }
    ]
  };
}

function readState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const state = initialState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nextId(state, prefix) {
  return prefix + "-" + Object.values(state).flat().length + "-" + Date.now();
}

function tableRows(state, table) {
  if (!Array.isArray(state[table])) state[table] = [];
  return state[table];
}

class Query {
  constructor(table, operation, payload = null) {
    this.table = table;
    this.operation = operation;
    this.payload = payload;
    this.filters = [];
    this.sort = null;
  }

  eq(field, value) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field, values) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  order(field, options = {}) {
    this.sort = { field, ascending: options.ascending !== false };
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  execute() {
    const state = readState();
    window.__registryQueries = window.__registryQueries || [];
    window.__registryQueries.push(this.table);
    const rows = tableRows(state, this.table);
    const matches = (row) => this.filters.every((filter) => filter(row));

    if (this.operation === "select") {
      let data = rows.filter(matches).map((row) => ({ ...row }));
      if (this.sort) {
        const direction = this.sort.ascending ? 1 : -1;
        data.sort((left, right) => String(left[this.sort.field] || "").localeCompare(String(right[this.sort.field] || "")) * direction);
      }
      return { data: this.wantSingle ? (data[0] || null) : data, error: null };
    }

    if (this.operation === "insert") {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const value of values) {
        if (this.table === "book_registry_loans" &&
          rows.some((row) => row.student_id === value.student_id && row.textbook_id === value.textbook_id)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        const prefix = this.table.includes("students") ? "s" : this.table.includes("textbooks") ? "b" : "l";
        rows.push({ id: nextId(state, prefix), ...value });
      }
      writeState(state);
      return { data: null, error: null };
    }

    if (this.operation === "update") {
      rows.filter(matches).forEach((row) => Object.assign(row, this.payload));
      writeState(state);
      return { data: null, error: null };
    }

    if (this.operation === "delete") {
      const removed = rows.filter(matches);
      state[this.table] = rows.filter((row) => !matches(row));
      if (this.table === "book_registry_students") {
        const ids = removed.map((row) => row.id);
        state.book_registry_loans = tableRows(state, "book_registry_loans").filter((loan) => !ids.includes(loan.student_id));
      }
      if (this.table === "book_registry_textbooks") {
        const ids = removed.map((row) => row.id);
        state.book_registry_loans = tableRows(state, "book_registry_loans").filter((loan) => !ids.includes(loan.textbook_id));
      }
      writeState(state);
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }

  then(resolve, reject) {
    try {
      return Promise.resolve(this.execute()).then(resolve, reject);
    } catch (error) {
      return Promise.reject(error).then(resolve, reject);
    }
  }
}

const client = {
  from(table) {
    return {
      select() { return new Query(table, "select"); },
      insert(payload) { return new Query(table, "insert", payload); },
      update(payload) { return new Query(table, "update", payload); },
      delete() { return new Query(table, "delete"); }
    };
  },
  functions: {
    async invoke() {
      return { data: null, error: null };
    }
  }
};

export function isCloudConfigured() { return true; }
export function getSupabaseClient() { return client; }
export async function getAccountContext() {
  if (ROLE === "signed-out") {
    return { configured: true, signedIn: false, online: true, user: null, profile: null, error: null };
  }
  return {
    configured: true,
    signedIn: true,
    online: true,
    user: { id: "user-1" },
    profile: { id: "user-1", role: ROLE, display_name: ROLE === "teacher" ? "Учитель" : "Ученик" },
    error: null
  };
}
export async function signInWithLogin() { return {}; }
export async function signOutAccount() {}
export async function updateAccountPassword() { return {}; }
export function clearAccountCache() {}
