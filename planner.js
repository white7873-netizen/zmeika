/* ===== Планировщик одной переговорки ===== */
(function () {
  "use strict";

  // ---------- Константы ----------
  var ROOM_NAME = "Переговорная «Альфа»";
  var DAY_START = 8;   // 08:00
  var DAY_END = 21;    // 21:00
  var SLOT_H = 48;     // высота одного часа в сетке, px
  var LS_KEY = "meeting-room-bookings-v1";

  var COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
                "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

  // ---------- Состояние ----------
  var bookings = load();
  var viewDate = new Date();
  var weekStart = startOfWeek(new Date());
  var editingId = null;
  var colorIdx = 0;
  var currentView = "day";

  // ---------- Утилиты ----------
  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, "0"); }

  function dateKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function parseDateKey(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(d, n) {
    var r = new Date(d.getTime());
    r.setDate(r.getDate() + n);
    return r;
  }
  function startOfWeek(d) { // понедельник
    var r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = (r.getDay() + 6) % 7;
    return addDays(r, -day);
  }
  function sameDay(a, b) { return dateKey(a) === dateKey(b); }

  var MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь",
                "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  var WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  var WEEKDAYS_FULL = ["понедельник","вторник","среда","четверг",
                       "пятница","суббота","воскресенье"];

  function fmtTime(mins) { return pad(Math.floor(mins/60)) + ":" + pad(mins%60); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function toMin(hhmm) {
    var p = String(hhmm).split(":");
    if (p.length < 2) return NaN;
    var h = +p[0], m = +p[1];
    if (isNaN(h) || isNaN(m)) return NaN;
    return h*60 + m;
  }
  function toHHMM(mins) { return fmtTime(mins); }

  // ---------- Хранилище ----------
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(bookings)); } catch (e) {}
  }
  function uid() {
    return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Логика бронирований ----------
  function overlaps(a, b) {
    return a.date === b.date && a.start < b.end && b.start < a.end;
  }
  function findConflicts(cand, ignoreId) {
    return bookings.filter(function (b) {
      if (b.id === ignoreId) return false;
      return overlaps(b, cand);
    });
  }

  function seedDemo() {
    if (bookings.length) return;
    var today = dateKey(new Date());
    var tomorrow = dateKey(addDays(new Date(), 1));
    bookings = [
      { id: uid(), date: today, start: 10*60, end: 11*60, title: "Дейли команды",
        organizer: "Анна", attendees: "Анна, Борис, Вера", note: "", color: COLORS[0] },
      { id: uid(), date: today, start: 14*60, end: 15*60+30, title: "Интервью с кандидатом",
        organizer: "Игорь", attendees: "Игорь, Светлана", note: "Онлайн-подключение", color: COLORS[2] },
      { id: uid(), date: tomorrow, start: 9*60, end: 10*60, title: "Планирование спринта",
        organizer: "Мария", attendees: "Вся команда разработки", note: "", color: COLORS[1] }
    ];
    save();
  }

  // ---------- Шапка даты ----------
  function renderHeader() {
    $("roomName").textContent = ROOM_NAME;
    $("dateTitle").textContent =
      viewDate.getDate() + " " + MONTHS[viewDate.getMonth()] + " " + viewDate.getFullYear();
    $("dateWeekday").textContent = WEEKDAYS_FULL[(viewDate.getDay() + 6) % 7];
  }

  // ---------- Дневная сетка ----------
  function renderDayGrid() {
    var grid = $("dayGrid");
    grid.innerHTML = "";
    var hours = DAY_END - DAY_START;
    grid.style.height = (hours * SLOT_H) + "px";

    var key = dateKey(viewDate);
    var now = new Date();
    var isToday = sameDay(viewDate, now);

    for (var h = DAY_START; h < DAY_END; h++) {
      var cell = document.createElement("div");
      cell.className = "slot-cell";
      cell.style.top = ((h - DAY_START) * SLOT_H) + "px";
      cell.style.height = SLOT_H + "px";
      cell.dataset.hour = h;
      cell.title = "Нажмите, чтобы забронировать " + fmtTime(h*60);
      cell.addEventListener("click", function (e) {
        var hr = +this.dataset.hour;
        var rect = this.getBoundingClientRect();
        var half = (e.clientY - rect.top) >= rect.height/2 ? 30 : 0;
        openModal(null, hr*60 + half, hr*60 + half + 60);
      });
      grid.appendChild(cell);
    }

    var times = $("timeLabels");
    times.innerHTML = "";
    for (var t = DAY_START; t <= DAY_END; t++) {
      var lbl = document.createElement("div");
      lbl.className = "time-label";
      lbl.style.top = ((t - DAY_START) * SLOT_H) + "px";
      lbl.textContent = fmtTime(t*60);
      times.appendChild(lbl);
    }

    var line = $("nowLine");
    line.style.display = "none";
    if (isToday) {
      var minsNow = now.getHours()*60 + now.getMinutes();
      if (minsNow >= DAY_START*60 && minsNow <= DAY_END*60) {
        line.style.display = "block";
        line.style.top = ((minsNow - DAY_START*60) / 60 * SLOT_H) + "px";
      }
    }

    var list = $("eventsLayer");
    list.innerHTML = "";
    var dayBookings = bookings.filter(function (b) { return b.date === key; })
      .sort(function (a, b) { return a.start - b.start; });

    dayBookings.forEach(function (b) {
      var el = document.createElement("div");
      el.className = "event-card";
      el.style.top = ((b.start - DAY_START*60) / 60 * SLOT_H) + "px";
      el.style.height = Math.max(24, (b.end - b.start) / 60 * SLOT_H - 3) + "px";
      el.style.background = b.color || COLORS[0];
      el.innerHTML =
        '<div class="ev-title">' + esc(b.title) + '</div>' +
        '<div class="ev-time">' + fmtTime(b.start) + '–' + fmtTime(b.end) +
        ' · ' + esc(b.organizer) + '</div>';
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        openModal(b.id);
      });
      list.appendChild(el);
    });

    renderSidebar(dayBookings);
  }

  function renderSidebar(dayBookings) {
    var box = $("dayList");
    if (!dayBookings.length) {
      box.innerHTML = '<div class="empty">На этот день встреч пока нет.<br>Кликните по сетке, чтобы создать бронь.</div>';
      $("statCount").textContent = "0";
      $("statHours").textContent = "0";
      return;
    }
    var totalMin = 0;
    box.innerHTML = dayBookings.map(function (b) {
      totalMin += b.end - b.start;
      return '<div class="mini-item" data-id="' + b.id + '">' +
        '<span class="dot" style="background:' + (b.color||COLORS[0]) + '"></span>' +
        '<div><div class="mini-title">' + esc(b.title) + '</div>' +
        '<div class="mini-sub">' + fmtTime(b.start) + '–' + fmtTime(b.end) +
        ' · ' + esc(b.organizer) + '</div></div></div>';
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll(".mini-item"), function (el) {
      el.addEventListener("click", function () { openModal(this.dataset.id); });
    });
    $("statCount").textContent = dayBookings.length;
    $("statHours").textContent = (totalMin / 60).toFixed(1).replace(".0", "");
  }

  // ---------- Неделя ----------
  function renderWeek() {
    var body = $("weekBody");
    body.innerHTML = "";

    var wrap = document.createElement("div");
    wrap.className = "week-grid";
    var key0 = dateKey(viewDate);

    for (var i = 0; i < 7; i++) {
      (function (i) {
        var d = addDays(weekStart, i);
        var k = dateKey(d);
        var col = document.createElement("div");
        col.className = "week-col" + (k === key0 ? " current" : "") +
                        (sameDay(d, new Date()) ? " today" : "");
        var items = bookings.filter(function (b) { return b.date === k; })
          .sort(function (a, b) { return a.start - b.start; });

        var html = '<div class="week-day-head"><span class="week-day-name">' +
          WEEKDAYS[i] + '</span><span class="week-day-num">' + d.getDate() + '</span></div>' +
          '<div class="week-events">';
        if (!items.length) {
          html += '<div class="week-free">свободно</div>';
        } else {
          html += items.map(function (b) {
            return '<div class="week-ev" data-id="' + b.id + '" style="background:' +
              (b.color||COLORS[0]) + '22;border-left:3px solid ' + (b.color||COLORS[0]) + '">' +
              '<span class="we-time">' + fmtTime(b.start) + '</span> ' +
              '<span class="we-title">' + esc(b.title) + '</span></div>';
          }).join("");
        }
        html += '</div>';
        col.innerHTML = html;
        col.addEventListener("click", function (e) {
          var ev = e.target.closest ? e.target.closest(".week-ev") : null;
          if (ev) {
            viewDate = parseDateKey(k);
            switchView("day");
            renderAll();
            openModal(ev.dataset.id);
            return;
          }
          viewDate = parseDateKey(k);
          switchView("day");
          renderAll();
        });
        wrap.appendChild(col);
      })(i);
    }
    body.appendChild(wrap);

    var p = weekStart, q = addDays(weekStart, 6);
    $("weekLabel").textContent =
      p.getDate() + " " + MONTHS[p.getMonth()] + " — " + q.getDate() + " " +
      MONTHS[q.getMonth()] + " " + q.getFullYear();
  }

  // ---------- Список будущих броней ----------
  function renderList() {
    var box = $("allList");
    var todayK = dateKey(new Date());
    var future = bookings.filter(function (b) { return b.date >= todayK; })
      .sort(function (a, b) { return a.date === b.date ? a.start - b.start : (a.date < b.date ? -1 : 1); });

    if (!future.length) {
      box.innerHTML = '<div class="empty">Нет предстоящих бронирований.</div>';
      return;
    }
    var lastDate = "";
    var html = "";
    future.forEach(function (b) {
      if (b.date !== lastDate) {
        lastDate = b.date;
        var d = parseDateKey(b.date);
        html += '<div class="list-day-head">' + d.getDate() + " " + MONTHS[d.getMonth()] +
                ', ' + WEEKDAYS[(d.getDay()+6)%7] + '</div>';
      }
      html += '<div class="list-item" data-id="' + b.id + '">' +
        '<span class="dot" style="background:' + (b.color||COLORS[0]) + '"></span>' +
        '<div class="li-main"><div class="mini-title">' + esc(b.title) + '</div>' +
        '<div class="mini-sub">' + fmtTime(b.start) + '–' + fmtTime(b.end) +
        ' · ' + esc(b.organizer) + (b.attendees ? ' · ' + esc(b.attendees) : '') + '</div></div>' +
        '<button class="btn-del-sm" data-del="' + b.id + '" title="Удалить">✕</button></div>';
    });
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll(".list-item"), function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.dataset && e.target.dataset.del) {
          removeBooking(e.target.dataset.del);
          return;
        }
        var b = bookings.find(function (x) { return x.id === el.dataset.id; });
        if (b) {
          viewDate = parseDateKey(b.date);
          switchView("day");
          renderAll();
          openModal(b.id);
        }
      });
    });
  }

  // ---------- Модальное окно ----------
  function openModal(id, defStart, defEnd) {
    editingId = id || null;
    var b = id ? bookings.find(function (x) { return x.id === id; }) : null;

    $("modalTitle").textContent = b ? "Редактировать встречу" : "Новая встреча";
    $("f-date").value = b ? b.date : dateKey(viewDate);
    $("f-start").value = toHHMM(b ? b.start : (defStart != null ? defStart : 10*60));
    $("f-end").value = toHHMM(b ? b.end : (defEnd != null ? defEnd : 11*60));
    $("f-title").value = b ? b.title : "";
    $("f-org").value = b ? b.organizer : "";
    $("f-att").value = b ? (b.attendees || "") : "";
    $("f-note").value = b ? (b.note || "") : "";
    $("conflictBox").style.display = "none";

    var sel = b ? b.color : COLORS[colorIdx % COLORS.length];
    var pal = $("colorPalette");
    pal.innerHTML = COLORS.map(function (c) {
      return '<button type="button" class="color-swatch' + (c === sel ? " selected" : "") +
             '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join("");
    Array.prototype.forEach.call(pal.children, function (el) {
      el.addEventListener("click", function () {
        Array.prototype.forEach.call(pal.children, function (x) { x.classList.remove("selected"); });
        el.classList.add("selected");
      });
    });

    $("deleteBtn").style.display = b ? "" : "none";
    $("overlay").classList.add("show");
    setTimeout(function () { $("f-title").focus(); }, 50);
  }
  function closeModal() {
    $("overlay").classList.remove("show");
    editingId = null;
  }

  function submitForm() {
    var title = $("f-title").value.trim();
    var org = $("f-org").value.trim();
    var date = $("f-date").value;
    var start = toMin($("f-start").value);
    var end = toMin($("f-end").value);

    var errs = [];
    if (!title) errs.push("Укажите название встречи.");
    if (!org) errs.push("Укажите организатора.");
    if (!date) errs.push("Выберите дату.");
    if (isNaN(start) || isNaN(end)) errs.push("Укажите время начала и окончания.");
    else if (end <= start) errs.push("Время окончания должно быть позже начала.");
    else if (start < DAY_START*60 || end > DAY_END*60)
      errs.push("Переговорка доступна с " + fmtTime(DAY_START*60) + " до " + fmtTime(DAY_END*60) + ".");

    if (errs.length) { showConflicts(errs, []); return; }

    var conflicts = findConflicts({ date: date, start: start, end: end }, editingId);
    if (conflicts.length) { showConflicts([], conflicts); return; }

    var colorSel = pal_selected();
    var data = {
      date: date, start: start, end: end,
      title: title, organizer: org,
      attendees: $("f-att").value.trim(),
      note: $("f-note").value.trim(),
      color: colorSel || COLORS[colorIdx++ % COLORS.length]
    };

    if (editingId) {
      var idx = bookings.findIndex(function (x) { return x.id === editingId; });
      data.id = editingId;
      bookings[idx] = data;
    } else {
      data.id = uid();
      bookings.push(data);
    }
    save();
    viewDate = parseDateKey(date);
    weekStart = startOfWeek(viewDate);
    closeModal();
    renderAll();
  }
  function pal_selected() {
    var el = $("colorPalette").querySelector(".selected");
    return el ? el.dataset.color : null;
  }

  function showConflicts(errs, conflicts) {
    var box = $("conflictBox");
    var html = "";
    errs.forEach(function (e) { html += '<div class="cf-err">⚠ ' + esc(e) + '</div>'; });
    if (conflicts.length) {
      html += '<div class="cf-err">⚠ Пересечение с занятым временем:</div>';
      conflicts.forEach(function (c) {
        html += '<div class="cf-item">• ' + esc(c.title) + ' — ' +
                fmtTime(c.start) + '–' + fmtTime(c.end) + ' (' + esc(c.organizer) + ')</div>';
      });
    }
    box.innerHTML = html;
    box.style.display = "block";
  }

  function removeBooking(id) {
    var b = bookings.find(function (x) { return x.id === id; });
    if (!b) return;
    if (!confirm("Удалить бронирование «" + b.title + "» (" + fmtTime(b.start) + "–" + fmtTime(b.end) + ")?")) return;
    bookings = bookings.filter(function (x) { return x.id !== id; });
    save();
    closeModal();
    renderAll();
  }

  // ---------- Навигация / вьюхи ----------
  function switchView(v) {
    currentView = v;
    Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function (el) {
      el.classList.toggle("active", el.dataset.view === v);
    });
    $("viewDay").style.display = v === "day" ? "" : "none";
    $("viewWeek").style.display = v === "week" ? "" : "none";
    $("viewList").style.display = v === "list" ? "" : "none";
    $("navGroup").style.visibility = (v === "list") ? "hidden" : "visible";
  }

  function navigate(dir) {
    if (currentView === "week") {
      weekStart = addDays(weekStart, dir * 7);
      viewDate = new Date(weekStart.getTime());
    } else {
      viewDate = addDays(viewDate, dir);
    }
    renderAll();
  }
  function goToday() {
    viewDate = new Date();
    weekStart = startOfWeek(new Date());
    renderAll();
  }

  function renderAll() {
    renderHeader();
    if (currentView === "day") renderDayGrid();
    if (currentView === "week") renderWeek();
    if (currentView === "list") renderList();
  }

  // ---------- Инициализация ----------
  function init() {
    seedDemo();

    $("btnPrev").addEventListener("click", function () { navigate(-1); });
    $("btnNext").addEventListener("click", function () { navigate(1); });
    $("btnToday").addEventListener("click", goToday);

    Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function (el) {
      el.addEventListener("click", function () { switchView(el.dataset.view); renderAll(); });
    });

    $("newBtn").addEventListener("click", function () { openModal(null, 10*60, 11*60); });
    $("closeModal").addEventListener("click", closeModal);
    $("cancelBtn").addEventListener("click", closeModal);
    $("saveBtn").addEventListener("click", submitForm);
    $("deleteBtn").addEventListener("click", function () { removeBooking(editingId); });
    $("overlay").addEventListener("mousedown", function (e) {
      if (e.target === this) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeModal(); return; }
      if ($("overlay").classList.contains("show")) return;
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    });

    switchView("day");
    renderAll();
    setInterval(function () { if (currentView === "day") renderDayGrid(); }, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
