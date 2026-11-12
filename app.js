/* Medical facilities of Uzbekistan — demo page. Data: window.MED (data.js). */
(function () {
  "use strict";
  var M = window.MED, C = {};
  M.cols.forEach(function (c, i) { C[c] = i; });
  var F = M.facilities;
  var $ = function (s) { return document.querySelector(s); };
  var nf = function (n) { return Number(n).toLocaleString("ru-RU"); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var get = function (r, k) { return r[C[k]]; };
  var specs = function (r) { return (get(r, "specialties") || "").split(";").filter(Boolean); };
  var nameOf = function (r) { return get(r, "name") || ((get(r, "type") || "Учреждение").replace(/^./, function (c) { return c.toUpperCase(); }) + (get(r, "district") ? ", " + get(r, "district") : "")); };
  var LANG = { ru: "русский", uz: "узбекский", en: "английский", kaa: "каракалпакский", tj: "таджикский", fa: "фарси", kk: "казахский" };

  /* ---------- KPIs and fill ---------- */
  var cnt = function (fn) { return F.filter(fn).length; };
  var nSpec = cnt(function (r) { return specs(r).length; }), nSite = cnt(function (r) { return get(r, "website"); }), nReady = cnt(function (r) { return get(r, "readyNow"); });
  $("#kpis").innerHTML = [[nf(F.length), "медицинских учреждений"], ["14", "регионов, вся страна"], [nf(nSpec), "с указанными направлениями"], [nf(nSite), "с сайтом"],
    [nReady, "готовы к иностранцам уже сейчас"], [M.medUnis.length, "медицинских вузов рядом"]]
    .map(function (k) { return "<div><b>" + k[0] + "</b><span>" + k[1] + "</span></div>"; }).join("");
  var fills = [["Местоположение и тип", F.length], ["Район", cnt(function (r) { return get(r, "district"); })], ["Направления", nSpec],
    ["Телефон", cnt(function (r) { return get(r, "phone"); })], ["Сайт", nSite], ["Языки сайта", cnt(function (r) { return get(r, "siteLangs"); })],
    ["Цены на сайте", cnt(function (r) { return get(r, "prices"); })], ["Признаки работы с иностранцами", cnt(function (r) { return /иностран/.test(get(r, "intl")); })],
    ["Международная аккредитация", cnt(function (r) { return get(r, "accreditation"); })]];
  $("#fill").innerHTML = fills.map(function (f) {
    var p = f[1] / F.length;
    return '<div class="frow"><span>' + f[0] + '</span><div class="bar' + (p < 0.2 ? " low" : "") + '"><i style="width:' + Math.max(1.2, p * 100) + '%"></i></div><span class="n">' + nf(f[1]) + "</span></div>";
  }).join("");

  /* ---------- filters ---------- */
  var regionCodes = Object.keys(M.regions).sort(function (a, b) { return M.regions[a].localeCompare(M.regions[b], "ru"); });
  $("#fRegion").innerHTML = '<option value="">Все регионы</option>' + regionCodes.map(function (k) { return '<option value="' + k + '">' + M.regions[k] + "</option>"; }).join("");
  var types = {}; F.forEach(function (r) { var t = get(r, "type"); if (t) types[t] = (types[t] || 0) + 1; });
  $("#fType").innerHTML = '<option value="">Все типы</option>' + Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + " (" + types[t] + ")</option>"; }).join("");
  var sp = {}; F.forEach(function (r) { specs(r).forEach(function (s) { sp[s] = (sp[s] || 0) + 1; }); });
  $("#fSpec").innerHTML = '<option value="">Все направления</option>' + Object.keys(sp).sort(function (a, b) { return sp[b] - sp[a]; }).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + " (" + sp[s] + ")</option>"; }).join("");

  var st = { region: "", type: "", spec: "", ready: false, site: false, phone: false, prices: false, q: "", shown: 20 };
  function match(r) {
    if (st.region && get(r, "region") !== st.region) return false;
    if (st.type && get(r, "type") !== st.type) return false;
    if (st.spec && specs(r).indexOf(st.spec) < 0) return false;
    if (st.ready && !get(r, "readyNow")) return false;
    if (st.site && !get(r, "website")) return false;
    if (st.phone && !get(r, "phone")) return false;
    if (st.prices && !get(r, "prices")) return false;
    if (st.q) {
      var h = (nameOf(r) + " " + get(r, "district") + " " + get(r, "street") + " " + get(r, "specialties") + " " + get(r, "type")).toLowerCase();
      if (h.indexOf(st.q.toLowerCase()) < 0) return false;
    }
    return true;
  }

  /* ---------- map ---------- */
  var map = L.map("map", { scrollWheelZoom: false, zoomControl: true }).setView([41.3, 64.5], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© участники OpenStreetMap" }).addTo(map);
  map.on("click", function () { map.scrollWheelZoom.enable(); });
  var cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 46, chunkedLoading: true });
  map.addLayer(cluster);
  var markers = {};
  function icon(r) {
    var c = get(r, "readyNow") ? "#a8530a" : get(r, "readiness") >= 40 ? "#0e7c6b" : "#5f9e93";
    return L.divIcon({ className: "", html: '<div class="pin" style="background:' + c + '"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
  }
  function popup(r) {
    var s = specs(r);
    return "<b>" + esc(nameOf(r)) + "</b><br>" + esc(get(r, "type")) + (get(r, "ownership") && get(r, "ownership") !== "не указано" ? " · " + esc(get(r, "ownership")) : "") +
      "<br>" + esc(M.regions[get(r, "region")] || "") + (get(r, "district") ? ", " + esc(get(r, "district")) : "") +
      (s.length ? "<br>Направления: " + esc(s.slice(0, 5).join(", ")) : "") +
      (get(r, "phone") ? "<br>Тел.: " + esc(get(r, "phone")) : "") +
      (get(r, "website") ? '<br><a href="' + esc(get(r, "website")) + '" target="_blank" rel="noopener">Сайт ↗</a>' : "") +
      "<br>Индекс готовности: <b>" + get(r, "readiness") + "</b>";
  }

  /* ---------- list ---------- */
  function card(r) {
    var s = specs(r), langs = (get(r, "siteLangs") || "").split(";").filter(Boolean).map(function (l) { return LANG[l] || l; });
    var intl = (get(r, "intl") || "").split(";").filter(function (x) { return x && x !== "аккредитация"; }).map(function (x) { return x.replace(/^работа с иностранцами — /, ""); });
    var rd = get(r, "readiness");
    return '<article class="item card" data-uid="' + esc(get(r, "uid")) + '"><h4>' + esc(nameOf(r)) + "</h4>" +
      '<p class="meta">' + esc(get(r, "type")) + " · " + esc(M.regions[get(r, "region")] || "") + (get(r, "district") ? ", " + esc(get(r, "district")) : "") + "</p>" +
      (s.length ? '<div class="chips">' + s.slice(0, 6).map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join("") + "</div>" : "") +
      (intl.length || get(r, "accreditation") ? '<p class="intl">' + (intl.length ? "🌍 " + esc(intl.join("; ")) : "") + (get(r, "accreditation") ? (intl.length ? "<br>" : "") + "✓ Аккредитация: " + esc(get(r, "accreditation")) : "") + "</p>" : "") +
      '<div class="row">' + (langs.length ? "<span>Сайт: " + esc(langs.join(", ")) + "</span>" : "") + (get(r, "prices") ? '<span class="chip am">цены на сайте</span>' : "") +
      (get(r, "phone") ? "<span>" + esc(get(r, "phone")) + "</span>" : "") + (get(r, "website") ? '<a href="' + esc(get(r, "website")) + '" target="_blank" rel="noopener">сайт ↗</a>' : "") + "</div>" +
      '<div class="score"><span>Индекс готовности</span><div class="bar"><i style="width:' + rd + '%"></i></div><b>' + rd + "</b></div></article>";
  }

  var current = [];
  function render(fit) {
    current = F.filter(match).sort(function (a, b) { return get(b, "readiness") - get(a, "readiness"); });
    $("#count").textContent = "Найдено: " + nf(current.length);
    cluster.clearLayers(); markers = {};
    var ms = current.map(function (r) {
      var m = L.marker([get(r, "lat"), get(r, "lon")], { icon: icon(r) }).bindPopup(popup(r));
      markers[get(r, "uid")] = m; return m;
    });
    cluster.addLayers(ms);
    if (fit && ms.length) map.fitBounds(L.featureGroup(ms).getBounds().pad(0.15), { maxZoom: 13 });
    $("#list").innerHTML = current.slice(0, st.shown).map(card).join("") || '<p class="sub">Ничего не найдено — попробуйте ослабить фильтры.</p>';
    $("#more").parentNode.hidden = current.length <= st.shown;
  }
  function sync() {
    $("#fRegion").value = st.region; $("#fType").value = st.type; $("#fSpec").value = st.spec;
    $("#fReady").checked = st.ready; $("#fSite").checked = st.site; $("#fPhone").checked = st.phone; $("#fPrices").checked = st.prices; $("#fQ").value = st.q;
  }
  [["#fRegion", "region"], ["#fType", "type"], ["#fSpec", "spec"]].forEach(function (x) { $(x[0]).addEventListener("change", function () { st[x[1]] = this.value; st.shown = 20; clearScen(); render(true); }); });
  [["#fReady", "ready"], ["#fSite", "site"], ["#fPhone", "phone"], ["#fPrices", "prices"]].forEach(function (x) { $(x[0]).addEventListener("change", function () { st[x[1]] = this.checked; st.shown = 20; clearScen(); render(true); }); });
  var qt; $("#fQ").addEventListener("input", function () { var v = this.value; clearTimeout(qt); qt = setTimeout(function () { st.q = v.trim(); st.shown = 20; clearScen(); render(true); }, 200); });
  $("#fReset").addEventListener("click", function () { reset(); render(true); });
  $("#more").addEventListener("click", function () { st.shown += 20; render(false); });
  $("#list").addEventListener("click", function (e) {
    if (e.target.closest("a")) return;
    var it = e.target.closest(".item"); if (!it) return;
    var m = markers[it.getAttribute("data-uid")]; if (!m) return;
    document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
    cluster.zoomToShowLayer(m, function () { m.openPopup(); });
  });
  function reset() { st.region = ""; st.type = ""; st.spec = ""; st.ready = st.site = st.phone = st.prices = false; st.q = ""; st.shown = 20; sync(); clearScen(); }

  /* ---------- scenarios ---------- */
  var SCEN = [
    ["Готовы к иностранцам уже сейчас", { ready: true }],
    ["Стоматология в Ташкенте с сайтом", { region: "UZ-TK", spec: "стоматология", site: true }],
    ["Диагностика и чекапы", { spec: "диагностика" }],
    ["Кардиология", { spec: "кардиология" }],
    ["Онкология", { spec: "онкология" }],
    ["Реабилитация и санатории", { spec: "реабилитация" }],
    ["Пластическая хирургия", { spec: "пластическая хирургия" }],
    ["Цены на сайте", { prices: true }]
  ];
  $("#scen").innerHTML = SCEN.map(function (s, i) { return '<button type="button" data-i="' + i + '">' + s[0] + "</button>"; }).join("");
  function clearScen() { Array.prototype.forEach.call(document.querySelectorAll("#scen button"), function (b) { b.classList.remove("on"); }); }
  $("#scen").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    reset(); var s = SCEN[+b.getAttribute("data-i")][1];
    Object.keys(s).forEach(function (k) { st[k] = s[k]; }); sync(); b.classList.add("on"); render(true);
  });

  /* ---------- regions table ---------- */
  var rows = regionCodes.map(function (k) {
    var rs = F.filter(function (r) { return get(r, "region") === k; }), pop = M.population[k];
    return { k: k, pop: pop, n: rs.length, per: pop ? rs.length / pop * 1e5 : 0,
      hosp: rs.filter(function (r) { return get(r, "type") === "больница"; }).length,
      dent: rs.filter(function (r) { return get(r, "type") === "стоматология" || specs(r).indexOf("стоматология") >= 0; }).length,
      diag: rs.filter(function (r) { return specs(r).indexOf("диагностика") >= 0; }).length,
      ready: rs.filter(function (r) { return get(r, "readyNow"); }).length,
      unis: M.medUnis.filter(function (u) { return u.region === k; }).length };
  }).sort(function (a, b) { return b.n - a.n; });
  var maxPer = Math.max.apply(null, rows.map(function (r) { return r.per; }));
  $("#rTable tbody").innerHTML = rows.map(function (r) {
    return '<tr data-k="' + r.k + '"><td>' + M.regions[r.k] + '</td><td class="r">' + nf(r.pop) + '</td><td class="r">' + nf(r.n) + '</td><td class="r">' +
      '<span style="display:inline-flex;align-items:center;gap:8px"><span class="bar" style="width:70px;display:inline-block"><i style="width:' + Math.round(r.per / maxPer * 100) + '%"></i></span>' + r.per.toFixed(1).replace(".", ",") + "</span>" +
      '</td><td class="r">' + r.hosp + '</td><td class="r">' + r.dent + '</td><td class="r">' + r.diag + '</td><td class="r">' + (r.ready || "—") + '</td><td class="r">' + (r.unis || "—") + "</td></tr>";
  }).join("");
  $("#rTable tbody").addEventListener("click", function (e) {
    var tr = e.target.closest("tr"); if (!tr) return;
    reset(); st.region = tr.getAttribute("data-k"); sync(); render(true);
    document.getElementById("map-sec").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- links hub ---------- */
  var nUniWorks = M.medUnis.reduce(function (s, u) { return s + (u.works || 0); }, 0);
  var HUB = [
    ["have", "Население регионов", "Численность, город и село, мужчины и женщины по каждой области.", "Размер рынка и дефицит: где на 100 тыс. жителей учреждений меньше всего."],
    ["have", "Медицинские вузы", M.medUnis.length + " медицинских и фармацевтических вузов с привязкой к регионам.", "Клиники при вузах, кадры, сильные научные школы рядом с клиникой."],
    ["have", "Научные публикации", nf(nUniWorks) + " научных работ медицинских вузов — по темам и годам.", "Кто реально работает в кардиологии, онкологии, репродуктологии — подтверждение экспертизы."],
    ["can", "Цены на процедуры", "Прайс-листы с сайтов и от клиник, приведённые к одному списку процедур.", "Сравнение с Турцией, Россией, Казахстаном; готовые пакеты с ценой."],
    ["can", "Гостиницы и санатории", "Гостиницы рядом с клиниками, курортные санатории (Чарвак, Зомин и др.).", "Пакет «лечение + проживание», расстояние до клиники, цены на ночь."],
    ["can", "Рейсы и аэропорты", "Прямые рейсы и время в пути из городов, откуда едут пациенты.", "Сколько лететь из Москвы, Алматы, Душанбе, Бишкека — и куда."],
    ["can", "Визовые правила", "Кому нужна виза, сроки безвизового пребывания, медицинская виза.", "Ответ пациенту за минуту: можно ли приехать и на сколько."],
    ["can", "Лицензии и аккредитации", "Официальные реестры Минздрава, списки JCI, ISO и др.", "Проверка, что у клиники есть лицензия на нужный вид помощи."],
    ["can", "Языки и координаторы", "На каких языках говорит персонал, есть ли координатор для иностранцев.", "Клиники для пациентов, говорящих на русском, английском, фарси, таджикском."],
    ["can", "Страховки и оплата", "Работа с зарубежными страховыми, оплата картами и переводом.", "Кто примет пациента по его страховке."],
    ["can", "Поток пациентов", "Официальная статистика въездного медтуризма по странам и направлениям.", "Откуда едут и за чем — где спрос."],
    ["can", "Отзывы", "Отзывы и оценки пациентов — с учётом правил площадок.", "Репутация клиники рядом с её данными."]
  ];
  $("#hub").innerHTML = '<div class="node card core"><b>Медицинское учреждение</b><p>Тип, направления, регион и район, контакты, сайт и его языки, признаки работы с иностранцами, индекс готовности — у каждого есть координаты и код региона, через которые подключаются все данные ниже.</p></div>' +
    HUB.map(function (h) { return '<div class="node card ' + h[0] + '"><span class="st">' + (h[0] === "have" ? "Уже есть" : "Можно собрать") + "</span><b>" + h[1] + "</b><p>" + h[2] + '</p><p class="gives">→ ' + h[3] + "</p></div>"; }).join("");

  /* ---------- misc ---------- */
  var up = $("#upBtn");
  window.addEventListener("scroll", function () { up.classList.toggle("show", window.scrollY > 900); }, { passive: true });
  up.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  $("#toTop").addEventListener("click", function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  render(false);
})();
