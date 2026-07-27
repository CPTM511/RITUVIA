# 01 — Product Source of Truth

## 1. Product identity

RITUVIA is an adult symbolic self-reflection product combining Tarot, Western astrology, numerology, intention setting, private ritual, journaling and later review. It is not a fortune-telling guarantee, professional advice service, psychic marketplace, stored-value product or cryptocurrency product.

The differentiated loop is:

`Question → Interpretation → Intention → Ritual → Journal → Revisit`

Do not reduce the product to a Tarot generator or an AI chat interface.

## 2. Golden user experience

The file `source/RITUVIA_WALLET_STRIPE_CRYPTO_AI_UPDATED_PROTOTYPE_2026-07-23.html` is the canonical visual and copy reference. Its SHA-256 is:

`e9d75c9c118be64cc779d182f01ec332d150b520fa9f0eb497f58fbf5fea5740`

The prototype is authoritative for:

- Page hierarchy and navigation.
- Component composition and interaction order.
- Bilingual public copy.
- Visual tokens, spacing, typography, borders, motion and responsive behavior.
- Product catalogue labels and Credit costs.
- User-facing separation of wallet identity, Stripe payments and crypto payment wallets.
- User-facing separation of deterministic free content and AI-assisted Deep Readings.

The prototype is not authoritative for:

- Browser local state.
- Fake wallet addresses or signatures.
- Fake cards or payment methods.
- Simulated payments, webhooks, refunds, subscriptions or Credits.
- Provider credentials.
- Authorization, encryption, database, queues, observability or retention.

All simulations must be replaced with real server-authoritative behavior without redesigning the experience.

## 3. Required routes

Production routes may use the existing framework's routing conventions, but the following destinations must exist and preserve the corresponding prototype screen:

| Destination | Recommended route |
|---|---|
| Home | `/{locale}` |
| Readings | `/{locale}/readings` |
| Daily Tarot | `/{locale}/readings/daily-tarot` |
| Tarot | `/{locale}/readings/tarot` |
| Deep Readings | `/{locale}/readings/deep` |
| Numerology | `/{locale}/readings/numerology` |
| Western Astrology | `/{locale}/readings/astrology` |
| Sanctuary | `/{locale}/sanctuary` |
| Journal | `/{locale}/journal` |
| Revisit | `/{locale}/revisit` |
| Plus & Credits | `/{locale}/plans` |
| Sign in | `/{locale}/sign-in` |
| Account | `/{locale}/account` |
| Billing and wallets | `/{locale}/account/billing` |
| Orders | `/{locale}/account/orders` |
| Privacy and data | `/{locale}/account/privacy` |
| Checkout return | `/{locale}/checkout/return` |
| About and boundaries | `/{locale}/about` |

Support English and Simplified Chinese as separate reviewed locale files. Do not render mixed-language screens except proper names and provider brands.

## 4. Free product invariants

A user must be able to complete the following without payment:

- Receive and revisit one Daily Tarot card per local calendar day.
- Receive a useful one-card or three-card Tarot reading with every drawn card and reviewed basic meaning visible.
- Calculate core numerology with visible formula steps.
- Use the approved deterministic astrology engine once licensed and enabled; AI cannot create astronomical facts.
- Write an intention and grounded action.
- Use a complete free candle and free incense ritual.
- Write a private journal entry.
- Schedule and complete a Revisit.

No core card identity or meaning may be hidden after a draw.

## 5. Commercial contract

Machine-readable prices and Credit costs are in `contracts/catalog.json`. The client must fetch a signed/versioned server catalogue and must not submit monetary amounts or Credit costs.

- Plus Monthly: US$9.99/month, 8 subscription Credits each month.
- Plus Annual: US$69.99/year, 8 subscription Credits allocated monthly, not 96 upfront.
- Packs: 6 Credits/US$5.99; 15/US$11.99; 40/US$24.99.
- Deep Readings: 1, 2, 3, 4 and 6 Credits as listed in the contract.
- Permanent objects remain owned after one authorized Credit consumption.
- Consumable special rituals require a new authorized pass for each use.
- Purchased Credits survive Plus cancellation.
- Credits are non-transferable service entitlements, not money, tokens or stored value.

## 6. AI use boundary

AI is used only for explicitly labeled Deep Readings. It may interpret approved deterministic facts and user context. It may not:

- Draw or alter cards.
- Change card orientation.
- calculate or change numerology.
- invent astrology placements or aspects.
- decide prices, Credits, eligibility, payments, refunds or access.
- call tools, browse the web, execute code or act on user accounts.
- claim knowledge of objective future events or another person's mind.

## 7. Public-copy boundary

Production UI must not expose implementation language such as webhook, ledger, server-authoritative, model policy, prototype, demo, local state, sandbox or provider test mode. Those belong in engineering documentation and controlled diagnostics. User-facing AI transparency, prices, subscription terms, payment methods, refund conditions and safety boundaries must remain clear and natural.

## 8. Required business decisions before live launch

- Legal seller and operating entity.
- Launch countries and age policy.
- Stripe and Coinbase product underwriting.
- Tax/Merchant-of-Record approach.
- Refund and digital-content policy by jurisdiction.
- Data retention and deletion exceptions.
- Licensed astrology ephemeris/provider.
- Email provider and verified domain.
- Support address and escalation process.
- Production prices and statement descriptor.
