// static/js/fetch_usda.js
import 'dotenv/config'                 // loads all your .env vars
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

// Supabase client (service role key so you can upsert)
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Data.gov key
const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY

async function seedByZip(zip) {
  console.log(`\n🔍 Fetching markets for ZIP ${zip}…`)
  // Data.gov endpoint requires api_key
  const zipUrl = `https://api.data.gov/farmersmarkets/v1/data.svc/zipSearch?zip=${zip}&api_key=${DATA_GOV_API_KEY}`
  const zipRes = await fetch(zipUrl)
  if (!zipRes.ok) throw new Error(`Zip search failed: ${zipRes.status}`)
  const { results } = await zipRes.json()

  for (let { id, marketname } of results) {
    const detailUrl = `https://api.data.gov/farmersmarkets/v1/data.svc/mktDetail?id=${id}&api_key=${DATA_GOV_API_KEY}`
    const detailRes = await fetch(detailUrl)
    if (!detailRes.ok) {
      console.error(`Detail fetch failed for ${id}: ${detailRes.status}`)
      continue
    }
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
    else console.log(`✅ Upserted ${marketname}`)
  }
}

async function main() {
  const zips = ['03801','05602','04605']
  for (let zip of zips) await seedByZip(zip)
  console.log('\n✨ Done seeding USDA data.')
}

main().catch(console.error)
