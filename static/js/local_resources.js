// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

/** Calculate distance in miles between lat/lng pairs */
function getDistance(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Query Overpass API for local farms, butchers, and markets */
async function fetchOverpassMarkets(lat, lng) {
  console.log("    • Overpass query (primary)");
  const radius = 50 * 1609.34;
  const query = `
[out:json][timeout:25];
(
  node["shop"~"farm|butcher|greengrocer"](around:${radius},${lat},${lng});
  node["amenity"="marketplace"](around:${radius},${lat},${lng});
  node["produce"="yes"](around:${radius},${lat},${lng});
  node["organic"="yes"](around:${radius},${lat},${lng});
  node["craft"="butcher"](around:${radius},${lat},${lng});
  way[shop~"farm|butcher|greengrocer"](around:${radius},${lat},${lng});
  way[amenity="marketplace"](around:${radius},${lat},${lng});
  way[produce="yes"](around:${radius},${lat},${lng});
  way[organic="yes"](around:${radius},${lat},${lng});
  way[craft="butcher"](around:${radius},${lat},${lng});
  relation[shop~"farm|butcher|greengrocer"](around:${radius},${lat},${lng});
  relation[amenity="marketplace"](around:${radius},${lat},${lng});
  relation[produce="yes"](around:${radius},${lat},${lng});
  relation[organic="yes"](around:${radius},${lat},${lng});
  relation[craft="butcher"](around:${radius},${lat},${lng});
);
out center;
`.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query
  });

  if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
  const { elements } = await res.json();

  return elements
    .map(e => {
      const latF = e.lat ?? e.center?.lat;
      const lngF = e.lon ?? e.center?.lon;
      if (!latF || !lngF) return null;

      const name = e.tags?.name || e.tags?.operator || 'Unknown';
      const addr = e.tags?.['addr:full'] ||
        `${e.tags?.['addr:street'] || ''} ${e.tags?.['addr:housenumber'] || ''}`.trim();

      return {
        name,
        address: addr || 'No address provided',
        lat: latF,
        lng: lngF,
        distance: getDistance(lat, lng, latF, lngF)
      };
    })
    .filter(Boolean); // ✅ removes nulls (bad coords)
}

/** Use Overpass to find local markets/farms/etc */
async function fetchAllMarkets(lat, lng) {
  console.log("🚧 Overpass-only mode enabled");
  try {
    const over = await fetchOverpassMarkets(lat, lng);
    if (over.length) {
      console.log("✔ Overpass returned real POIs");
      return dedupeAndSort(over, lat, lng);
    } else {
      console.warn("⚠ Overpass returned zero results");
      alert("No local farms or markets were found near your location.");
      return [];
    }
  } catch (err) {
    console.error("❌ Overpass fetch failed:", err);
    alert("Unable to load local resources from OpenStreetMap.");
    return [];
  }
}

/** Remove duplicates and sort by distance */
function dedupeAndSort(all, lat, lng) {
  const seen = new Set();
  const unique = all.filter(m => {
    const key = `${m.name}::${m.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.distance - b.distance);
  console.log('  ✓ final market list:', unique);
  return unique;
}

/** Assign marker color based on POI type */
function getMarkerColor(name) {
  if (/butcher/i.test(name)) return '#8B4513';
  if (/farm|produce|vegetable|stand|organic|greengrocer/i.test(name)) return '#27ae60';
  if (/market/i.test(name)) return '#e67e22';
  return '#e74c3c';
}

/** Assign popup icon based on POI type */
function getIcon(name) {
  if (/butcher/i.test(name)) return '🐄 Butcher';
  if (/farm|produce|vegetable|stand|organic|greengrocer/i.test(name)) return '🥬 Farm Stand';
  if (/market/i.test(name)) return '🧺 Farmers Market';
  return '📍 Local Place';
}

/** Main entry point on page load */
async function loadLocalResources() {
  console.log("▶ loadLocalResources()");
  try {
    const { coords } = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const lat = coords.latitude, lng = coords.longitude;
    console.log("  ✓ coords:", lat, lng);

    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [lng, lat],
      zoom: 12
    });

    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    const markets = await fetchAllMarkets(lat, lng);

    markets.forEach(m => {
      const el = document.createElement('div');
      el.style.cssText =
        `width:16px;height:16px;background:${getMarkerColor(m.name)};` +
        'border:2px solid white;border-radius:50%';

      new mapboxgl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${getIcon(m.name)}: ${m.name}</strong><br>` +
            `${m.address}<br><em>${m.distance.toFixed(1)} mi away</em>`
          )
        )
        .addTo(map);
    });

    if (markets.length) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lng, lat]);
      markets.forEach(m => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: 40 });
    }

    const listEl = document.getElementById('market-list');
    if (listEl) {
      listEl.innerHTML = markets.map(m => `
        <div class="market-item">
          <h4>${m.name}</h4>
          <p>${m.address}</p>
          <small>${m.distance.toFixed(1)} mi away</small>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error("✘ loadLocalResources error:", err);
    alert(`Error loading local resources: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadLocalResources);
