import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

let cached: { amount: number; currency: string } | null = null
let cachedAt = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const now = Date.now()
    if (!cached || now - cachedAt > CACHE_TTL) {
      const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!)
      if (!price.unit_amount) {
        return res.status(500).json({ error: 'Price has no unit_amount' })
      }
      cached = {
        amount: price.unit_amount / 100,
        currency: price.currency,
      }
      cachedAt = now
    }

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.status(200).json(cached)
  } catch (err) {
    console.error('Price fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch price' })
  }
}
