/*
 * Nexora · Store de demostración
 * ---------------------------------------------------------------
 * Capa de datos compartida por el sitio público y el panel admin.
 * - Carga las semillas desde data/*.json (fetch).
 * - Persiste los cambios en localStorage (persistencia local de la demo).
 * - Si la página se abre sin servidor local (file://), se usan los
 *   datos de respaldo incluidos más abajo para no romper la demo.
 *
 * NOTA: localStorage es adecuado para una demostración, pero no
 * sustituye a una base de datos compartida ni aporta seguridad de
 * producción.
 */
(function () {
  "use strict";

  var PREFIX = "nexora.demo.v1.";
  var SESSION_KEY = "nexora.demo.session";

  var SOURCES = {
    bikes: "data/bikes.json",
    reservations: "data/reservations.json",
    users: "data/users.json",
    messages: "data/messages.json",
    settings: "data/settings.json",
  };

  var ID_PREFIX = { bikes: "BK", reservations: "RS", users: "US", messages: "MS" };

  /* Copia de respaldo idéntica a data/*.json (solo se usa si falla el fetch) */
  var FALLBACK = {
    bikes: [
      { id: "BK-001", name: "Nexora City 01", type: "Urbana", description: "Ligera y cómoda para trayectos diarios, con 7 velocidades y portabultos.", priceHour: 1.5, priceDay: 12, status: "disponible", station: "Estación Centro", battery: null, year: 2025, color: "#16a34a" },
      { id: "BK-002", name: "Nexora City 02", type: "Urbana", description: "Cuadro con candado, guardabarros y luz integrada para usar todo el año.", priceHour: 1.5, priceDay: 12, status: "disponible", station: "Estación Norte", battery: null, year: 2025, color: "#0d9488" },
      { id: "BK-003", name: "Nexora E-Bike 01", type: "Eléctrica", description: "Asistencia eléctrica hasta 25 km/h y hasta 70 km de autonomía por carga.", priceHour: 2.5, priceDay: 18, status: "disponible", station: "Estación Centro", battery: 92, year: 2026, color: "#65a30d" },
      { id: "BK-004", name: "Nexora E-Bike 02", type: "Eléctrica", description: "Asistencia progresiva y pantalla con autonomía, ideal para cuestas urbanas.", priceHour: 2.5, priceDay: 18, status: "alquilada", station: "Estación Río", battery: 78, year: 2025, color: "#84cc16" },
      { id: "BK-005", name: "Nexora Trail 01", type: "Montaña", description: "MTB con suspensión delantera y freno de disco para rutas y senderos.", priceHour: 2, priceDay: 15, status: "disponible", station: "Estación Sierra", battery: null, year: 2025, color: "#ca8a04" },
      { id: "BK-006", name: "Nexora Trail 02", type: "Montaña", description: "21 velocidades y neumáticos de agarre para terreno irregular.", priceHour: 2, priceDay: 15, status: "mantenimiento", station: "Taller", battery: null, year: 2024, color: "#ea580c" },
      { id: "BK-007", name: "Nexora City 03", type: "Urbana", description: "Plegable, fácil de guardar y perfecta para combinar con transporte público.", priceHour: 1.5, priceDay: 12, status: "disponible", station: "Estación Sur", battery: null, year: 2026, color: "#16a34a" },
      { id: "BK-008", name: "Nexora E-Bike 03", type: "Eléctrica", description: "Batería ligera y modo eco para trayectos largos sin cansancio.", priceHour: 2.5, priceDay: 18, status: "disponible", station: "Estación Este", battery: 64, year: 2026, color: "#22c55e" },
    ],
    reservations: [
      { id: "RS-001", bikeId: "BK-004", customer: "Laura Gómez", email: "laura@ejemplo.com", date: "2026-10-18", hours: 4, station: "Estación Río", status: "activa", total: 10, createdAt: "2026-10-18T09:15:00" },
      { id: "RS-002", bikeId: "BK-001", customer: "Carlos Ruiz", email: "carlos@ejemplo.com", date: "2026-10-19", hours: 2, station: "Estación Centro", status: "confirmada", total: 3, createdAt: "2026-10-17T18:40:00" },
      { id: "RS-003", bikeId: "BK-003", customer: "Marta López", email: "marta@ejemplo.com", date: "2026-10-20", hours: 6, station: "Estación Centro", status: "pendiente", total: 15, createdAt: "2026-10-19T11:05:00" },
      { id: "RS-004", bikeId: "BK-005", customer: "Diego Torres", email: "diego@ejemplo.com", date: "2026-10-16", hours: 8, station: "Estación Sierra", status: "finalizada", total: 16, createdAt: "2026-10-15T08:30:00" },
      { id: "RS-005", bikeId: "BK-002", customer: "Ana Martín", email: "ana@ejemplo.com", date: "2026-10-15", hours: 3, station: "Estación Norte", status: "finalizada", total: 4.5, createdAt: "2026-10-14T16:20:00" },
      { id: "RS-006", bikeId: "BK-007", customer: "Pablo Sánchez", email: "pablo@ejemplo.com", date: "2026-10-17", hours: 5, station: "Estación Sur", status: "cancelada", total: 7.5, createdAt: "2026-10-16T12:00:00" },
      { id: "RS-007", bikeId: "BK-008", customer: "Lucía Vega", email: "lucia@ejemplo.com", date: "2026-10-22", hours: 12, station: "Estación Este", status: "pendiente", total: 30, createdAt: "2026-10-19T10:10:00" },
    ],
    users: [
      { id: "US-001", name: "Admin Demo", email: "admin@nexora.bike", phone: "+34 600 000 001", role: "admin", status: "activo", password: "demo1234", rentals: 0, joined: "2026-01-10" },
      { id: "US-002", name: "Editor Demo", email: "editor@nexora.bike", phone: "+34 600 000 002", role: "editor", status: "activo", password: "demo1234", rentals: 0, joined: "2026-02-01" },
      { id: "US-003", name: "Laura Gómez", email: "laura@ejemplo.com", phone: "+34 611 111 111", role: "cliente", status: "activo", password: null, rentals: 4, joined: "2026-03-05" },
      { id: "US-004", name: "Carlos Ruiz", email: "carlos@ejemplo.com", phone: "+34 622 222 222", role: "cliente", status: "activo", password: null, rentals: 2, joined: "2026-05-12" },
      { id: "US-005", name: "Marta López", email: "marta@ejemplo.com", phone: "+34 633 333 333", role: "cliente", status: "activo", password: null, rentals: 6, joined: "2026-06-20" },
      { id: "US-006", name: "Diego Torres", email: "diego@ejemplo.com", phone: "+34 644 444 444", role: "cliente", status: "inactivo", password: null, rentals: 1, joined: "2026-07-30" },
    ],
    messages: [
      { id: "MS-001", name: "Elena Ramos", email: "elena@ejemplo.com", text: "¿Ofrecéis alquileres semanales para empresas?", date: "2026-10-17T09:00:00", read: true },
      { id: "MS-002", name: "Jorge Díaz", email: "jorge@ejemplo.com", text: "Me gustaría saber si hay descuento por alquiler mensual.", date: "2026-10-18T17:30:00", read: false },
    ],
    settings: {
      siteName: "Nexora",
      tagline: "Alquiler de bicicletas para una ciudad que respira",
      contactEmail: "hola@nexora.bike",
      phone: "+34 600 000 000",
      address: "Madrid, España",
      co2PerHour: 0.9,
      treeKgYear: 21,
    },
  };

  var db = {};
  var ready = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function persist(name) {
    try {
      localStorage.setItem(PREFIX + name, JSON.stringify(db[name]));
    } catch (err) {
      console.warn("[Nexora] No se pudo guardar " + name + " en localStorage.", err);
    }
  }

  function loadLocal(name) {
    try {
      var raw = localStorage.getItem(PREFIX + name);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  async function loadOne(name) {
    var saved = loadLocal(name);
    if (saved) {
      db[name] = saved;
      return;
    }
    try {
      var res = await fetch(SOURCES[name], { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      db[name] = await res.json();
    } catch (err) {
      console.warn("[Nexora] No se pudo leer " + SOURCES[name] + ", se usan datos de respaldo.", err);
      db[name] = clone(FALLBACK[name]);
    }
    persist(name);
  }

  function assertReady() {
    if (!ready) throw new Error("NexoraStore.init() debe ejecutarse primero.");
  }

  function assertCollection(name) {
    if (!Object.prototype.hasOwnProperty.call(SOURCES, name)) {
      throw new Error("Colección desconocida: " + name);
    }
  }

  async function init() {
    if (ready) return;
    await Promise.all(Object.keys(SOURCES).map(loadOne));
    ready = true;
  }

  /* ---------- CRUD ---------- */

  function list(name) {
    assertReady();
    assertCollection(name);
    return clone(db[name]);
  }

  function find(name, id) {
    assertReady();
    assertCollection(name);
    var item = db[name].find(function (x) { return x.id === id; });
    return item ? clone(item) : null;
  }

  function nextId(name) {
    assertCollection(name);
    var max = db[name].reduce(function (m, x) {
      var n = parseInt(String(x.id).split("-")[1], 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return ID_PREFIX[name] + "-" + String(max + 1).padStart(3, "0");
  }

  function create(name, item) {
    assertReady();
    assertCollection(name);
    var record = clone(item);
    if (Array.isArray(db[name])) {
      if (!record.id) record.id = nextId(name);
      db[name].push(record);
    } else {
      db[name] = record; // settings (objeto único)
    }
    persist(name);
    return clone(record);
  }

  function update(name, id, patch) {
    assertReady();
    assertCollection(name);
    if (name === "settings") {
      db.settings = Object.assign({}, db.settings, patch);
      persist(name);
      return clone(db.settings);
    }
    var item = db[name].find(function (x) { return x.id === id; });
    if (!item) return null;
    Object.assign(item, clone(patch), { id: item.id });
    persist(name);
    return clone(item);
  }

  function remove(name, id) {
    assertReady();
    assertCollection(name);
    var before = db[name].length;
    db[name] = db[name].filter(function (x) { return x.id !== id; });
    persist(name);
    return db[name].length < before;
  }

  /* ---------- Ajustes del sitio ---------- */

  function getSettings() {
    assertReady();
    return clone(db.settings);
  }

  function saveSettings(patch) {
    return update("settings", null, patch);
  }

  /* ---------- Autenticación de demostración ---------- */

  function login(email, password) {
    assertReady();
    var mail = String(email || "").trim().toLowerCase();
    var user = db.users.find(function (u) { return u.email.toLowerCase() === mail; });
    if (!user) return { error: "No existe ninguna cuenta con ese correo." };
    if (user.status !== "activo") return { error: "La cuenta está desactivada." };
    if (user.role === "cliente") return { error: "Este acceso es solo para el personal del panel." };
    if (String(user.password || "") !== String(password || "")) {
      return { error: "Contraseña incorrecta. Usa las credenciales de demostración." };
    }
    var session = { id: user.id, name: user.name, email: user.email, role: user.role };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) { /* almacenamiento no disponible */ }
    return { user: session };
  }

  function session() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (err) {
      return null;
    }
  }

  function logout() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (err) { /* nada que hacer */ }
  }

  /* ---------- Indicadores ---------- */

  function stats() {
    assertReady();
    var bikes = db.bikes;
    var res = db.reservations;
    var settings = db.settings;
    var count = function (status) {
      return res.filter(function (r) { return r.status === status; }).length;
    };
    var rentedHours = res
      .filter(function (r) { return r.status === "finalizada" || r.status === "activa"; })
      .reduce(function (sum, r) { return sum + (Number(r.hours) || 0); }, 0);
    var revenue = res
      .filter(function (r) { return r.status === "finalizada" || r.status === "activa"; })
      .reduce(function (sum, r) { return sum + (Number(r.total) || 0); }, 0);
    var co2 = Math.round(rentedHours * (Number(settings.co2PerHour) || 0.9) * 10) / 10;

    return {
      bikesTotal: bikes.length,
      bikesAvailable: bikes.filter(function (b) { return b.status === "disponible"; }).length,
      bikesRented: bikes.filter(function (b) { return b.status === "alquilada"; }).length,
      bikesMaintenance: bikes.filter(function (b) { return b.status === "mantenimiento"; }).length,
      stations: new Set(bikes.map(function (b) { return b.station; })).size,
      resPending: count("pendiente"),
      resConfirmed: count("confirmada"),
      resActive: count("activa"),
      resDone: count("finalizada"),
      resCancelled: count("cancelada"),
      resTotal: res.length,
      clients: db.users.filter(function (u) { return u.role === "cliente"; }).length,
      usersActive: db.users.filter(function (u) { return u.status === "activo"; }).length,
      messagesUnread: db.messages.filter(function (m) { return !m.read; }).length,
      revenue: Math.round(revenue * 100) / 100,
      rentedHours: rentedHours,
      co2: co2,
      kmEquivalent: Math.round((co2 / 0.12) * 10) / 10,
      treesEquivalent: Math.round((co2 / (Number(settings.treeKgYear) || 21)) * 10) / 10,
    };
  }

  /* ---------- Restaurar semillas ---------- */

  async function resetDemo() {
    Object.keys(SOURCES).forEach(function (name) {
      try { localStorage.removeItem(PREFIX + name); } catch (err) { /* nada */ }
    });
    try { sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* nada */ }
    ready = false;
    db = {};
    await init();
  }

  window.NexoraStore = {
    init: init,
    list: list,
    find: find,
    create: create,
    update: update,
    remove: remove,
    nextId: nextId,
    getSettings: getSettings,
    saveSettings: saveSettings,
    login: login,
    logout: logout,
    session: session,
    stats: stats,
    resetDemo: resetDemo,
  };
})();
