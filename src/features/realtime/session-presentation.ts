import { lightColors, type ThemeColors } from '@/constants/theme';
export function visitorIdentity(id: string, palette: ThemeColors = lightColors) {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  const colors = palette.avatars;
  const adjectives = ['Purple', 'Emerald', 'Amber', 'Azure', 'Rose', 'Indigo'];
  const animals = ['Rabbit', 'Otter', 'Fox', 'Puma', 'Owl', 'Deer', 'Condor', 'Finch'];
  const index = hash % colors.length;
  return { name: `${adjectives[index]} ${animals[Math.floor(hash / colors.length) % animals.length]}`, color: colors[index] };
}
export function sessionDuration(seconds: number | null) {
  if (seconds === null) return '—';
  const whole = Math.floor(seconds);
  return whole < 60 ? `${whole}s` : whole < 3600 ? `${Math.floor(whole / 60)}m ${whole % 60}s` : `${Math.floor(whole / 3600)}h ${Math.floor(whole % 3600 / 60)}m`;
}
export function referrerLabel(referrer: string) {
  if (!referrer.trim()) return 'Direct';
  try { return new URL(referrer).hostname.replace(/^www\./, '') || referrer; } catch { return referrer; }
}
export function sessionIsActive(end: string, now: number) {
  const elapsed = now - Date.parse(end);
  return elapsed >= -60_000 && elapsed <= 5 * 60_000;
}

// ISO 3166-1 alpha-2 country codes, plus XK used by common geolocation databases.
const flagCountries = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' '));

export function countryFlag(country: string): string | null {
  const code = country.trim().toUpperCase();
  if (!flagCountries.has(code)) return null;
  return String.fromCodePoint(...Array.from(code, letter => 0x1F1E6 + letter.charCodeAt(0) - 65));
}
