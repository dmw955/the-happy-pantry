// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Set your real Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

// 2) Mapbox Places POI lookup
async function fetchMapboxMarkets(lat, lng, query = 'farmers market') {
  console.log(`    • building Mapbox search URL for "${query}" near ${lat},${lng}`);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?proximity=${lng},${lat}` +
    `&limit=10&types=poi` +
    `&access_token=${mapboxgl.accessToken}`;
  console.log("    • Mapbox search URL:", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox search failed: ${res.status}`);
  const { features } = await res.json();
  return features.map(f => ({
    name:    f.text,
    address: f.place_name,
    lng:     f.geometry.coordinates[0],
    lat:     f.geometry.coordinates[1]
  }));
}

// wrap your entire load in a logged function
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

    // 4) fetch markets
    console.log("  • fetching POIs from Mapbox…");
    const markets = await fetchMapboxMarkets(lat, lng);
    console.log("  ✓ fetched markets:", markets);

    // 5) plot markers
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
