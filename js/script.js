/*
 * Nexora · Sitio público
 * Muestra la flota desde los datos JSON (vía NexoraStore), permite
 * reservar bicis y envía mensajes de contacto al panel administrativo.
 */
(function () {
  "use strict";

  var Store = window.NexoraStore;
  var state = { type: "todas" };

  /* ---------- Utilidades ---------- */

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
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

  function esc(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
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

  var STATUS = {
    disponible: { cls: "badge-success", label: "Disponible" },
    alquilada: { cls: "badge-info", label: "Alquilada" },
    mantenimiento: { cls: "badge-muted", label: "Mantenimiento" },
  };

  /* Ilustración de bici según el tipo (SVG en línea, sin dependencias) */
  function bikeArtSVG(type) {
    var frame =
      '<circle cx="55" cy="86" r="24" />' +
      '<circle cx="145" cy="86" r="24" />' +
      '<path d="M55 86 L88 44 L105 86 L55 86" />' +
      '<path d="M88 44 L132 44 L105 86" />' +
      '<path d="M132 44 L145 86" />' +
      '<path d="M88 44 L84 36 M76 34 h16" />' +
      '<path d="M132 44 L136 34 M129 31 h14" />' +
      '<circle cx="105" cy="86" r="4" fill="currentColor" stroke="none" />';
    var extra = "";
    if (type === "Eléctrica") {
      extra =
        '<path d="M110 52 l-9 13 h10 l-9 13" stroke-width="5" stroke="#fde68a" />';
    } else if (type === "Montaña") {
      extra =
        '<path d="M18 60 l14 -22 10 14 8 -10 14 18" stroke-width="4" opacity="0.7" />';
    } else {
      extra = '<path d="M136 34 h16 v12 h-16 z" stroke-width="4" />';
    }
    return (
      '<svg viewBox="0 0 200 120" aria-hidden="true" fill="none" ' +
      'stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
      frame +
      extra +
      "</svg>"
    );
  }

  /* ---------- Revelado al hacer scroll ---------- */
  var revealObserver = null;
  function observeReveals(root) {
    if (!("IntersectionObserver" in window)) {
      $all(".reveal", root).forEach(function (el) {
        el.classList.add("visible");
      });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
    }
    $all(".reveal", root).forEach(function (el) {
      if (!el.classList.contains("visible")) revealObserver.observe(el);
    });
  }

  /* ---------- Estadísticas públicas ---------- */
  function renderIndicators() {
    var s = Store.stats();
    $("#statAvailable").textContent = s.bikesAvailable;
    $("#statStations").textContent = s.stations;
    $("#chipAvailable").textContent = s.bikesAvailable;
    $("#chipCo2").textContent = num(s.co2, 1) + " kg";
    $("#aboutStations").textContent = s.stations;
    $("#aboutBikes").textContent = s.bikesTotal;
  }

  /* ---------- Ajustes del sitio ---------- */
  function renderSettings() {
    var cfg = Store.getSettings();
    document.title = cfg.siteName + " | " + cfg.tagline;
    $("#footAbout").textContent = cfg.tagline + " Demo de portafolio con panel administrativo.";
    $("#footEmail").textContent = cfg.contactEmail;
    $("#footPhone").textContent = cfg.phone;
    $("#footAddr").textContent = cfg.address;
    var lead = $(".lead");
    if (lead && cfg.tagline) lead.dataset.tagline = cfg.tagline;
  }

  /* ---------- Flota ---------- */
  function renderFleet() {
    var grid = $("#fleetGrid");
    var bikes = Store.list("bikes");
    var filtered =
      state.type === "todas"
        ? bikes
        : bikes.filter(function (b) {
            return b.type === state.type;
          });

    if (!filtered.length) {
      grid.innerHTML =
        '<p class="fleet-empty">No hay bicicletas de este tipo en la demo en este momento.</p>';
      return;
    }

    grid.innerHTML = filtered
      .map(function (bike) {
        var st = STATUS[bike.status] || STATUS.mantenimiento;
        var art = (bike.type || "Urbana").toLowerCase();
        var canReserve = bike.status === "disponible";
        var battery =
          bike.battery != null
            ? '<span>🔋 <strong>' + esc(bike.battery) + "%</strong></span>"
            : "";
        return (
          '<article class="bike-card reveal">' +
          '<div class="bike-art art-' + esc(art) + '">' +
          '<span class="badge ' + st.cls + '">' + st.label + "</span>" +
          bikeArtSVG(bike.type) +
          "</div>" +
          '<div class="bike-body">' +
          '<span class="bike-type">' + esc(bike.type) + "</span>" +
          "<h3>" + esc(bike.name) + "</h3>" +
          "<p>" + esc(bike.description) + "</p>" +
          '<div class="bike-meta">' +
          "<span>📍 <strong>" + esc(bike.station) + "</strong></span>" +
          battery +
          "<span>📆 <strong>" + esc(bike.year || "—") + "</strong></span>" +
          "</div></div>" +
          '<div class="bike-footer">' +
          '<div class="bike-price">' + euro(bike.priceHour) +
          "<small>por hora · " + euro(bike.priceDay) + "/día</small></div>" +
          '<button type="button" class="btn btn-primary btn-sm js-reserve" data-bike="' +
          esc(bike.id) + '"' + (canReserve ? "" : " disabled") + ">" +
          (canReserve ? "Reservar" : "No disponible") +
          "</button></div></article>"
        );
      })
      .join("");

    observeReveals(grid);
  }

  function initFilters() {
    $all(".filter-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        $all(".filter-chip").forEach(function (c) {
          c.classList.remove("active");
        });
        chip.classList.add("active");
        state.type = chip.dataset.type;
        renderFleet();
      });
    });
  }

  /* ---------- Modal de reserva ---------- */
  function reserveValidators() {
    var today = new Date().toISOString().slice(0, 10);
    return {
      bike: function (v) {
        return !!v || "Elige una bicicleta disponible.";
      },
      name: function (v) {
        return v.trim().length >= 2 || "Ingresa al menos 2 caracteres.";
      },
      email: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Ingresa un correo válido.";
      },
      date: function (v) {
        if (!v) return "Indica la fecha de recogida.";
        return v >= today || "La fecha no puede ser anterior a hoy.";
      },
      hours: function (v) {
        var n = Number(v);
        return (n >= 1 && n <= 72) || "La duración debe ser de 1 a 72 horas.";
      },
    };
  }

  function selectedBike() {
    var id = $("#resBike").value;
    return id ? Store.find("bikes", id) : null;
  }

  function updateReserveSummary() {
    var bike = selectedBike();
    var hours = Number($("#resHours").value) || 0;
    $("#resStation").textContent = bike ? bike.station : "—";
    $("#resTotal").textContent = bike ? euro(bike.priceHour * hours) : "—";
  }

  function populateBikeSelect(preselectId) {
    var select = $("#resBike");
    var available = Store.list("bikes").filter(function (b) {
      return b.status === "disponible";
    });
    if (!available.length) {
      select.innerHTML = '<option value="">No hay bicicletas disponibles ahora</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = available
      .map(function (b) {
        var selected = b.id === preselectId ? " selected" : "";
        return (
          '<option value="' + esc(b.id) + '"' + selected + ">" +
          esc(b.name) + " · " + esc(b.type) + " · " + euro(b.priceHour) + "/h" +
          "</option>"
        );
      })
      .join("");
  }

  function openReserveModal(preselectId) {
    var modal = $("#reserveModal");
    $("#reserveView").hidden = false;
    $("#reserveSuccess").hidden = true;
    populateBikeSelect(preselectId);
    updateReserveSummary();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var first = $("#resBike");
    if (first && !first.disabled) first.focus();
  }

  function closeReserveModal() {
    $("#reserveModal").hidden = true;
    document.body.style.overflow = "";
  }

  function clearFormErrors(form) {
    $all(".invalid", form).forEach(function (el) {
      el.classList.remove("invalid");
    });
    $all(".error", form).forEach(function (el) {
      el.textContent = "";
    });
  }

  function validateForm(form, validators) {
    clearFormErrors(form);
    var valid = true;
    Object.keys(validators).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      var result = validators[name](input.value);
      if (result !== true) {
        valid = false;
        input.classList.add("invalid");
        var errorEl = form.querySelector('.error[data-for="' + name + '"]');
        if (errorEl) errorEl.textContent = result;
      }
    });
    return valid;
  }

  function initReserveModal() {
    var form = $("#reserveForm");
    var dateInput = $("#resDate");
    dateInput.min = new Date().toISOString().slice(0, 10);

    $all(".js-open-reserve").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openReserveModal();
      });
    });

    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".js-reserve");
      if (btn && !btn.disabled) openReserveModal(btn.dataset.bike);
    });

    $all("[data-close]", $("#reserveModal")).forEach(function (el) {
      el.addEventListener("click", closeReserveModal);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#reserveModal").hidden) closeReserveModal();
    });

    $("#resBike").addEventListener("change", updateReserveSummary);
    $("#resHours").addEventListener("input", updateReserveSummary);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateForm(form, reserveValidators())) return;

      var bike = selectedBike();
      if (!bike) {
        toast("No hay bicis disponibles para reservar.", true);
        return;
      }
      var hours = Number(form.elements.hours.value);
      var reservation = Store.create("reservations", {
        bikeId: bike.id,
        customer: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        date: form.elements.date.value,
        hours: hours,
        station: bike.station,
        status: "pendiente",
        total: Math.round(bike.priceHour * hours * 100) / 100,
        createdAt: new Date().toISOString(),
      });

      $("#reserveCode").textContent = reservation.id;
      $("#reserveDetail").textContent =
        bike.name + " · " + reservation.date + " · " + hours +
        " h · " + euro(reservation.total);
      $("#reserveView").hidden = true;
      $("#reserveSuccess").hidden = false;
      $("#reserveAgain").focus();
      toast("Reserva " + reservation.id + " creada correctamente.");
    });

    $("#reserveAgain").addEventListener("click", function () {
      form.reset();
      dateInput.min = new Date().toISOString().slice(0, 10);
      $("#resHours").value = 2;
      $("#reserveView").hidden = false;
      $("#reserveSuccess").hidden = true;
      populateBikeSelect();
      updateReserveSummary();
    });
  }

  /* ---------- Formulario de contacto ---------- */
  function initContactForm() {
    var form = $("#contactForm");
    var success = $("#formSuccess");
    var validators = {
      name: function (v) {
        return v.trim().length >= 2 || "Ingresa al menos 2 caracteres.";
      },
      email: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Ingresa un correo válido.";
      },
      message: function (v) {
        return v.trim().length >= 10 || "El mensaje debe tener al menos 10 caracteres.";
      },
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validateForm(form, validators)) return;

      Store.create("messages", {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        text: form.elements.message.value.trim(),
        date: new Date().toISOString(),
        read: false,
      });

      success.hidden = false;
      form.reset();
      toast("Mensaje guardado. Ya aparece en el panel.");
      setTimeout(function () {
        success.hidden = true;
      }, 5000);
    });
  }

  /* ---------- Contadores de impacto ---------- */
  function animateCounter(el, target, decimals) {
    var duration = 1100;
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = num(target * eased, decimals);
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = num(target, decimals);
    }
    requestAnimationFrame(frame);
  }

  function initEco() {
    var s = Store.stats();
    var section = $("#impacto");
    var done = false;
    function run() {
      if (done) return;
      done = true;
      animateCounter($("#ecoCo2"), s.co2, 1);
      animateCounter($("#ecoKm"), s.kmEquivalent, 1);
      animateCounter($("#ecoTrees"), s.treesEquivalent, 1);
      animateCounter($("#ecoHours"), s.rentedHours, 0);
    }
    if (!("IntersectionObserver" in window)) {
      run();
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            run();
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    io.observe(section);
  }

  /* ---------- Navegación y detalles ---------- */
  function initChrome() {
    $("#year").textContent = new Date().getFullYear();

    var navToggle = $(".nav-toggle");
    var navMenu = $("#nav-menu");
    navToggle.addEventListener("click", function () {
      var open = navMenu.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });
    navMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navMenu.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });

    // Sección activa al hacer scroll
    var sections = $all("section[id]");
    var navLinks = $all('.nav-menu a[href^="#"]');
    if ("IntersectionObserver" in window) {
      var spy = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              navLinks.forEach(function (a) {
                a.classList.toggle(
                  "active",
                  a.getAttribute("href") === "#" + entry.target.id,
                );
              });
            }
          });
        },
        { rootMargin: "-40% 0px -55% 0px" },
      );
      sections.forEach(function (s) {
        spy.observe(s);
      });
    }

    // Sombra del header al hacer scroll
    var header = $("#header");
    window.addEventListener(
      "scroll",
      function () {
        header.style.boxShadow =
          window.scrollY > 10 ? "0 8px 24px rgba(15, 46, 29, 0.12)" : "none";
      },
      { passive: true },
    );
  }

  /* ---------- Arranque ---------- */
  document.addEventListener("DOMContentLoaded", async function () {
    initChrome();

    if (!Store) {
      $("#fleetGrid").innerHTML =
        '<p class="fleet-empty">No se pudo cargar la capa de datos (js/store.js).</p>';
      return;
    }

    try {
      await Store.init();
    } catch (err) {
      console.error("[Nexora] Error al inicializar los datos.", err);
      $("#fleetGrid").innerHTML =
        '<p class="fleet-empty">No se pudieron cargar los datos de la demo.</p>';
      return;
    }

    renderSettings();
    renderIndicators();
    renderFleet();
    initFilters();
    initReserveModal();
    initContactForm();
    initEco();
    observeReveals(document);
  });
})();
