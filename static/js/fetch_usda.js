// static/js/fetch_usda.js
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

// — Supabase client init (from your env vars)
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function seedByZip(zip) {
  console.log(`\n🔍 Fetching USDA markets for ZIP ${zip}…`)

  // 👇 Use HTTP, not HTTPS
  const res = await fetch(
    `http://search.ams.usda.gov/farmersmarkets/v1/data.svc/zipSearch?zip=${zip}`
  )
  const { results } = await res.json()

  for (let { id, marketname } of results) {
    // 👇 Also HTTP here
    const detailRes = await fetch(
      `http://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=${id}`
    )
    const { marketdetails } = await detailRes.json()

    const m = marketdetails.GoogleLink.match(/@([-.\d]+),([-.\d]+)/)
    if (!m) continue
    const [, lat, lng] = m

    const { error } = await supabase
      .from('locations')
      .upsert({
        id:        parseInt(id, 10),
        name:      marketname.replace(/\n/g, ' '),
        latitude:  parseFloat(lat),
        longitude: parseFloat(lng),
        type:      'farm',
        tags:      ['farmers market'],
        website:   marketdetails.Link || null,
      })

    if (error) console.error(`❌ Upsert failed for ${marketname}:`, error)
    else        console.log(`✅ Upserted ${marketname}`)
  }
}

async function main() {
  const zips = ['03801','05602','04605']
  for (let zip of zips) await seedByZip(zip)
  console.log('\n✨ Done seeding USDA data.')
}

main().catch(console.error)
