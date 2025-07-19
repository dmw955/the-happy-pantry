// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Set your real Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

/**
 * Fetch POIs for a single keyword from Mapbox Places.
 * @param {number} lat 
 * @param {number} lng 
 * @param {string} query 
 * @returns {Promise<Array<{name:string,address:string,lng:number,lat:number}>>}
 */
async function fetchMapboxMarkets(lat, lng, query) {
  console.log(`    • fetching POIs for "${query}"…`);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?proximity=${lng},${lat}` +
    `&limit=20` +
    `&access_token=${mapboxgl.accessToken}`;
  console.log("      URL:", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox search failed for "${query}": ${res.status}`);
  const { features } = await res.json();
  return features.map(f => ({
    name:    f.text,
    address: f.place_name,
    lng:     f.geometry.coordinates[0],
    lat:     f.geometry.coordinates[1]
  }));
}

/**
 * Run multiple keyword searches and dedupe results.
 */
async function fetchAllMarkets(lat, lng) {
  const queries = [
    'farmers market',
    'farm stand',
    'local market',
    'butchery',
    'meat market'
  ];
  let allResults = [];
  for (const q of queries) {
    try {
      const results = await fetchMapboxMarkets(lat, lng, q);
      allResults = allResults.concat(results);
    } catch (err) {
      console.warn(`    • "${q}" search error:`, err);
    }
  }
  // Deduplicate by name + address
  const unique = [];
  const seen = new Set();
  for (const m of allResults) {
    const key = `${m.name}::${m.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }
  console.log("  ✓ aggregated unique markets:", unique);
  return unique;
}

async function loadLocalResources() {
  console.log("▶ loadLocalResources()");
  try {
    // 1) geolocation
    console.log("  • requesting geolocation…");
    const { coords } = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const lat = coords.latitude, lng = coords.longitude;
    console.log("  ✓ got coords:", lat, lng);

    // 2) init map
    console.log("  • initializing map…");
    const map = new mapboxgl.Map({
      container: 'map',
      style:     'mapbox://styles/mapbox/streets-v11',
      center:    [lng, lat],
      zoom:      12
    });
    console.log("  ✓ map initialized");

    // 3) user marker
    console.log("  • adding user marker…");
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    // 4) fetch & plot markets
    console.log("  • fetching all relevant markets…");
    const markets = await fetchAllMarkets(lat, lng);
    console.log("  ✓ markets to plot:", markets.length);

    console.log("  • plotting markers…");
    markets.forEach(m => {
      new mapboxgl.Marker()
        .setLngLat([m.lng, m.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${m.name}</strong><br>${m.address}`
          )
        )
        .addTo(map);
    });
    console.log(`  ✓ plotted ${markets.length} markers`);
  } catch (err) {
    console.error("✘ Mapbox integration error:", err);
    alert(`Error loading local markets: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log("▶ DOMContentLoaded");
  loadLocalResources();
});
