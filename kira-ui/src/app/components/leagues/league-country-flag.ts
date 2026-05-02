/**
 * Resolve ISO 3166-1 alpha-2 from free-text country (VN/EN mix, parentheses).
 * Used with https://flagcdn.com — static CDN, no API key.
 */
export function countryToFlagIso2(country: string | null | undefined): string | null {
  if (country == null || !country.trim()) {
    return null;
  }

  const n = country
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  /** Order matters: more specific / longer patterns first. */
  const rules: [RegExp, string][] = [
    [/\b(scotland|sco)\b/, 'gb-sct'],
    [/\b(wales|wal)\b/, 'gb-wls'],
    [/\b(northern ireland)\b/, 'gb-nir'],
    [/\b(england|united kingdom|great britain|\buk\b|anh\s*\(|premier league uk)/, 'gb'],
    [/\b(viet\s*nam|vietnam|viet)/, 'vn'],
    [/\b(spain|tay ban nha|espana|\besp\b)/, 'es'],
    [/\b(germany|duc|deutschland|\bger\b)/, 'de'],
    [/\b(italy|italia|\bita\b|y\s*\(|serie a it)/, 'it'],
    [/\b(france|phap|\bfra\b)/, 'fr'],
    [/\b(portugal|\bpor\b)/, 'pt'],
    [/\b(netherlands|holland|ha lan|\bned\b)/, 'nl'],
    [/\b(belgium|\bbel\b)/, 'be'],
    [/\b(ireland|irish|\birl\b)(?!.*north)/, 'ie'],
    [/\b(brazil|brasil|\bbra\b)/, 'br'],
    [/\b(argentina|\barg\b)/, 'ar'],
    [/\b(mexico|\bmex\b)/, 'mx'],
    [/\b(united states|usa|\busa\b)/, 'us'],
    [/\b(canada|\bcan\b)/, 'ca'],
    [/\b(japan|nhat ban|\bjpn\b)/, 'jp'],
    [/\b(south korea|korea republic|han quoc|\bkor\b)/, 'kr'],
    [/\b(china|trung quoc|\bchn\b)/, 'cn'],
    [/\b(australia|\baus\b)/, 'au'],
    [/\b(turkey|turkiye|\btur\b)/, 'tr'],
    [/\b(poland|polska|\bpol\b)/, 'pl'],
    [/\b(ukraine|\bukr\b)/, 'ua'],
    [/\b(russia|nga|\brus\b)/, 'ru'],
    [/\b(saudi|arabia|\bksa\b)/, 'sa'],
    [/\b(uae|emirates)\b/, 'ae'],
    [/\b(egypt|\bega\b)/, 'eg'],
    [/\b(south africa|\brsa\b)/, 'za'],
    [/\b(sweden|\bswe\b)/, 'se'],
    [/\b(norway|\bnor\b)/, 'no'],
    [/\b(denmark|\bdnk\b)/, 'dk'],
    [/\b(greece|\bgre\b)/, 'gr'],
    [/\b(croatia|\bcro\b)/, 'hr'],
    [/\b(serbia|\bsrb\b)/, 'rs'],
    [/\b(switzerland|\bche\b)/, 'ch'],
    [/\b(austria|\baut\b)/, 'at'],
    [/\b(czech|\bcze\b)/, 'cz'],
    [/\b(slovakia|\bsvk\b)/, 'sk'],
    [/\b(hungary|\bhun\b)/, 'hu'],
    [/\b(romania|\brou\b)/, 'ro'],
    [/\b(bulgaria|\bbul\b)/, 'bg'],
    [/\b(colombia|\bcol\b)/, 'co'],
    [/\b(chile|\bchi\b)/, 'cl'],
    [/\b(uruguay|\buru\b)/, 'uy'],
    [/\b(peru|\bper\b)/, 'pe'],
    [/\b(ecuador|\becu\b)/, 'ec'],
    [/\b(indonesia|indo|\bidn\b)/, 'id'],
    [/\b(thailand|thai lan|\btha\b)/, 'th'],
    [/\b(malaysia|\bmys\b)/, 'my'],
    [/\b(singapore|\bsgp\b)/, 'sg'],
    [/\b(philippines|philippine|\bphl\b)/, 'ph'],
    [/\b(india|an do|\bind\b)/, 'in'],
    [/\b(europe|chau au|uefa|continental europe)/, 'eu'],
    [/\b(world|fifa|international|cua fifa)/, 'un'],
  ];

  for (const [re, iso] of rules) {
    if (re.test(n)) {
      return iso;
    }
  }

  return null;
}

/** PNG width for retina-friendly icons in the league avatar slot. */
export function flagImageUrl(iso2: string): string {
  return `https://flagcdn.com/w80/${iso2}.png`;
}

export function flagUrlFromCountry(country: string | null | undefined): string | null {
  const iso = countryToFlagIso2(country);
  return iso ? flagImageUrl(iso) : null;
}
