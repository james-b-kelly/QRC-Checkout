import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { successUrl, cancelUrl } = req.body ?? {}

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.ALLOWED_ORIGIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.ALLOWED_ORIGIN}/editor`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Checkout session error:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
