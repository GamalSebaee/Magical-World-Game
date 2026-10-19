# 12 — Open Questions (blocking only)

Each question blocks a specific phase. If you approve the plan without answering, the recommended default is used.

| # | Question | Blocks | Recommended default |
|---|----------|--------|---------------------|
| Q1 | **Phaser 3.90 (final 3.x) or Phaser 4.x?** The brief says Phaser 3; Phaser 4 has been stable since April 2026 (4.2.1 now). | P1 | Phaser **3.90.0**, with a half-day P1 spike on Phaser 4. Switch only if the spike shows no blocker and you agree. Scene adapters keep either choice contained |
| Q2 | **Where will it be hosted** (and is there a domain)? HTTPS is needed for mic, service worker and testing on a phone. | P1 (for device testing), P7 | Static hosting on Cloudflare Pages or Vercel (free tier) from this GitHub repo, with preview deployments per branch |
| Q3 | **Voice source**: a recorded voice actor, or commercial neural TTS clips (Egyptian Arabic + English voices) generated offline and human-reviewed? | P2 | Neural TTS clips generated offline with a vendor whose terms allow redistribution in a product, each reviewed by a native speaker; key character lines (Nono greetings, praise) upgraded to a voice actor later if budget allows. Nono uses one consistent voice per language |
| Q4 | **Arabic pronunciation**: standard (/qiṭṭa/) or Egyptian (/ʔoṭṭa/) for isolated vocabulary words? And counting (واحد، اتنين، تلاتة vs واحد، اثنان، ثلاثة)? | P2 scripts | Isolated vocabulary words in standard pronunciation (matches the written word and school use); carrier phrases, praise and counting in Egyptian colloquial |
| Q5 | **Who reviews Arabic scripts and audio** (native speaker, ideally with early-years experience)? | P2 content gate | You (the product owner) or someone you name; the plan cannot mark Arabic content approved without a named reviewer |
| Q6 | **Repository licence**: proprietary/all rights reserved, or open source? Affects which assets we may include and attribution. | P1 | Proprietary (all rights reserved) for code and content; third-party assets keep their own licences in `licenses/` |
| Q7 | **Digits in Arabic mode**: Eastern Arabic (١٢٣) or Western (123) by default? | P4 (Number Island), small effect in P2 | Eastern Arabic digits by default in Arabic and mixed modes, switchable by the parent |
| Q8 | **Test devices**: which Android phone is the reference device, and is an iPhone available? | P1 performance baseline, P2 gate | Any mid-range Android (≈ 4 GB RAM, 2022–2024). iOS checks happen when a device is available; until then iOS is reported as unverified |

Non-blocking decisions already made with defaults (can be changed later without rework): Arabic prompts in gender-neutral first-person plural (D8), MP3 audio (D6), XState for state machines (D4), recognition off by default (D7), parent gate design (D9), up to 4 profiles, 20-minute default break reminder.
