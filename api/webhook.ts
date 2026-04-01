import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Vercel needs raw body for webhook signature verification
export const config = {
  api: { bodyParser: false },
}

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sig = req.headers['stripe-signature'] as string
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }

  try {
    const rawBody = await getRawBody(req)
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
        const isOurs = lineItems.data.some((item) => item.price?.id === process.env.STRIPE_PRICE_ID)
        if (!isOurs) {
          console.log(`Ignoring event for other project: ${session.id}`)
          break
        }
        console.log(`Payment succeeded: ${session.id} — ${session.amount_total}`)
        break
      }
      default:
        console.log(`Unhandled event: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    res.status(400).json({ error: 'Webhook signature verification failed' })
  }
}
