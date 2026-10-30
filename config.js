/* Landing page settings. Edit these, not the page code.
 *
 * Anything unknown stays empty or 'TBD' and the page says so. Nothing here is sent
 * anywhere unless you fill in an endpoint or a payment link.
 */
window.BUD_CONFIG = {
  name: 'Bud',

  // Reserve: a Stripe Payment Link (https://buy.stripe.com/...). Empty shows
  // "Reservations open soon" and puts the email list first.
  stripePaymentLink: '',
  depositAmount: 'TBD', // shown as written, for example '$49'
  price: 'TBD',
  shipWindow: 'TBD',

  // Email list: an endpoint that accepts a JSON POST { email, interest, variant, utm }.
  // Empty keeps the form in preview mode: it thanks people and sends nothing.
  waitlistEndpoint: '',

  // The film (rendered by tools/film.mjs). Empty filmSrc plays the in-page animatic instead.
  filmSrc: 'film/bud-film.mp4',
  filmSrcVertical: 'film/bud-film-vertical.mp4', // used on phones when set
  filmPoster: 'film/poster.jpg',
  filmPosterVertical: 'film/poster-vertical.jpg',
  filmCaptions: '', // a WebVTT file for the film's captions

  // Shown on the share card and in the footer when set, for example 'getbud.com'.
  siteUrl: 'meetbud.app',
  contactEmail: '',

  // A/B test: 'agent' (gets things done) vs 'companion' (a little friend).
  // ?v=agent or ?v=companion forces one; otherwise each visitor gets one at random and keeps it.
  variants: ['agent', 'companion'],

  // Push events to window.dataLayer (Google Tag Manager and most analytics tools read it).
  analytics: true,
};
