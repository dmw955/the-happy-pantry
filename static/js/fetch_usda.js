// static/js/fetch_usda.js
import 'dotenv/config'               // loads SUPABASE_URL & SERVICE_KEY from .env
import fetch from 'node-fetch'
import http from 'http'
import https from 'https'
import { createClient } from '@supabase/supabase-js'

// create one of each agent up front
const httpAgent  = new http.Agent()
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

// this function picks which agent to use based on request URL
const agent = ({ protocol }) =>
  protocol === 'https:' ? httpsAgent : httpAgent

// Supabase client (service role key so you can upsert)
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function seedByZip(zip) {
  console.log(`\n🔍 Fetching USDA markets for ZIP ${zip}…`)

  const res = await fetch(
    `http://search.ams.usda.gov/farmersmarkets/v1/data.svc/zipSearch?zip=${zip}`,
    { agent }
  )
  if (!res.ok) throw new Error(`Zip search failed: ${res.status}`)
  const { results } = await res.json()

  for (let { id, marketname } of results) {
    const detailRes = await fetch(
      `http://search.ams.usda.gov/farmersmarkets/v1/data.svc/mktDetail?id=${id}`,
      { agent }
    )
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
    else        console.log(`✅ Upserted ${marketname}`)
  }
}

async function main() {
  for (let zip of ['03801','05602','04605']) {
    await seedByZip(zip)
  }
  console.log('\n✨ Done seeding USDA data.')
}

main().catch(console.error)
