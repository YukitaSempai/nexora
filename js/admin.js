/*
 * Nexora · Panel de administración (demo)
 * Login de demostración con roles (admin/editor), navegación por vistas,
 * CRUD de bicicletas, reservas, usuarios y mensajes, y ajustes del sitio.
 * Los datos viven en data/*.json y se persisten en localStorage.
 */
(function () {
  "use strict";

  var Store = window.NexoraStore;
  var me = null;

  var ALLOWED = {
    admin: ["dashboard", "bikes", "reservations", "users", "messages", "settings"],
    editor: ["dashboard", "bikes", "reservations", "messages"],
  };
  var TITLES = {
    dashboard: "Resumen",
    bikes: "Bicicletas",
    reservations: "Reservas y alquileres",
    users: "Usuarios",
    messages: "Mensajes de contacto",
    settings: "Configuración",
  };

  var RES_BADGE = {
    pendiente: { cls: "badge-warning", label: "Pendiente" },
    confirmada: { cls: "badge-soft", label: "Confirmada" },
    activa: { cls: "badge-info", label: "Activa" },
    finalizada: { cls: "badge-success", label: "Finalizada" },
    cancelada: { cls: "badge-danger", label: "Cancelada" },
  };
  var BIKE_BADGE = {
    disponible: { cls: "badge-success", label: "Disponible" },
    alquilada: { cls: "badge-info", label: "Alquilada" },
    mantenimiento: { cls: "badge-muted", label: "Mantenimiento" },
  };
  var ROLE_BADGE = {
    admin: { cls: "badge-soft", label: "Admin" },
    editor: { cls: "badge-info", label: "Editor" },
    cliente: { cls: "badge-muted", label: "Cliente" },
  };
  var USER_BADGE = {
    activo: { cls: "badge-success", label: "Activo" },
    inactivo: { cls: "badge-danger", label: "Inactivo" },
  };

  /* ---------- Utilidades ---------- */

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  function esc(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function euro(value) {
    return Number(value || 0).toLocaleString("es-ES", {
      style: "currency",
      currency: "EUR",
    });
  }

  function num(value, decimals) {
    return Number(value || 0).toLocaleString("es-ES", {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals === undefined ? 1 : decimals,
    });
  }

  function badge(map, key, fallback) {
    var b = map[key] || fallback || { cls: "badge-muted", label: key || "—" };
    return '<span class="badge ' + b.cls + '">' + esc(b.label) + "</span>";
  }

  function emptyRow(cols) {
    return (
      '<tr class="empty-row"><td colspan="' + cols +
      '">No hay registros que coincidan con la búsqueda.</td></tr>'
    );
  }

  var toastTimer = null;
  function toast(message, isError) {
    var el = $("#toast");
    if (!el) return;
    el.innerHTML =
      '<span class="toast-icon">' + (isError ? "⚠️" : "✅") + "</span>" + esc(message);
    el.classList.toggle("error", !!isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 3200);
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function bikeName(id) {
    var bike = id ? Store.find("bikes", id) : null;
    return bike ? bike.name : "—";
  }

  /* ---------- Autenticación / sesiones ---------- */

  function showLogin() {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginError").textContent = "";
    $("#loginPass").value = "";
    me = null;
  }

  function fillUserChip() {
    $("#userName").textContent = me.name;
    $("#userRole").textContent = me.role;
    $("#userInitials").textContent = (me.name || "U")
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) {
        return w.charAt(0).toUpperCase();
      })
      .join("");
  }

  function applyRBAC() {
    var allowed = ALLOWED[me.role] || [];
    $all(".side-link[data-view]").forEach(function (btn) {
      btn.hidden = allowed.indexOf(btn.dataset.view) === -1;
    });
  }

  function showApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    fillUserChip();
    applyRBAC();
    var fromHash = (location.hash || "").replace("#", "");
    go(fromHash || "dashboard");
  }

  function canAccess(view) {
    return (ALLOWED[me.role] || []).indexOf(view) !== -1;
  }

  /* ---------- Navegación entre vistas ---------- */

  var currentView = null;

  function go(view) {
    if (!me) return;
    if (!TITLES[view]) view = "dashboard";
    if (!canAccess(view)) {
      toast("Tu rol no tiene acceso a «" + (TITLES[view] || view) + "».", true);
      view = "dashboard";
    }

    currentView = view;
    $all(".admin-view").forEach(function (sec) {
      sec.hidden = sec.id !== "view-" + view;
    });
    $all(".side-link[data-view]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    $("#viewTitle").textContent = TITLES[view];
    if (location.hash !== "#" + view) location.hash = view;
    $("#sidebar").classList.remove("open");

    render(view);
  }

  function render(view) {
    if (view === "dashboard") renderDashboard();
    else if (view === "bikes") renderBikes();
    else if (view === "reservations") renderReservations();
    else if (view === "users") renderUsers();
    else if (view === "messages") renderMessages();
    else if (view === "settings") renderSettings();
    updateBadges();
  }

  function refresh() {
    render(currentView);
    updateBadges();
  }

  function updateBadges() {
    var unread = Store.stats().messagesUnread;
    var badgeEl = $("#msgBadge");
    badgeEl.hidden = unread === 0;
    badgeEl.textContent = unread;
  }

  /* ---------- Resumen ---------- */

  function renderDashboard() {
    var s = Store.stats();
    var tiles = [
      { ico: "🚲", value: s.bikesAvailable + " / " + s.bikesTotal, label: "Bicis disponibles" },
      { ico: "🔧", value: s.bikesRented, label: "Bicis alquiladas" },
      { ico: "🕐", value: s.resPending, label: "Reservas pendientes" },
      { ico: "🚴", value: s.resActive, label: "Alquileres activos" },
      { ico: "💶", value: euro(s.revenue), label: "Ingresos (demo)" },
      { ico: "✉️", value: s.messagesUnread, label: "Mensajes sin leer" },
    ];
    $("#dashStats").innerHTML = tiles
      .map(function (t) {
        return (
          '<div class="stat-tile"><span class="st-ico">' + t.ico + "</span>" +
          '<span class="st-value">' + esc(t.value) + "</span>" +
          '<span class="st-label">' + esc(t.label) + "</span></div>"
        );
      })
      .join("");

    var recent = Store.list("reservations")
      .sort(function (a, b) {
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      })
      .slice(0, 5);
    $("#recentResBody").innerHTML = recent.length
      ? recent
          .map(function (r) {
            return (
              "<tr><td><span class='cell-main'>" + esc(r.id) + "</span></td>" +
              "<td>" + esc(r.customer) + "</td>" +
              "<td>" + esc(bikeName(r.bikeId)) + "</td>" +
              "<td>" + esc(r.date) + "</td>" +
              "<td>" + badge(RES_BADGE, r.status) + "</td></tr>"
            );
          })
          .join("")
      : emptyRow(5);

    $("#dashEco").innerHTML = [
      { label: "CO₂ potencialmente evitado", value: num(s.co2, 1) + " kg" },
      { label: "Km equivalentes en coche", value: num(s.kmEquivalent, 1) + " km" },
      { label: "Horas pedaleando en la demo", value: num(s.rentedHours, 0) + " h" },
      { label: "Árboles/año equivalentes", value: num(s.treesEquivalent, 1) },
    ]
      .map(function (row) {
        return (
          '<div class="mini-eco-row"><span>' + esc(row.label) +
          "</span><strong>" + esc(row.value) + "</strong></div>"
        );
      })
      .join("");
  }

  /* ---------- Bicicletas ---------- */

  function filteredBikes() {
    var q = $("#bikeSearch").value.trim().toLowerCase();
    var status = $("#bikeFilter").value;
    var type = $("#bikeTypeFilter").value;
    return Store.list("bikes").filter(function (b) {
      var matchQ =
        !q ||
        [b.id, b.name, b.station, b.type]
          .join(" ")
          .toLowerCase()
          .indexOf(q) !== -1;
      var matchStatus = status === "todos" || b.status === status;
      var matchType = type === "todos" || b.type === type;
      return matchQ && matchStatus && matchType;
    });
  }

  function renderBikes() {
    var rows = filteredBikes();
    var total = Store.list("bikes").length;
    $("#bikeCount").textContent = rows.length === total ? total : rows.length + " / " + total;
    $("#bikeTableBody").innerHTML = rows.length
      ? rows
          .map(function (b) {
            var battery = b.battery != null ? esc(b.battery) + "%" : "—";
            return (
              "<tr>" +
              "<td><span class='cell-main'>" + esc(b.id) + "</span></td>" +
              "<td><span class='cell-main'>" + esc(b.name) + "</span>" +
              "<span class='cell-sub'>" + esc(String(b.year || "")) + "</span></td>" +
              "<td>" + esc(b.type) + "</td>" +
              "<td>" + esc(b.station) + "</td>" +
              "<td>" + euro(b.priceHour) + "/h · " + euro(b.priceDay) + "/día</td>" +
              "<td>" + battery + "</td>" +
              "<td>" + badge(BIKE_BADGE, b.status) + "</td>" +
              "<td><div class='row-actions'>" +
              "<button type='button' class='btn btn-ghost btn-sm' data-act='edit' data-id='" +
              esc(b.id) + "'>Editar</button>" +
              "<button type='button' class='btn btn-danger btn-sm' data-act='del' data-id='" +
              esc(b.id) + "'>Eliminar</button>" +
              "</div></td></tr>"
            );
          })
          .join("")
      : emptyRow(8);
  }

  function openBikeForm(id) {
    var panel = $("#bikeFormPanel");
    var form = $("#bikeForm");
    form.reset();
    $("#bId").value = "";
    if (id) {
      var b = Store.find("bikes", id);
      if (!b) return;
      $("#bikeFormTitle").textContent = "Editar bicicleta · " + b.id;
      $("#bId").value = b.id;
      $("#bName").value = b.name;
      $("#bType").value = b.type;
      $("#bStatus").value = b.status;
      $("#bStation").value = b.station;
      $("#bPriceHour").value = b.priceHour;
      $("#bPriceDay").value = b.priceDay;
      $("#bBattery").value = b.battery != null ? b.battery : "";
      $("#bYear").value = b.year || "";
      $("#bColor").value = b.color || "#16a34a";
      $("#bDesc").value = b.description;
    } else {
      $("#bikeFormTitle").textContent = "Nueva bicicleta";
      $("#bColor").value = "#16a34a";
      $("#bYear").value = new Date().getFullYear();
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("#bName").focus();
  }

  function saveBike(e) {
    e.preventDefault();
    var id = $("#bId").value;
    var data = {
      name: $("#bName").value.trim(),
      type: $("#bType").value,
      status: $("#bStatus").value,
      station: $("#bStation").value.trim(),
      priceHour: Number($("#bPriceHour").value),
      priceDay: Number($("#bPriceDay").value),
      battery: $("#bBattery").value === "" ? null : Number($("#bBattery").value),
      year: $("#bYear").value === "" ? null : Number($("#bYear").value),
      color: $("#bColor").value,
      description: $("#bDesc").value.trim(),
    };
    if (!data.name || !data.station || !data.description || !(data.priceHour > 0)) {
      toast("Completa los campos obligatorios.", true);
      return;
    }
    if (id) {
      Store.update("bikes", id, data);
      toast("Bicicleta " + id + " actualizada.");
    } else {
      var created = Store.create("bikes", data);
      toast("Bicicleta " + created.id + " creada.");
    }
    $("#bikeFormPanel").hidden = true;
    refresh();
  }

  function deleteBike(id) {
    if (!confirmAction("¿Eliminar la bicicleta " + id + "? Esta acción no se puede deshacer.")) return;
    Store.remove("bikes", id);
    toast("Bicicleta " + id + " eliminada.");
    refresh();
  }

  /* ---------- Reservas ---------- */

  function filteredReservations() {
    var q = $("#resSearch").value.trim().toLowerCase();
    var status = $("#resFilter").value;
    return Store.list("reservations").filter(function (r) {
      var matchQ =
        !q ||
        [r.id, r.customer, r.email, bikeName(r.bikeId)]
          .join(" ")
          .toLowerCase()
          .indexOf(q) !== -1;
      var matchStatus = status === "todos" || r.status === status;
      return matchQ && matchStatus;
    });
  }

  function resActions(r) {
    var acts = [];
    if (r.status === "pendiente") {
      acts.push(["confirm", "Confirmar", "btn-primary"]);
      acts.push(["cancel", "Cancelar", "btn-ghost"]);
    } else if (r.status === "confirmada") {
      acts.push(["start", "Iniciar", "btn-primary"]);
      acts.push(["cancel", "Cancelar", "btn-ghost"]);
    } else if (r.status === "activa") {
      acts.push(["finish", "Finalizar", "btn-primary"]);
    }
    acts.push(["edit", "Editar", "btn-ghost"]);
    acts.push(["del", "Eliminar", "btn-danger"]);
    return acts
      .map(function (a) {
        return (
          "<button type='button' class='btn btn-sm " + a[2] +
          "' data-act='" + a[0] + "' data-id='" + esc(r.id) + "'>" + a[1] + "</button>"
        );
      })
      .join("");
  }

  function renderReservations() {
    var rows = filteredReservations();
    var total = Store.list("reservations").length;
    $("#resCount").textContent = rows.length === total ? total : rows.length + " / " + total;
    $("#resTableBody").innerHTML = rows.length
      ? rows
          .map(function (r) {
            return (
              "<tr>" +
              "<td><span class='cell-main'>" + esc(r.id) + "</span></td>" +
              "<td><span class='cell-main'>" + esc(r.customer) + "</span>" +
              "<span class='cell-sub'>" + esc(r.email) + "</span></td>" +
              "<td>" + esc(bikeName(r.bikeId)) + "</td>" +
              "<td>" + esc(r.date) + "</td>" +
              "<td>" + esc(r.hours) + " h</td>" +
              "<td>" + euro(r.total) + "</td>" +
              "<td>" + badge(RES_BADGE, r.status) + "</td>" +
              "<td><div class='row-actions'>" + resActions(r) + "</div></td>" +
              "</tr>"
            );
          })
          .join("")
      : emptyRow(8);
  }

  function syncBikeForStatus(res, newStatus, oldStatus) {
    var bike = res.bikeId ? Store.find("bikes", res.bikeId) : null;
    if (!bike) return;
    if (newStatus === "activa" && bike.status === "disponible") {
      Store.update("bikes", bike.id, { status: "alquilada" });
    }
    if (
      (newStatus === "finalizada" || newStatus === "cancelada") &&
      oldStatus === "activa" &&
      bike.status === "alquilada"
    ) {
      Store.update("bikes", bike.id, { status: "disponible" });
    }
  }

  function applyReservationStatus(res, newStatus) {
    if (res.status === newStatus) return true;
    if (newStatus === "activa") {
      var bike = res.bikeId ? Store.find("bikes", res.bikeId) : null;
      if (bike && bike.status !== "disponible") {
        toast("La bicicleta no está disponible (estado: " + bike.status + ").", true);
        return false;
      }
    }
    syncBikeForStatus(res, newStatus, res.status);
    Store.update("reservations", res.id, { status: newStatus });
    return true;
  }

  function transitionRes(id, action) {
    var res = Store.find("reservations", id);
    if (!res) return;
    if (action === "del") {
      if (!confirmAction("¿Eliminar la reserva " + id + "?")) return;
      syncBikeForStatus(res, "cancelada", res.status);
      Store.remove("reservations", id);
      toast("Reserva " + id + " eliminada.");
      refresh();
      return;
    }
    var next = { confirm: "confirmada", start: "activa", finish: "finalizada", cancel: "cancelada" }[action];
    if (!next) return;
    if (applyReservationStatus(res, next)) {
      toast("Reserva " + id + " ahora está «" + (RES_BADGE[next] || {}).label + "».");
      refresh();
    }
  }

  function fillBikeSelect(selectedId) {
    var select = $("#rBike");
    var bikes = Store.list("bikes");
    select.innerHTML = bikes
      .map(function (b) {
        var sel = b.id === selectedId ? " selected" : "";
        return (
          '<option value="' + esc(b.id) + '"' + sel + ">" +
          esc(b.name) + " · " + esc(b.type) + " (" + esc(b.status) + ")" +
          "</option>"
        );
      })
      .join("");
    if (selectedId && !bikes.some(function (b) { return b.id === selectedId; })) {
      select.insertAdjacentHTML(
        "beforeend",
        '<option value="' + esc(selectedId) + '" selected>Bicicleta eliminada</option>',
      );
    }
  }

  function openResForm(id) {
    var panel = $("#resFormPanel");
    $("#resForm").reset();
    $("#rId").value = "";
    if (id) {
      var r = Store.find("reservations", id);
      if (!r) return;
      $("#resFormTitle").textContent = "Editar reserva · " + r.id;
      $("#rId").value = r.id;
      fillBikeSelect(r.bikeId);
      $("#rStatus").value = r.status;
      $("#rCustomer").value = r.customer;
      $("#rEmail").value = r.email;
      $("#rDate").value = r.date;
      $("#rHours").value = r.hours;
    } else {
      $("#resFormTitle").textContent = "Nueva reserva";
      fillBikeSelect();
      $("#rDate").value = new Date().toISOString().slice(0, 10);
      $("#rHours").value = 2;
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("#rCustomer").focus();
  }

  function saveRes(e) {
    e.preventDefault();
    var id = $("#rId").value;
    var bikeId = $("#rBike").value;
    var bike = bikeId ? Store.find("bikes", bikeId) : null;
    var hours = Number($("#rHours").value);
    var status = $("#rStatus").value;
    var base = {
      bikeId: bikeId,
      customer: $("#rCustomer").value.trim(),
      email: $("#rEmail").value.trim(),
      date: $("#rDate").value,
      hours: hours,
      station: bike ? bike.station : "—",
      total: bike ? Math.round(bike.priceHour * hours * 100) / 100 : 0,
    };
    if (!base.customer || !base.email || !base.date || !(hours >= 1)) {
      toast("Completa los campos obligatorios.", true);
      return;
    }

    if (id) {
      var res = Store.find("reservations", id);
      Store.update("reservations", id, base);
      if (res) {
        var updated = Store.find("reservations", id);
        applyReservationStatus(updated, status);
      }
      toast("Reserva " + id + " actualizada.");
    } else {
      var created = Store.create("reservations", {
        bikeId: bikeId,
        customer: base.customer,
        email: base.email,
        date: base.date,
        hours: hours,
        station: base.station,
        status: "pendiente",
        total: base.total,
        createdAt: new Date().toISOString(),
      });
      if (status !== "pendiente") {
        applyReservationStatus(created, status);
      }
      toast("Reserva " + created.id + " creada.");
    }
    $("#resFormPanel").hidden = true;
    refresh();
  }

  /* ---------- Usuarios ---------- */

  function filteredUsers() {
    var q = $("#userSearch").value.trim().toLowerCase();
    var role = $("#userRoleFilter").value;
    return Store.list("users").filter(function (u) {
      var matchQ =
        !q || [u.id, u.name, u.email].join(" ").toLowerCase().indexOf(q) !== -1;
      var matchRole = role === "todos" || u.role === role;
      return matchQ && matchRole;
    });
  }

  function renderUsers() {
    var rows = filteredUsers();
    var total = Store.list("users").length;
    $("#userCount").textContent = rows.length === total ? total : rows.length + " / " + total;
    $("#userTableBody").innerHTML = rows.length
      ? rows
          .map(function (u) {
            var isMe = u.id === me.id;
            return (
              "<tr>" +
              "<td><span class='cell-main'>" + esc(u.id) + "</span></td>" +
              "<td><span class='cell-main'>" + esc(u.name) + "</span>" +
              (isMe ? "<span class='cell-sub'>Tú</span>" : "") + "</td>" +
              "<td>" + esc(u.email) + "</td>" +
              "<td>" + esc(u.phone || "—") + "</td>" +
              "<td>" + badge(ROLE_BADGE, u.role) + "</td>" +
              "<td>" + badge(USER_BADGE, u.status) + "</td>" +
              "<td>" + esc(u.rentals || 0) + "</td>" +
              "<td><div class='row-actions'>" +
              "<button type='button' class='btn btn-ghost btn-sm' data-act='edit' data-id='" +
              esc(u.id) + "'>Editar</button>" +
              "<button type='button' class='btn btn-ghost btn-sm' data-act='toggle' data-id='" +
              esc(u.id) + "'>" +
              (u.status === "activo" ? "Desactivar" : "Activar") + "</button>" +
              "<button type='button' class='btn btn-danger btn-sm' data-act='del' data-id='" +
              esc(u.id) + "'>Eliminar</button>" +
              "</div></td></tr>"
            );
          })
          .join("")
      : emptyRow(8);
  }

  function openUserForm(id) {
    var panel = $("#userFormPanel");
    $("#userForm").reset();
    $("#uId").value = "";
    $("#uPassword").required = false;
    if (id) {
      var u = Store.find("users", id);
      if (!u) return;
      $("#userFormTitle").textContent = "Editar usuario · " + u.id;
      $("#uId").value = u.id;
      $("#uName").value = u.name;
      $("#uEmail").value = u.email;
      $("#uPhone").value = u.phone || "";
      $("#uRole").value = u.role;
      $("#uStatus").value = u.status;
    } else {
      $("#userFormTitle").textContent = "Nuevo usuario";
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("#uName").focus();
  }

  function saveUser(e) {
    e.preventDefault();
    var id = $("#uId").value;
    var role = $("#uRole").value;
    var status = $("#uStatus").value;
    var password = $("#uPassword").value;

    if (id === me.id && status === "inactivo") {
      toast("No puedes desactivar tu propia cuenta.", true);
      return;
    }
    if (!id && (role === "admin" || role === "editor") && !password) {
      toast("El personal del panel necesita una contraseña.", true);
      $("#uPassword").focus();
      return;
    }

    var data = {
      name: $("#uName").value.trim(),
      email: $("#uEmail").value.trim(),
      phone: $("#uPhone").value.trim(),
      role: role,
      status: status,
    };

    if (id) {
      if (password) data.password = password;
      var existing = Store.find("users", id);
      if (existing && existing.role !== "cliente" && !existing.password && !password) {
        toast("Esta cuenta de panel necesita una contraseña.", true);
        return;
      }
      Store.update("users", id, data);
      toast("Usuario " + id + " actualizado.");
    } else {
      data.password = password || null;
      data.rentals = 0;
      data.joined = new Date().toISOString().slice(0, 10);
      var created = Store.create("users", data);
      toast("Usuario " + created.id + " creado.");
    }
    $("#userFormPanel").hidden = true;
    refresh();
  }

  function toggleUser(id) {
    var u = Store.find("users", id);
    if (!u) return;
    if (u.id === me.id && u.status === "activo") {
      toast("No puedes desactivar tu propia cuenta.", true);
      return;
    }
    var next = u.status === "activo" ? "inactivo" : "activo";
    Store.update("users", id, { status: next });
    toast("Usuario " + id + " ahora está " + next + ".");
    refresh();
  }

  function deleteUser(id) {
    if (id === me.id) {
      toast("No puedes eliminar tu propia cuenta.", true);
      return;
    }
    if (!confirmAction("¿Eliminar el usuario " + id + "?")) return;
    Store.remove("users", id);
    toast("Usuario " + id + " eliminado.");
    refresh();
  }

  /* ---------- Mensajes ---------- */

  function renderMessages() {
    var msgs = Store.list("messages").sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    $("#msgCount").textContent = msgs.length;
    $("#msgList").innerHTML = msgs.length
      ? msgs
          .map(function (m) {
            var when = m.date ? new Date(m.date).toLocaleString("es-ES") : "—";
            return (
              '<article class="msg-item' + (m.read ? "" : " unread") + '">' +
              '<span class="msg-dot" aria-hidden="true"></span>' +
              '<div class="msg-body">' +
              '<div class="msg-head"><strong>' + esc(m.name) + "</strong>" +
              "<span>" + esc(m.email) + "</span><span>" + esc(when) + "</span></div>" +
              '<p class="msg-text">' + esc(m.text) + "</p></div>" +
              '<div class="msg-actions">' +
              "<button type='button' class='btn btn-ghost btn-sm' data-act='read' data-id='" +
              esc(m.id) + "'>" + (m.read ? "No leído" : "Marcar leído") + "</button>" +
              "<button type='button' class='btn btn-danger btn-sm' data-act='del' data-id='" +
              esc(m.id) + "'>Eliminar</button>" +
              "</div></article>"
            );
          })
          .join("")
      : '<p class="panel-note">No hay mensajes de contacto.</p>';
  }

  function msgAction(action, id) {
    var m = Store.find("messages", id);
    if (!m) return;
    if (action === "read") {
      Store.update("messages", id, { read: !m.read });
      toast(m.read ? "Mensaje marcado como no leído." : "Mensaje marcado como leído.");
    } else if (action === "del") {
      if (!confirmAction("¿Eliminar el mensaje de " + m.name + "?")) return;
      Store.remove("messages", id);
      toast("Mensaje eliminado.");
    }
    refresh();
  }

  /* ---------- Configuración ---------- */

  function renderSettings() {
    var cfg = Store.getSettings();
    $("#sSiteName").value = cfg.siteName;
    $("#sTagline").value = cfg.tagline;
    $("#sEmail").value = cfg.contactEmail;
    $("#sPhone").value = cfg.phone;
    $("#sAddress").value = cfg.address;
    $("#sCo2").value = cfg.co2PerHour;
  }

  function saveSettings(e) {
    e.preventDefault();
    Store.saveSettings({
      siteName: $("#sSiteName").value.trim(),
      tagline: $("#sTagline").value.trim(),
      contactEmail: $("#sEmail").value.trim(),
      phone: $("#sPhone").value.trim(),
      address: $("#sAddress").value.trim(),
      co2PerHour: Number($("#sCo2").value) || 0.9,
    });
    toast("Configuración guardada. Visible en el sitio público.");
  }

  async function resetDemo() {
    if (!confirmAction("¿Restaurar los datos originales de la demo? Se perderán los cambios y cerrarás la sesión.")) return;
    await Store.resetDemo();
    showLogin();
    toast("Datos de ejemplo restaurados. Vuelve a iniciar sesión.");
  }

  /* ---------- Eventos ---------- */

  function bindEvents() {
    // Login
    $("#loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var result = Store.login($("#loginEmail").value, $("#loginPass").value);
      if (result.error) {
        $("#loginError").textContent = result.error;
        return;
      }
      me = result.user;
      showApp();
      toast("Bienvenido/a, " + me.name + ".");
    });

    // Sesión
    $("#logoutBtn").addEventListener("click", function () {
      Store.logout();
      showLogin();
      toast("Sesión cerrada.");
    });

    // Navegación lateral
    $all(".side-link[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        go(btn.dataset.view);
      });
    });
    $all("[data-jump]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        go(btn.dataset.jump);
      });
    });
    $("#sideToggle").addEventListener("click", function () {
      $("#sidebar").classList.toggle("open");
    });
    window.addEventListener("hashchange", function () {
      var view = (location.hash || "").replace("#", "");
      if (view && view !== currentView) go(view);
    });

    // Bicicletas
    $("#bikeSearch").addEventListener("input", renderBikes);
    $("#bikeFilter").addEventListener("change", renderBikes);
    $("#bikeTypeFilter").addEventListener("change", renderBikes);
    $("#bikeNewBtn").addEventListener("click", function () {
      openBikeForm();
    });
    $("#bikeCancel").addEventListener("click", function () {
      $("#bikeFormPanel").hidden = true;
    });
    $("#bikeForm").addEventListener("submit", saveBike);
    $("#bikeTableBody").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "edit") openBikeForm(btn.dataset.id);
      else if (btn.dataset.act === "del") deleteBike(btn.dataset.id);
    });

    // Reservas
    $("#resSearch").addEventListener("input", renderReservations);
    $("#resFilter").addEventListener("change", renderReservations);
    $("#resNewBtn").addEventListener("click", function () {
      openResForm();
    });
    $("#resCancel").addEventListener("click", function () {
      $("#resFormPanel").hidden = true;
    });
    $("#resForm").addEventListener("submit", saveRes);
    $("#resTableBody").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "edit") openResForm(btn.dataset.id);
      else transitionRes(btn.dataset.id, btn.dataset.act);
    });

    // Usuarios
    $("#userSearch").addEventListener("input", renderUsers);
    $("#userRoleFilter").addEventListener("change", renderUsers);
    $("#userNewBtn").addEventListener("click", function () {
      openUserForm();
    });
    $("#userCancel").addEventListener("click", function () {
      $("#userFormPanel").hidden = true;
    });
    $("#userForm").addEventListener("submit", saveUser);
    $("#userTableBody").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var act = btn.dataset.act;
      var id = btn.dataset.id;
      if (act === "edit") openUserForm(id);
      else if (act === "toggle") toggleUser(id);
      else if (act === "del") deleteUser(id);
    });

    // Mensajes
    $("#msgList").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      msgAction(btn.dataset.act, btn.dataset.id);
    });

    // Configuración
    $("#settingsForm").addEventListener("submit", saveSettings);
    $("#resetBtn").addEventListener("click", resetDemo);
  }

  /* ---------- Arranque ---------- */

  document.addEventListener("DOMContentLoaded", async function () {
    if (!Store) {
      $("#loginError").textContent = "No se pudo cargar la capa de datos (js/store.js).";
      return;
    }
    try {
      await Store.init();
    } catch (err) {
      console.error("[Nexora] Error al inicializar los datos.", err);
      $("#loginError").textContent = "No se pudieron cargar los datos de la demo.";
      return;
    }
    bindEvents();
    me = Store.session();
    if (me && (ALLOWED[me.role] || []).length) showApp();
    else showLogin();
  });
})();
