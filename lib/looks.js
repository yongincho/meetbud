/* The looks: Classic (no outfit) and these presets, each a color theme, an outfit and an
 * ambience. Their order is the looks' codes (Classic is 0, then 1 to 13). */
(function (K) {
  'use strict';

  /** Skin packs for direction 5: a full look (theme + outfit + item + ambience) sold as one bundle. */
  K.PACKS = [
    { id: 'lantern', label: 'Night walk', kr: '청사초롱', note: 'Gat hat and a silk lantern, fireflies.', theme: 'night', acc: { head: 'gat', item: 'lantern' }, ambient: 'fireflies' },
    { id: 'party', label: 'Party', kr: '파티', note: 'Party hat, a balloon and confetti.', theme: 'classic', acc: { head: 'partyHat', item: 'balloon' }, ambient: 'confetti' },
    { id: 'shades', label: 'Cool', kr: '선글라스', note: 'Sunglasses and a bow tie.', theme: 'night', acc: { face: 'sunglasses', neck: 'bowtie' }, ambient: 'sparkles' },
    { id: 'study', label: 'Study buddy', kr: '공부', note: 'Round glasses and a coffee, for focus time.', theme: 'mint', acc: { face: 'roundGlasses', item: 'coffee' }, ambient: null },
    { id: 'kitty', label: 'Kitty', kr: '야옹', note: 'Cat ears and a bow tie.', theme: 'sakura', acc: { head: 'catEars', neck: 'bowtie' }, ambient: 'sparkles' },
    { id: 'moonrabbit', label: 'Moon rabbit', kr: '달토끼', note: 'Bunny ears under a full moon, for Chuseok.', theme: 'night', acc: { head: 'bunnyEars' }, ambient: 'stars' },
    { id: 'dj', label: 'DJ', kr: '디제이', note: 'Headphones and floating music notes.', theme: 'classic', acc: { head: 'headphones' }, ambient: 'notes' },
    { id: 'rainy', label: 'Rainy day', kr: '비 오는 날', note: 'An umbrella and soft rain.', theme: 'mint', acc: { head: 'umbrella' }, ambient: 'rain' },
    { id: 'king', label: 'Little king', kr: '임금님', note: 'A gold crown and a bow tie.', theme: 'dancheong', acc: { head: 'crown', neck: 'bowtie' }, ambient: 'sparkles' },
    { id: 'seollal', label: 'Seollal', kr: '설날', note: 'New Year: saekdong rainbow collar and a lucky pouch.', theme: 'dancheong', acc: { neck: 'saekdong', item: 'pouch' }, ambient: 'sparkles' },
    { id: 'winter', label: 'Cozy winter', kr: '겨울', note: 'Beanie, scarf and snowfall.', theme: 'mint', acc: { head: 'beanie', neck: 'scarf' }, ambient: 'snow' },
    { id: 'blossom', label: 'Blossom', kr: '벚꽃', note: 'Cherry blossoms and falling petals.', theme: 'sakura', acc: { head: 'blossom' }, ambient: 'petals' },
    { id: 'halloween', label: 'Halloween', kr: '핼러윈', note: 'Witch hat, pumpkin and bats.', theme: 'classic', acc: { head: 'witch', item: 'pumpkin' }, ambient: 'bats' },
  ];
  K.pack = (id) => K.PACKS.find((p) => p.id === id) || K.PACKS[0];
})(window.Bud);
