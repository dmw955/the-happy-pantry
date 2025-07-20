// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Your Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

/** Haversine distance in miles */
function getDistance(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Build a bbox string: minLon,minLat,maxLon,maxLat */
function buildBBox(lat, lng, miles = 50) {
  const r   = miles / 3958.8;
  const deg = 180 / Math.PI;
  const dLat = r * deg;
  const dLng = r * deg / Math.cos(lat * Math.PI / 180);
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

/** Mapbox Places free-text lookup */
async function fetchMapboxMarkets(lat, lng, query) {
  console.log(`    • Mapbox search: "${query}"`);
  const bbox = buildBBox(lat, lng, 50);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
              `${encodeURIComponent(query)}.json` +
              `?bbox=${bbox}&limit=20&types=poi` +
              `&access_token=${mapboxgl.accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox search failed: ${res.status}`);
  const { features } = await res.json();
  return features.map(f => {
    const [lon, latf] = f.geometry.coordinates;
    return {
      name:     f.text,
      address:  f.place_name,
      lat:      latf,
      lng:      lon,
      distance: getDistance(lat, lng, latf, lon)
    };
  });
}

/** Overpass fallback: market, farm, butcher, grocery, vegetable */
async function fetchOverpassMarkets(lat, lng) {
  console.log("    • Overpass fallback (wider tags)");
  const radius = 50 * 1609.34; // 50 mi in meters
  const query = `
[out:json][timeout:25];
(
  node["amenity"="marketplace"](around:${radius},${lat},${lng});
  node["shop"~"farm|butcher|greengrocer|grocery|supermarket"](around:${radius},${lat},${lng});
  node["name"~"Farm|Market|Vegetable",i](around:${radius},${lat},${lng});
  way["name"~"Farm|Market|Vegetable",i](around:${radius},${lat},${lng});
  relation["name"~"Farm|Market|Vegetable",i](around:${radius},${lat},${lng});
);
out center;`.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body:    query
  });
  if (!res.ok) throw new Error(`Overpass API failed: ${res.status}`);
  const { elements } = await res.json();
  return elements.map(e => {
    const latF = e.lat ?? e.center?.lat;
    const lngF = e.lon ?? e.center?.lon;
    const name = e.tags?.name || e.tags?.operator || 'Unknown';
    const address = e.tags?.['addr:full']
                  || `${e.tags?.['addr:street']||''} ${e.tags?.['addr:housenumber']||''}`.trim();
    return {
      name,
      address,
      lat:      latF,
      lng:      lngF,
      distance: getDistance(lat, lng, latF, lngF)
    };
  });
}

/** Aggregate Mapbox → Overpass fallback → dedupe & sort */
async function fetchAllMarkets(lat, lng) {
  const combinedQuery = 'farmers market farm stand butcher grocery vegetable';
  let results = [];
  try {
    results = await fetchMapboxMarkets(lat, lng, combinedQuery);
  } catch (e) {
    console.warn('  • Mapbox combined search failed:', e);
  }

  if (!results.length) {
    results = await fetchOverpassMarkets(lat, lng);
  }

  // Dedupe
  const seen = new Set();
  const unique = results.filter(m => {
    const key = `${m.name}::${m.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by distance
  unique.sort((a, b) => a.distance - b.distance);

  console.log('  ✓ final market list:', unique);
  return unique;
}

/** Main loader */
async function loadLocalResources() {
  console.log("▶ loadLocalResources()");
  try {
    const { coords } = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const lat = coords.latitude, lng = coords.longitude;
    console.log("  ✓ coords:", lat, lng);

    // Initialize Mapbox map
    const map = new mapboxgl.Map({
      container: 'map',
      style:     'mapbox://styles/mapbox/streets-v11',
      center:    [lng, lat],
      zoom:      12
    });

    // User marker
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    // Fetch & plot
    const markets = await fetchAllMarkets(lat, lng);
    markets.forEach(m => {
      const el = document.createElement('div');
      el.style.cssText = 'width:16px;height:16px;background:#e74c3c;border:2px solid white;border-radius:50%';
      new mapboxgl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${m.name}</strong><br>${m.address}<br><em>${m.distance.toFixed(1)} mi away</em>`
          )
        )
        .addTo(map);
    });

    // Fit bounds
    if (markets.length) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lng, lat]);
      markets.forEach(m => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: 40 });
    }

    // Render list
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
    console.error("✘ load error:", err);
    alert(`Error loading local markets: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadLocalResources);
