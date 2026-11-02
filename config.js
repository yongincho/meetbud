/* Landing page settings. Edit these, not the page code.
 *
 * Anything unknown stays empty, and the page leaves it out. Nothing here is sent
 * anywhere unless you fill in an endpoint or a payment link.
 */
window.BUD_CONFIG = {
  name: 'Bud',

  // Reserve: a Stripe Payment Link (https://buy.stripe.com/...), for a deposit button (the page has
  // none since 2026-10-30: a working prototype, and the waitlist first). Unset values hide what shows
  // them, so the page never says "TBD".
  stripePaymentLink: '',
  depositAmount: '', // shown as written, for example '$49'
  price: '',
  shipWindow: '',

  // Email list: an endpoint that accepts a JSON POST { email, interest, variant, utm }: Bud's
  // server keeps the list (connect/waitlist.mjs). Empty keeps the form in preview mode: it thanks
  // people and sends nothing.
  waitlistEndpoint: 'https://bud-connect.meetbud.workers.dev/waitlist',

  // The film (rendered by tools/film.mjs). Empty filmSrc plays the in-page animatic instead.
  filmSrc: 'film/bud-film.mp4',
  filmSrcVertical: 'film/bud-film-vertical.mp4', // used on phones when set
  filmPoster: 'film/poster.jpg',
  filmPosterVertical: 'film/poster-vertical.jpg',
  filmCaptions: '', // a WebVTT file for the film's captions

  // Shown on the share card and in the footer when set, for example 'getbud.com'.
  siteUrl: 'meetbud.app',
  contactEmail: 'hello@meetbud.app',

  // Push events to window.dataLayer (Google Tag Manager and most analytics tools read it).
  analytics: true,
};
