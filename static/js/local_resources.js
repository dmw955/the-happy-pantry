// static/js/local_resources.js

// 1) Get user’s location
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Geolocation not supported"));
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err)
    );
  });
}

// 2) Call USDA locSearch to get nearby market IDs & distances
async function fetchNearbyMarketSummaries(lat, lng) {
  const url = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/locSearch?lat=${lat}&lng=${lng}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`locSearch failed: ${res.status}`);
  const { results } = await res.json();
  // results: [{id: "123", marketname: "Market A:0.5 Miles"}, …]
  return results.map(m => ({
    id:       m.id,
    name:     m.marketname.split(':')[0],
    distance: parseFloat(m.marketname.split(':')[1])
  }));
}

// 3) Fetch full details for each market
async function fetchMarketDetails(id) {
  const url = `https://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=${id}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`mktDetail failed: ${res.status}`);
  const { marketdetails } = await res.json();
  return {
    id:       id,
    name:     marketdetails.GoogleName,
    address:  marketdetails.Address,
    products: marketdetails.Products,
    schedule: marketdetails.Schedule,
    website:  marketdetails.Links
  };
}

// 4) Tie it all together
async function loadLocalResources() {
  try {
    console.log("📍 Getting user location…");
    const { lat, lng } = await getUserLocation();
    console.log("📍 User coords:", lat, lng);

    console.log("🔍 Fetching nearby markets…");
    const summaries = await fetchNearbyMarketSummaries(lat, lng);
    if (summaries.length === 0) {
      console.log("⚠️ No nearby markets found.");
      showNoResourcesMessage();
      return;
    }

    console.log(`✅ Found ${summaries.length} markets, fetching details…`);
    const details = await Promise.all(
      summaries.map(s => fetchMarketDetails(s.id).then(d => ({ ...d, distance: s.distance })))
    );

    displayResources(details);
  } catch (err) {
    console.error("Local resources error:", err);
    showErrorMessage(err);
  }
}

// 5) Render into the DOM
function displayResources(markets) {
  const container = document.getElementById("local-resources");
  container.innerHTML = markets
    .map(m => `
      <div class="resource-card">
        <h3>${m.name} (${m.distance.toFixed(1)} mi)</h3>
        <p>${m.address}</p>
        <p><strong>Products:</strong> ${m.products}</p>
        <p><strong>Schedule:</strong> ${m.schedule}</p>
        ${m.website ? `<p><a href="${m.website}" target="_blank">Website</a></p>` : ""}
      </div>
    `).join("");
}

function showNoResourcesMessage() {
  document.getElementById("local-resources").innerHTML =
    "<p>No farmers markets found near you.</p>";
}

function showErrorMessage(err) {
  document.getElementById("local-resources").innerHTML =
    `<p>Error loading resources: ${err.message}</p>`;
}

// 6) Kick off on page load (or when ready)
document.addEventListener("DOMContentLoaded", loadLocalResources);
