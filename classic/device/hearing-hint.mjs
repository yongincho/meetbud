// The hint Bud's server gives the hearing service with what Bud's mic heard (connect/brain.mjs hear),
// so "Hey Bud" comes back spelled as that and not "hey but" or "hey bug". Given only noise (a street,
// the wind), the service sometimes answers with the hint itself, or a stretch of it, and Bud took
// that for you saying "Hey Bud": outside, it showed the hint as what you said and listened again, over
// and over (Jason, 2026-10-31). withoutHint() takes it out, on the server and in the app (for a
// server from before), and leaves anything said around it.
export const HEARING_HINT = 'People talk to Bud, a small assistant on the back of their phone, usually starting with “Hey Bud”.';
// Walkie-talkie (/brain/hear?plain=1): nobody says "Hey Bud" there (the top button is held instead),
// and a hint that says they do can make the service write one in that nobody said. The same words,
// so withoutHint takes this one out too.
export const PLAIN_HINT = 'People talk to Bud, a small assistant on the back of their phone.';

const wordsOf = (text) => text.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || [];
const HINT = wordsOf(HEARING_HINT);
const PLAIN_END = wordsOf(PLAIN_HINT).length; // (the plain hint is the first words of the full one)
// The hint, not speech: a stretch of its own words this long from its start or to its end, as the
// service says it ("usually starting with Hey Bud"), or MOST anywhere. Shorter ones, or ones from its
// middle, are what people say ("Hey Bud", "talk to Bud", "on the back of their phone case").
const LEAST = 5;
const MOST = 8;

// `plain`: the plain hint was sent (walkie-talkie, /brain/hear?plain=1). Then a text that is nothing
// but the end of it ("on the back of their phone.", said back for wind) is the hint too; with words
// before it ("put the sticker on the back of their phone"), it was said.
export function withoutHint(text, plain = false) {
  const words = wordsOf(text);
  if (!words.length) return text;
  // where each word of the text starts and ends, to cut a stretch out of it as it was written
  const spans = [];
  for (const m of text.matchAll(/[A-Za-z0-9’']+/g)) {
    if (/[A-Za-z0-9]/.test(m[0])) spans.push([m.index, m.index + m[0].length]);
  }
  if (spans.length !== words.length) return text;
  const cut = [];
  for (let i = 0; i < words.length;) {
    let longest = 0;
    for (let h = 0; h < HINT.length; h++) {
      let n = 0;
      while (i + n < words.length && h + n < HINT.length && words[i + n] === HINT[h + n]) n++;
      const end = h + n === HINT.length || (plain && h + n === PLAIN_END && i === 0 && n === words.length);
      if (n >= MOST || (n >= LEAST && (h === 0 || end))) longest = Math.max(longest, n);
    }
    if (longest) {
      cut.push([i, i + longest]);
      i += longest;
    } else i++;
  }
  if (!cut.length) return text;
  let out = '', from = 0;
  for (const [a, b] of cut) {
    out += text.slice(from, spans[a][0]);
    from = b < spans.length ? spans[b][0] : text.length;
  }
  out += text.slice(from);
  // what's left once the hint is out: the words, without the punctuation that was around it
  return /[A-Za-z0-9]/.test(out) ? out.replace(/\s+/g, ' ').replace(/^[\s,.;:!?“”"]+/, '').trim() : '';
}
