# HunarSetu: Artisan's Bridge

Build a mobile-first web app called "HunarSetu" — an AI-driven market linkage and smart cataloging platform designed for marginalized artisans.

Design Philosophy & UX:

- Mobile-first layout (optimized for Android viewport, touch-friendly, minimal dense text).

- Warm, earthy color palette reflecting authentic crafts (terracotta, indigo, warm off-white, raw canvas textures).

- High visual scannability, pictorial cues, and prominent voice/audio action triggers for low-literacy users.

Key Features & Screens to Implement:

1. Artisan Studio (Smart Cataloging Engine)

- Image Upload & AI Studio Preview: Artisans can take or upload 1-3 photos of their craft. Include mock controls for "AI Background Cleaner" (toggles between raw photo and clean studio-white/neutral background) and automatic enhancement filters.

- Voice-to-Listing Input: Prominent microphone button with a recording wave animation where artisans describe their item via voice.

- Auto-Generated Listing Card: Displays extracted structured attributes:

  * Product Title & Category

  * Craft Technique & Raw Materials used

  * AI-generated cultural story / provenance description

  * Fair Price Estimator component: Breakdown card showing [Material Cost + Labor Hours ($/hr) + Platform Fair Market Benchmark = Suggested Selling Price].

2. Marketplace & Channel Syndication Dashboard

- Channel Sync Toggles: One-click sync status badges for platforms like ONDC, Local Craft Cooperatives, and Global B2B Export portals.

- Active Catalog View: Grid of live products showing status (Listed, Pending Buyer, Sold), stock count, and a generated Authenticity QR Code badge verifying handmade/GI-tag status.

3. Order Fulfillment & Visual Dispatch

- Simple, icon-driven order cards: Buyer location, item thumbnail, payout amount, and a visual 3-step dispatch tracker (Pack -> Label -> Handover).

- Audio readout button on each order card to speak order instructions aloud.

- Instant Payout summary card showing pending balance and completed bank/UPI transfers.

4. Buyer View / Product Showcase Modal

- Clean customer-facing view showing the high-res studio shot, artisan origin badge, audio playback of the maker's story, verified craft authenticity certificate, and an "Inquire / Place Order" CTA.

Technical Requirements:

- Use Tailwind CSS with Lucide icons for clean, pictorial UI elements.

- Create mock state management for adding a new item via the Studio flow so the new listing dynamically populates into the catalog and buyer preview.

- Include language selection pills at the top (English, Hindi, Bengali, Tamil, etc.) with functional UI state switching.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
