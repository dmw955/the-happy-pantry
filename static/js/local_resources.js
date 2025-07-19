// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Set your real Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

/**
 * Calculates distance between two lat/lng points in miles.
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const toRad = deg => deg * (Math.PI / 180);
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Builds bbox string for Mapbox API: minLng,minLat,maxLng,maxLat
 */
function buildBBox(lat, lng, radiusMiles = 50) {
  const rad = radiusMiles / 3958.8;
  const deg = 180 / Math.PI;
  const dLat = rad * deg;
  const dLng = rad * deg / Math.cos(lat * Math.PI / 180);
  const minLat = lat - dLat, maxLat = lat + dLat;
  const minLng = lng - dLng, maxLng = lng + dLng;
  return `${minLng},${minLat},${maxLng},${maxLat}`;
}

/**
 * Fetch POIs for a single keyword within bounding box.
 */
// static/js/local_resources.js

// …keep your getDistance, buildBBox, etc. …

async function fetchMapboxMarkets(lat, lng, query) {
  console.log(`    • fetching POIs for "${query}"…`);
  const bbox = buildBBox(lat, lng, 50);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?bbox=${bbox}` +
    `&types=poi` +
    `&autocomplete=false` +
    `&limit=20` +
    `&access_token=${mapboxgl.accessToken}`;
  console.log("      URL:", url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox search failed for "${query}": ${res.status}`);
  const { features } = await res.json();

  return features.map(f => {
    const [lngF, latF] = f.geometry.coordinates;
    return {
      name:     f.text,
      address:  f.place_name,
      lng:      lngF,
      lat:      latF,
      distance: getDistance(lat, lng, latF, lngF)
    };
  });
}


/**
 * Query multiple keywords, dedupe & sort by distance.
 */
async function fetchAllMarkets(lat, lng) {
  const queries = ['farmers market','farm stand','local market','butchery','meat market'];
  let all = [];
  for (const q of queries) {
    try {
      const list = await fetchMapboxMarkets(lat, lng, q);
      all = all.concat(list);
    } catch (err) {
      console.warn(`    • "${q}" search error:`, err);
    }
  }
  const unique = [];
  const seen = new Set();
  all.forEach(m => {
    const key = `${m.name}::${m.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  });
  unique.sort((a,b)=>a.distance-b.distance);
  console.log("  ✓ aggregated & sorted markets:", unique);
  return unique;
}

/**
 * Main loader.
 */
async function loadLocalResources() {
  console.log("▶ loadLocalResources()");
  try {
    console.log("  • requesting geolocation…");
    const { coords } = await new Promise((res, rej)=>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const lat = coords.latitude, lng = coords.longitude;
    console.log("  ✓ got coords:", lat, lng);

    console.log("  • initializing map…");
    const map = new mapboxgl.Map({
      container: 'map',
      style:     'mapbox://styles/mapbox/streets-v11',
      center:    [lng, lat],
      zoom:      12
    });
    console.log("  ✓ map initialized");

    console.log("  • adding user marker…");
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    console.log("  • fetching all relevant markets…");
    const markets = await fetchAllMarkets(lat, lng);
    console.log("  ✓ markets to plot:", markets.length);

    console.log("  • plotting markers…");
    markets.forEach(m => {
      const el = document.createElement('div');
      el.style.width           = '16px';
      el.style.height          = '16px';
      el.style.backgroundColor = '#e74c3c';
      el.style.border          = '2px solid white';
      el.style.borderRadius    = '50%';

      new mapboxgl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(new mapboxgl.Popup()
          .setHTML(`<strong>${m.name}</strong><br>${m.address}<br><em>${m.distance.toFixed(1)} mi</em>`))
        .addTo(map);
    });
    console.log(`  ✓ plotted ${markets.length} markers`);

    if (markets.length) {
      const b = new mapboxgl.LngLatBounds();
      b.extend([lng, lat]);
      markets.forEach(m => b.extend([m.lng, m.lat]));
      map.fitBounds(b, { padding:40 });
    }

    displayMarketList(markets);

  } catch(err) {
    console.error("✘ Mapbox integration error:", err);
    alert(`Error loading local markets: ${err.message}`);
  }
}

/**
 * Render list under map.
 */
function displayMarketList(markets) {
  const el = document.getElementById('market-list');
  if (!el) {
    console.warn("No #market-list element found");
    return;
  }
  el.innerHTML = markets.map(m=>`
    <div class="market-item">
      <h4>${m.name}</h4>
      <p>${m.address}</p>
      <small>${m.distance.toFixed(1)} mi away</small>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', ()=>{
  console.log("▶ DOMContentLoaded");
  loadLocalResources();
});
