// Hand-drawn SVG scenes. They fill the giant step numbers (like the photo-filled
// "01–04" in the Alecta "Process" template) and the hero desk.

const uri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}")`

const scene = (bg: string, body: string) =>
  uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
    <rect width="400" height="300" fill="${bg}"/>${body}</svg>`)

// Boss: a navy desk with a gold compass and a dashed route between stops.
const boss = scene('#14163a', `
  <circle cx="250" cy="150" r="120" fill="#1f2350"/>
  <circle cx="250" cy="150" r="92" fill="none" stroke="#c9a227" stroke-width="6"/>
  <circle cx="250" cy="150" r="70" fill="none" stroke="#c9a227" stroke-width="2" stroke-dasharray="4 8"/>
  <path d="M250 62 L272 150 L250 238 L228 150 Z" fill="#c9a227"/>
  <path d="M250 62 L272 150 L228 150 Z" fill="#ec5b5b"/>
  <circle cx="250" cy="150" r="9" fill="#fff"/>
  <path d="M20 250 C 80 200, 110 280, 170 220" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 10" stroke-linecap="round"/>
  <circle cx="20" cy="250" r="10" fill="#f2c94c"/><circle cx="60" cy="60" r="5" fill="#fff"/>
  <circle cx="110" cy="30" r="3" fill="#c9a227"/><circle cx="380" cy="40" r="4" fill="#fff"/>
  <rect x="20" y="90" width="110" height="70" rx="6" fill="#2d3166"/>
  <rect x="32" y="104" width="70" height="7" rx="3" fill="#c9a227"/>
  <rect x="32" y="120" width="86" height="5" rx="2" fill="#6b6fa8"/><rect x="32" y="133" width="60" height="5" rx="2" fill="#6b6fa8"/>`)

// Inventory: yellow stationery with folded coral and white tees and a box.
const tee = (x: number, y: number, c: string, r = 0) => `
  <g transform="translate(${x} ${y}) rotate(${r})">
    <path d="M-40 -34 L-16 -46 C-8 -36 8 -36 16 -46 L40 -34 L52 -6 L32 2 L32 46 L-32 46 L-32 2 L-52 -6 Z" fill="${c}"/>
    <path d="M-16 -46 C-8 -36 8 -36 16 -46" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="3"/>
  </g>`
const inventory = scene('#f2c94c', `
  <rect x="-20" y="190" width="440" height="40" fill="#e9b93a"/>
  ${tee(90, 120, '#ec6b5e', -12)}${tee(215, 175, '#3aa597', 8)}${tee(330, 95, '#14163a', -4)}
  <rect x="250" y="20" width="90" height="70" rx="4" fill="#d9a24a" transform="rotate(10 295 55)"/>
  <rect x="250" y="48" width="90" height="10" fill="#b9802f" transform="rotate(10 295 55)"/>
  <rect x="20" y="230" width="150" height="16" rx="8" fill="#14163a" opacity=".85" transform="rotate(-6 95 238)"/>
  <circle cx="370" cy="260" r="22" fill="#ec6b5e"/><circle cx="370" cy="260" r="10" fill="#f2c94c"/>
  <rect x="30" y="20" width="60" height="44" rx="4" fill="#f6a49a" transform="rotate(-10 60 42)"/>
  <rect x="38" y="32" width="40" height="5" rx="2" fill="#ec6b5e" transform="rotate(-10 60 42)"/>`)

// Accounting: teal with stacked gold coins, a receipt and a dollar sign.
const coins = (x: number, y: number, n: number) =>
  Array.from({ length: n }, (_, i) => `
    <ellipse cx="${x}" cy="${y - i * 14 + 8}" rx="40" ry="14" fill="#a8841c"/>
    <ellipse cx="${x}" cy="${y - i * 14}" rx="40" ry="14" fill="#e0b93a"/>`).join('')
const accounting = scene('#3aa597', `
  <g fill="#ffffff" opacity=".22">${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i % 10) * 42 + 10}" cy="${Math.floor(i / 10) * 52 + 14}" r="3"/>`).join('')}</g>
  ${coins(90, 230, 6)}${coins(170, 250, 3)}
  <g transform="rotate(6 300 150)">
    <path d="M240 30 H360 V270 L345 258 L330 270 L315 258 L300 270 L285 258 L270 270 L255 258 L240 270 Z" fill="#f4dfa0"/>
    <rect x="256" y="52" width="70" height="9" rx="4" fill="#14163a"/>
    <rect x="256" y="80" width="88" height="5" rx="2" fill="#b8c6c4"/><rect x="256" y="96" width="60" height="5" rx="2" fill="#b8c6c4"/>
    <rect x="256" y="112" width="80" height="5" rx="2" fill="#b8c6c4"/><rect x="256" y="128" width="50" height="5" rx="2" fill="#b8c6c4"/>
    <rect x="256" y="170" width="88" height="3" fill="#14163a"/>
    <rect x="300" y="186" width="44" height="12" rx="3" fill="#ec5b5b"/>
  </g>
  <circle cx="110" cy="80" r="46" fill="#14163a"/>
  <text x="110" y="100" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="58" fill="#f2c94c">$</text>`)

// Facilities: a blueprint floor plan with doors, windows and a potted plant.
const facilities = scene('#cfd3e0', `
  <g stroke="#a9aec4" stroke-width="1">${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 20} 0V300"/>`).join('')}${Array.from({ length: 16 }, (_, i) => `<path d="M0 ${i * 20}H400"/>`).join('')}</g>
  <g fill="none" stroke="#3b3e57" stroke-width="7" stroke-linejoin="round">
    <path d="M30 30 H370 V270 H30 Z"/><path d="M200 30 V140"/><path d="M200 190 V270"/><path d="M30 160 H130"/><path d="M290 160 H370"/>
  </g>
  <g fill="none" stroke="#3b3e57" stroke-width="2.5">
    <path d="M200 140 A50 50 0 0 1 250 190"/><path d="M130 160 A45 45 0 0 0 175 205"/>
  </g>
  <g stroke="#3aa597" stroke-width="8"><path d="M70 30 H140"/><path d="M260 30 H330"/><path d="M370 200 V250"/></g>
  <rect x="60" y="190" width="90" height="50" rx="4" fill="#c9a227" opacity=".85"/>
  <rect x="240" y="60" width="100" height="60" rx="30" fill="#ec5b5b" opacity=".85"/>
  <circle cx="320" cy="225" r="22" fill="#3f7d5a"/><circle cx="305" cy="210" r="13" fill="#5aa074"/><circle cx="336" cy="214" r="12" fill="#5aa074"/>
  <circle cx="90" cy="90" r="30" fill="none" stroke="#3b3e57" stroke-width="3" stroke-dasharray="6 6"/>`)

// Customer Service: coral with speech bubbles, hearts and confetti.
const bubble = (x: number, y: number, w: number, c: string, line: string) => `
  <g transform="translate(${x} ${y})">
    <path d="M0 0 H${w} a14 14 0 0 1 14 14 V58 a14 14 0 0 1 -14 14 H34 L14 92 L18 72 H0 a14 14 0 0 1 -14 -14 V14 a14 14 0 0 1 14 -14 Z" fill="${c}"/>
    <rect x="12" y="22" width="${w - 40}" height="8" rx="4" fill="${line}"/><rect x="12" y="40" width="${w - 70}" height="8" rx="4" fill="${line}"/>
  </g>`
const heart = (x: number, y: number, s: number, c: string) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6 C0 -2 10 -4 12 4 C14 -4 24 -2 24 6 C24 14 12 22 12 22 C12 22 0 14 0 6 Z" fill="${c}"/>`
const customerService = scene('#ec5b5b', `
  <circle cx="330" cy="60" r="90" fill="#f27b72"/>
  ${bubble(40, 40, 170, '#14163a', '#f6a49a')}${bubble(200, 150, 150, '#f2c94c', '#ffffff')}
  ${heart(60, 200, 2.4, '#f2c94c')}${heart(330, 40, 1.6, '#ffffff')}${heart(150, 250, 1.2, '#f2c94c')}
  <g fill="#ffffff" opacity=".7"><circle cx="20" cy="20" r="5"/><circle cx="380" cy="280" r="6"/><circle cx="250" cy="110" r="4"/><circle cx="120" cy="170" r="3"/></g>
  <rect x="300" y="250" width="60" height="10" rx="5" fill="#14163a" transform="rotate(-20 330 255)"/>`)

