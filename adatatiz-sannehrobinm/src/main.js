// src/main.js
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix des icônes Leaflet pour Vite
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl: iconShadow });

// --- URLs API ---
const urlImage =
  "https://parisdata.opendatasoft.com/api/explore/v2.1/catalog/datasets/femmes-illustres-a-paris-portraits/records?limit=20";
const urlGeo =
  "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/femmes-illustres-a-paris-parcours/records?limit=10";

// --- DOM ---
const searchInput = document.getElementById("searchInput");
const boutonRecherche = document.getElementById("boutonRecherche");
const resultat = document.getElementById("resultat");
const sidebar = document.getElementById("sidebar");
const geoContainer = document.getElementById("geo-container");

// --- Globals ---
let Portraits = { results: [] };
let Geolocalisation = {results:[] };
let map = null;
let markers = {};
let routePolyline = null;

// --- Helpers ---
const getImageUrl = (femme) => {
  if (!femme) return null;
  // Champs possibles selon API
  return femme.photos?.url 
      || femme.media?.image 
      || femme.media?.url 
      || femme.image 
      || femme.url 
      || null;
};


const extractCoordsFromGeoItem = (item) => {
  const rec = item.record || item;
  const fields = rec.fields || {};

  if (rec.geo_point_2d?.lat && rec.geo_point_2d?.lon)
    return { lat: rec.geo_point_2d.lat, lon: rec.geo_point_2d.lon };

  if (Array.isArray(fields.geo_point_2d) && fields.geo_point_2d.length >= 2)
    return { lat: Number(fields.geo_point_2d[0]), lon: Number(fields.geo_point_2d[1]) };

  if (Array.isArray(fields.coordinates) && fields.coordinates.length >= 2) {
    const a0 = Number(fields.coordinates[0]);
    const a1 = Number(fields.coordinates[1]);
    if (a0 >= -90 && a0 <= 90) return { lat: a0, lon: a1 };
    return { lat: a1, lon: a0 };
  }

  return null;
};

const findPortraitByName = (name) =>
  Portraits?.results?.find((p) => p.name?.toLowerCase().trim() === name?.toLowerCase().trim()) || null;

// --- API fetchers ---
const apiDataImg = async () => {
  try {
    const r = await fetch(urlImage);
    const j = await r.json();
    console.log("Données API Portraits :", j);
    return j.records || j.results || [];
  } catch (e) {
    console.error("Erreur API Images :", e);
    return [];
  }
};

const apiDataGeo = async () => {
  try {
    const r = await fetch(urlGeo);
    const j = await r.json();
    
    return j.results || j.records || [];
  } catch (e) {
    console.error("Erreur API Geo :", e);
    return [];
  }
};

// --- Map init ---
const initMap = () => {
  map = L.map("geo-container").setView([48.8566, 2.3522], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);
};

// --- Draw route ---
const drawRoute = (startCoord, pointsCoords) => {
  const coords = [];
  const pushIfUnique = (c) => {
    if (!c) return;
    const key = `${c.lat},${c.lon}`;
    if (!coords.some((x) => `${x[0]},${x[1]}` === key)) coords.push([c.lat, c.lon]);
  };
  pushIfUnique(startCoord);
  pointsCoords.forEach(pushIfUnique);

  if (routePolyline) routePolyline.remove();
  if (coords.length >= 2) {
    routePolyline = L.polyline(coords, { color: "#f39c12", weight: 4, opacity: 0.8 }).addTo(map);
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
  }
};

