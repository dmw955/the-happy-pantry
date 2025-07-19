// static/js/local_resources.js

// 1. Initialize the map (default to NH)
const map = L.map('map').setView([43.0, -71.5], 6);

// 2. Add OSM tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Geolocation: center on user
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    map.setView([coords.latitude, coords.longitude], 13);
  });
}

// 4. Marker clustering
const markers = L.markerClusterGroup();

// 5. Fetch locations from Supabase
(async () => {
  const { data: locations, error } = await supabase
    .from('locations')
    .select('*');

  // ── DEBUG LOG ───────────────────────────────────────────────
  console.log('📍 fetched locations:', locations);
  console.log('❗ fetch error (if any):', error);
  // ────────────────────────────────────────────────────────────

  if (error) {
    console.error('Error fetching locations:', error);
    return;
  }

  if (!locations || locations.length === 0) {
    console.info('No locations found—check table content and RLS.');
  }

  locations.forEach(loc => {
    const marker = L.marker([loc.latitude, loc.longitude]);
    marker.bindPopup(`
      <strong>${loc.name}</strong><br/>
      ${loc.website ? `<a href="${loc.website}" target="_blank">Visit site</a><br/>` : ''}
      <button onclick="saveFavorite(${loc.id})">★ Save</button>
    `);
    markers.addLayer(marker);
  });

  // 6. Add markers layer to map
  map.addLayer(markers);

  // 7. Auto-zoom to fit all markers
  if (markers.getLayers().length) {
    map.fitBounds(markers.getBounds(), { padding: [50, 50] });
  }
})();

// 8. Add search control (Leaflet-Geosearch)
const provider = new window.GeoSearch.OpenStreetMapProvider();
const searchControl = new window.GeoSearch.GeoSearchControl({
  provider,
  style: 'bar',
  autoComplete: true,
  searchLabel: 'Search for a place…'
});
map.addControl(searchControl);

// 9. (Optional) Locate-me button – requires leaflet.locatecontrol plugin
// L.control.locate({ flyTo: true }).addTo(map);
