// static/js/local_resources.js

// 1. Initialize the map (default to NH)
const map = L.map('map').setView([43.0, -71.5], 6);

// 2. Add OSM tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Marker clustering
const markers = L.markerClusterGroup();

// 4. Helper to load locations into the map
async function loadLocations(filterBounds) {
  let query = supabase.from('locations').select('*');

  if (filterBounds) {
    const { latMin, latMax, lngMin, lngMax } = filterBounds;
    query = query
      .gte('latitude',  latMin)
      .lte('latitude',  latMax)
      .gte('longitude', lngMin)
      .lte('longitude', lngMax);
  }

  const { data: locations, error } = await query;

  console.log('📍 fetched locations:', locations, '❗ error:', error);
  if (error) {
    console.error('Error fetching locations:', error);
    return;
  }

  markers.clearLayers(); // clear any old markers
  locations.forEach(loc => {
    const marker = L.marker([loc.latitude, loc.longitude]);
    marker.bindPopup(`
      <strong>${loc.name}</strong><br/>
      ${loc.website
        ? `<a href="${loc.website}" target="_blank">Visit site</a><br/>`
        : ''}
      <button onclick="saveFavorite(${loc.id})">★ Save</button>
    `);
    markers.addLayer(marker);
  });

  map.addLayer(markers);

  // auto‐zoom to show all markers
  if (markers.getLayers().length) {
    map.fitBounds(markers.getBounds(), { padding: [50, 50] });
  }
}

// 5. Geolocation: center & filter on user
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const lat = coords.latitude;
      const lng = coords.longitude;
      map.setView([lat, lng], 13);

      // build a small bounding box (~0.1° ~11km)
      const delta = 0.1;
      const bounds = {
        latMin: lat - delta,
        latMax: lat + delta,
        lngMin: lng - delta,
        lngMax: lng + delta,
      };

      await loadLocations(bounds);
    },
    // on error or if user denies, just load everything
    () => loadLocations()
  );
} else {
  // no geolocation support
  loadLocations();
}

// 6. Add search control (Leaflet-Geosearch)
const provider = new window.GeoSearch.OpenStreetMapProvider();
const searchControl = new window.GeoSearch.GeoSearchControl({
  provider,
  style:      'bar',
  autoComplete: true,
  searchLabel:  'Search for a place…',
});
map.addControl(searchControl);

// 7. (Optional) Locate‐me button – requires leaflet.locatecontrol plugin
// L.control.locate({ flyTo: true }).addTo(map);