// --- Display markers + sidebar ---
const displayGeoDataOnMap = (geoResults) => {
  Object.values(markers).forEach((m) => m?.remove());
  markers = {};

  const routeCoords = [];
  geoResults.forEach((item) => {
    const rec = item.record || item;
    const fields = rec.fields || {};
    const coordsObj = extractCoordsFromGeoItem(item);
    if (!coordsObj) return;

    const nom = (fields.nom || fields.name || "").toString();
    if (!nom) return;

    routeCoords.push({ lat: coordsObj.lat, lon: coordsObj.lon });

    const portrait = findPortraitByName(nom);
    const imgUrl = portrait ? getImageUrl(portrait) : (fields.image || fields.photo || null);

    const photoIcon = L.icon({
      iconUrl: imgUrl || iconUrl,
      iconSize: [50, 50],
      className: "photo-marker",
      iconAnchor: [25, 50],
    });

    const marker = L.marker([coordsObj.lat, coordsObj.lon], { icon: photoIcon }).addTo(map);

    let popup = `<strong>${nom}</strong>`;
    if (imgUrl) popup += `<br><img src="${imgUrl}" style="width:150px;border-radius:8px;margin-top:6px;">`;
    popup += `<br><em>${fields.adresse || ""}</em>`;
    const descs = [portrait?.desc1, portrait?.desc2, portrait?.desc3, portrait?.desc4, portrait?.desc5].filter(Boolean);
    if (descs.length) {
      popup += `<br><details style="margin-top:6px;"><summary>Voici pourquoi elles sont illustres</summary><div style="text-align:left;margin-top:6px;">${descs.map(d => `<p>• ${d}</p>`).join("")}</div></details>`;
    }
    marker.bindPopup(popup);

    marker.on("click", () => {
      const html = `
        <h2 style="margin:6px 0;">${nom}</h2>
        ${imgUrl ? `<img src="${imgUrl}" width="160" style="border-radius:8px;display:block;margin:6px auto;">` : ""}
        <p><strong>${portrait?.tab_name || fields.tab_name || ""}</strong></p>
        ${descs.length ? `<details open><summary>Pourquoi illustre</summary><div style="text-align:left;margin-top:6px;">${descs.map(d=>`<p>• ${d}</p>`).join("")}</div></details>` : ""}
        <p style="font-size:0.9rem;margin-top:6px;color:#ddd;">Coord: ${coordsObj.lat.toFixed(6)}, ${coordsObj.lon.toFixed(6)}</p>
      `;
      resultat.innerHTML = html;
      highlightSidebarItem(nom);
      marker.openPopup();
    });

    markers[nom.toLowerCase().trim()] = marker;
  });

  const startCoord = routeCoords[0] || { lat: 48.8566, lon: 2.3522 };
  drawRoute(startCoord, routeCoords);
  populateSidebarWithCoords(geoResults);
};

// --- Sidebar populate ---
const populateSidebarWithCoords = (geoResults) => {
  sidebar.innerHTML = "<h3 style='margin-top:0;'>Parcours Illustre</h3>";
  const geoMap = {};
  geoResults.forEach((item) => {
    const rec = item.record || item;
    const fields = rec.fields || {};
    const coords = extractCoordsFromGeoItem(item);
    if (!coords) return;
    const nom = (fields.nom || fields.name || "").toString();
    if (!nom) return;
    geoMap[nom.toLowerCase().trim()] = { item: rec, coords };
  });

  Portraits.results.forEach((f) => {
    const name = f.name || "(sans nom)";
    const nameKey = name.toLowerCase().trim();
    const div = document.createElement("div");
    div.className = "sidebar-item";
    div.dataset.name = nameKey;

    const thumbUrl = getImageUrl(f);
    const thumbHtml = thumbUrl
      ? `<img src="${thumbUrl}" alt="${name}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;margin-right:8px;vertical-align:middle;">`
      : "";
    const geoEntry = geoMap[nameKey];
    const parcours = f.tab_name || "";
    const gpsLine = geoEntry
      ? `<div style="font-size:0.8rem;color:#ccc;margin-top:4px;">GPS: ${geoEntry.coords.lat.toFixed(6)}, ${geoEntry.coords.lon.toFixed(6)}</div>`
      : `<div style="font-size:0.8rem;color:#555;margin-top:4px;">GPS: —</div>`;

    div.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;">${thumbHtml}<span style="font-size:0.95rem;">${name}</span></div></div><div style="font-size:0.8rem;color:#ddd;margin-top:2px;">${parcours}</div>${gpsLine}`;

    div.addEventListener("click", async () => {
      document.querySelectorAll(".sidebar-item").forEach(el => el.style.boxShadow = "none");
      div.style.boxShadow = "0 0 0 3px rgba(243,156,18,0.25)";
      if (geoEntry) {
        map.setView([geoEntry.coords.lat, geoEntry.coords.lon], 17);
        const marker = markers[nameKey];
        if (marker) marker.openPopup();
      } else {
        const adresse = f.short_desc || f.desc1 || "";
        if (adresse) {
          const c = await geocodeAdresse(adresse);
          if (c) {
            map.setView([c.lat, c.lon], 17);
            const mk = L.marker([c.lat, c.lon], {
              icon: L.icon({ iconUrl: thumbUrl||iconUrl, iconSize: [45,45], className:"photo-marker" })
            }).addTo(map).bindPopup(`<strong>${name}</strong><br>${adresse}`);
            markers[nameKey] = mk;
            mk.openPopup();
          }
        }
      }
      showPortraitInResult(f.name);
    });

    sidebar.appendChild(div);
  });
};


const highlightSidebarItem = (name) => {
  const key = name.toLowerCase().trim();
  const el = document.querySelector(`.sidebar-item[data-name="${key}"]`);
  if (!el) return;
  document.querySelectorAll(".sidebar-item").forEach(x => x.style.boxShadow = "none");
  el.style.boxShadow = "0 0 0 3px rgba(243,156,18,0.25)";
};

