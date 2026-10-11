# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences with equal weight (confirmed by the owner):

- People in Chile, mostly the Valparaíso region, who want to learn masoterapia as a profession or a career change, through the diplomados and entry-level courses.
- Practitioners who specialize: masoterapeutas, TENS and other health professionals looking for continuing education (punción seca, drenaje postoperatorio, etc.).

Both arrive mostly from search, ads and social media, often on a phone, comparing courses before enrolling.

## Product Purpose

cenakin.cl is the public catalog and enrollment entry point of OTEC Cenakin, a training center in Viña del Mar. It presents diplomados and courses, answers questions, and sends visitors to WooCommerce checkout (cenakin.cl/otec/) or to a WhatsApp advisor. Success: a visitor finds the right course and enrolls or starts a conversation.

## Positioning

A certified OTEC in Viña del Mar focused on practical massage and manual-therapy training, from first diploma to professional specializations, with in-person, blended and online formats.

## Operating Context

- Course data (title, dates, hours, price) comes from WooCommerce at build time; `src/data/courseOverrides.json` adds editorial content.
- Enrollment and payment happen in WordPress/WooCommerce under /otec/ with Webpay Plus.
- Human help runs through WhatsApp (+56 9 4487 1048).
- Static Astro site deployed by uploading `dist/` to SiteGround.

## Capabilities and Constraints

- Ten course areas (src/data/categoryGroups.json), a blog, a masoterapia category page, legal pages under /terminos/.
- Only WooCommerce products in the "Cursos" category (id 22) are published.
- Open: how the server serves 404s (the root .htaccess lives only on SiteGround).

## Brand Commitments

- Name: Cenakin / OTEC Cenakin; tagline "Formación que transforma vidas".
- Logos: OTEC Cenakin and Cenakin lockup (public/images/logo-otec-cenakin-hq-780.webp, logo-cenakin.png).
- Voice: warm and close, Spanish (Chile), "tú"; a light wink is welcome as long as it keeps institutional seriousness.

## Evidence on Hand

- OTEC certified under NCh 2728 (certificate OC–CER726261); recognized by SENCE (Resolución N.º 19606); World Massage Federation logo on the home page.
- Real testimonials: Víctor Contreras, Mariela Torres, Javiera Laurel (public/images/testimonios/).
- Photos of certified students of the Diplomado Intensivo en Masoterapia 2026.
- No published student counts, employment rates or rankings: do not invent them.

## Product Principles

1. Every page leads to a real course or a real person.
2. Show the course, not the claim: dates, modality and content come from live data.
3. Close and human: help is one WhatsApp message away.
4. Institutional trust is earned with real credentials, never with invented numbers.
