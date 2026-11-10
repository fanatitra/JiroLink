/** Erreur métier : porte un code stable (utilisable par l'API) et un message lisible. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Lève une DomainError si la condition n'est pas satisfaite. */
export function garde(condition: boolean, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}

export const arrondi2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** "HH:mm" -> minutes depuis minuit. */
export function hhmmEnMinutes(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  garde(m !== null, 'HEURE_INVALIDE', `Heure invalide : "${hhmm}" (format HH:mm attendu)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Date locale -> "YYYY-MM-DD". */
export function cleJour(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Adresse MAC -> forme canonique : 12 chiffres hexadécimaux en MAJUSCULES, sans séparateur.
 * Accepte "aa:bb:cc:dd:ee:ff", "aa-bb-cc-dd-ee-ff", "aabb.ccdd.eeff" ou "aabbccddeeff".
 * C'est la clé primaire du compteur ET son identifiant MQTT (jirolink/{adresseMac}/...) :
 * l'ESP32 peut la lire lui-même, sans configuration préalable. Source unique de normalisation
 * (domaine, DTO d'enregistrement et paramètre d'URL).
 */
export function normaliserMac(saisie: string): string {
  const mac = saisie.trim().replace(/[:.-]/g, '').toUpperCase();
  garde(/^[0-9A-F]{12}$/.test(mac), 'MAC_INVALIDE', `Adresse MAC invalide : "${saisie}" (12 chiffres hexadécimaux attendus)`);
  return mac;
}
