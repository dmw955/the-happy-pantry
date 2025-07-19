// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN_HERE';

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
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    // 4) fetch markets
    console.log("  • fetching POIs from Mapbox…");
    const markets = await fetchMapboxMarkets(lat, lng);
    console.log("  ✓ fetched markets:", markets);

    // 5) plot markers
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