// --- Show portrait info ---
const showPortraitInResult = (name) => {
  const p = findPortraitByName(name);
  if (!p) { resultat.innerHTML = "❌ Aucune donnée portrait."; return; }
  const img = getImageUrl(p);
  const tab = p.tab_name || "";
  const descs = [p.desc1, p.desc2, p.desc3, p.desc4, p.desc5].filter(Boolean);
  resultat.innerHTML = `
    <div style="text-align:center;">
      <h2 style="margin:6px 0;">${p.name}</h2>
      ${img ? `<img id="result-photo" src="${img}" width="160" style="border-radius:8px;display:block;margin:6px auto;cursor:pointer;">` : ""}
      <p style="margin:6px 0;"><strong>${tab}</strong></p>
      ${descs.length ? `<details id="result-details"><summary>Voici pourquoi:</summary><div style="text-align:left;margin-top:6px;">${descs.map(d=>`<p>• ${d}</p>`).join("")}</div></details>` : ""}
    </div>
  `;
  const imgEl = document.getElementById("result-photo");
  if (imgEl) imgEl.addEventListener("click", () => {
    const key = p.name.toLowerCase().trim();
    const marker = markers[key];
    if (marker) {
      marker.openPopup();
      const coords = marker.getLatLng();
      map.setView([coords.lat, coords.lng], 17);
    }
    highlightSidebarItem(p.name);
  });
  highlightSidebarItem(p.name);
};

// --- geocode fallback ---
const geocodeAdresse = async (adresse) => {
  if (!adresse) return null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresse)}+Paris`, { headers: { "User-Agent": "FemmesIllustresMap/1.0" }});
    const j = await r.json();
    if (j?.length) return { lat: parseFloat(j[0].lat), lon: parseFloat(j[0].lon) };
  } catch(e){ console.error(e); }
  return null;
};

// --- Unified search ---
const searchFemmeOuLieu = async (query) => {
  if (!query || query.trim().length < 3) return (resultat.innerHTML = "👉 Tape au moins 3 lettres.");
  const q = query.toLowerCase().trim();

  // Recherche dans Portraits
  let found = Portraits.results.find(f => f.name?.toLowerCase().trim() === q);
  if (!found) {
    found = Portraits.results.find(f => {
      const hay = [f.name,f.tab_name,f.desc1,f.desc2,f.desc3,f.desc4,f.desc5].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  if (found) {
    showPortraitInResult(found.name);

    // ✅ Correction ici : sécuriser fields
    const geoItem = Geolocalisation.find(g => {
      const rec = g.record || g;
      const fields = rec.fields || {};
      const nom = (fields.nom || fields.name || "").toString().toLowerCase().trim();
      return nom === found.name.toLowerCase().trim();
    });

    if (geoItem) {
      const c = extractCoordsFromGeoItem(geoItem);
      if (c) {
        map.setView([c.lat, c.lon], 17);
        const mk = markers[found.name.toLowerCase().trim()];
        if (mk) mk.openPopup();
      }
    } else {
      const adresse = found.short_desc || found.desc1 || "";
      if (adresse) {
        const coords = await geocodeAdresse(adresse);
        if (coords) {
          map.setView([coords.lat, coords.lon], 17);
          L.marker([coords.lat, coords.lon])
            .addTo(map)
            .bindPopup(`<strong>${found.name}</strong><br>${adresse}`)
            .openPopup();
        }
      }
    }
    return;
  }

  // fallback recherche par lieu
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}+Paris`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.length) return (resultat.innerHTML = "👉 Cette personne ne fait pas encore partie de la liste");
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    map.setView([lat, lon], 16);
    L.marker([lat, lon]).addTo(map).bindPopup(`<strong>${query}</strong>`).openPopup();
    resultat.innerHTML = `📍 Localisation trouvée pour : <strong>${query}</strong>`;
  } catch(e){ console.error(e); resultat.innerHTML="❌ Impossible de trouver le lieu.";}
};


// --- INIT ---
window.onload = async () => {
  initMap();
  const imgData = await apiDataImg();
  Portraits.results = imgData.map(r => r.fields || r);
  Geolocalisation = await apiDataGeo();
  displayGeoDataOnMap(Geolocalisation);
  populateSidebarWithCoords(Geolocalisation);

  setTimeout(async () => {
    for (const p of Portraits.results) {
      const key = (p.name||"").toLowerCase().trim();
      if (markers[key]) continue;
      const adresse = p.short_desc || p.desc1 || "";
      if (!adresse) continue;
      const c = await geocodeAdresse(adresse);
      if (!c) continue;
      const img = getImageUrl(p);
      const icon = L.icon({ iconUrl: img||iconUrl, iconSize:[45,45], className:"photo-marker" });
      const mk = L.marker([c.lat,c.lon],{icon}).addTo(map).bindPopup(`<strong>${p.name}</strong><br>${adresse}`);
      markers[key]=mk;
    }
  }, 400);

  boutonRecherche.addEventListener("click", ()=>searchFemmeOuLieu(searchInput.value));
  searchInput.addEventListener("keypress", e=>{ if(e.key==="Enter") searchFemmeOuLieu(searchInput.value); });
};