export const FILLS = {
  boss: `${boss} center / cover, #14163a`,
  inventory: `${inventory} center / cover, #f2c94c`,
  accounting: `${accounting} center / cover, #3aa597`,
  facilities: `${facilities} center / cover, #cfd3e0`,
  customer_service: `${customerService} center / cover, #ec5b5b`,
}

// Hero: a top-down desk (plant, coffee, laptop, notebook, folded tees, phone).
export const HERO_ART = uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560" preserveAspectRatio="xMidYMid slice">
  <rect width="1600" height="560" fill="#2a2f52"/>
  <rect width="1600" height="560" fill="#33395f" opacity=".5"/>
  <g transform="rotate(-8 520 300)">
    <rect x="300" y="120" width="460" height="300" rx="22" fill="#cfd2dc"/>
    <rect x="322" y="140" width="416" height="236" rx="10" fill="#14163a"/>
    <rect x="350" y="170" width="160" height="14" rx="7" fill="#c9a227"/>
    <rect x="350" y="200" width="300" height="8" rx="4" fill="#4b5088"/><rect x="350" y="220" width="250" height="8" rx="4" fill="#4b5088"/>
    <rect x="350" y="260" width="110" height="90" rx="8" fill="#3aa597"/><rect x="476" y="260" width="110" height="90" rx="8" fill="#ec5b5b"/><rect x="602" y="260" width="110" height="90" rx="8" fill="#f2c94c"/>
  </g>
  <g transform="rotate(12 1010 330)">
    <rect x="900" y="210" width="220" height="250" rx="10" fill="#f2c94c"/>
    <rect x="900" y="210" width="26" height="250" fill="#d9a92f"/>
    <rect x="950" y="250" width="130" height="10" rx="5" fill="#fff" opacity=".85"/><rect x="950" y="275" width="100" height="8" rx="4" fill="#fff" opacity=".6"/>
    <rect x="1080" y="150" width="14" height="180" rx="7" fill="#ec5b5b" transform="rotate(30 1087 240)"/>
  </g>
  <g transform="translate(150 420)">
    <circle r="92" fill="#e9e6df"/><circle r="64" fill="#fff"/><circle r="50" fill="#3b2418"/><circle r="50" fill="none" stroke="#6b4632" stroke-width="6"/>
    <ellipse cx="-14" cy="-14" rx="16" ry="9" fill="#a0745a" opacity=".6"/>
    <rect x="58" y="-12" width="54" height="24" rx="12" fill="#fff"/>
  </g>
  <g transform="translate(1330 120)">
    <circle r="70" fill="#8a6a4a"/><circle r="56" fill="#5b4330"/>
    ${[0, 40, 85, 130, 180, 225, 270, 315].map((a, i) => `<ellipse cx="0" cy="-120" rx="${i % 2 ? 46 : 58}" ry="${i % 2 ? 110 : 132}" fill="${i % 3 === 0 ? '#3f7d5a' : i % 3 === 1 ? '#5aa074' : '#2f6447'}" transform="rotate(${a})"/>`).join('')}
    <circle r="24" fill="#2f6447"/>
  </g>
  <g transform="translate(1180 470) rotate(-14)">
    <path d="M-80 -60 L-30 -84 C-14 -66 14 -66 30 -84 L80 -60 L104 -8 L64 6 L64 90 L-64 90 L-64 6 L-104 -8 Z" fill="#ffffff"/>
    <text x="0" y="40" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="44" fill="#14163a">CC</text>
  </g>
  <g transform="translate(700 520) rotate(6)">
    <path d="M-90 -70 L-34 -96 C-16 -76 16 -76 34 -96 L90 -70 L116 -10 L72 6 L72 100 L-72 100 L-72 6 L-116 -10 Z" fill="#ec6b5e"/>
  </g>
  <g transform="rotate(-20 1500 430)"><rect x="1450" y="340" width="100" height="180" rx="18" fill="#14163a"/><rect x="1460" y="356" width="80" height="140" rx="8" fill="#3aa597"/></g>
  <g fill="#c9a227"><circle cx="820" cy="80" r="6"/><circle cx="860" cy="60" r="4"/><circle cx="260" cy="70" r="5"/></g>
</svg>`)
