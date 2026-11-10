/** Variables d'environnement, validées au démarrage : l'application refuse de démarrer si l'une est absente ou faible. */
export interface Env {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  tokenRootKey: Buffer; // clé racine de dérivation des clés compteur (32 octets)
  tokenPepper: string; // secret pour hacher les codes de recharge en base
}

export function chargerEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const erreurs: string[] = [];
  const requis = (nom: string): string => {
    const v = source[nom];
    if (!v) erreurs.push(`${nom} est requis`);
    return v ?? '';
  };

  const databaseUrl = requis('DATABASE_URL');
  const jwtSecret = requis('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) erreurs.push('JWT_SECRET doit faire au moins 32 caractères');

  const racineHex = requis('TOKEN_ROOT_KEY');
  if (racineHex && !/^[0-9a-fA-F]{64}$/.test(racineHex)) erreurs.push('TOKEN_ROOT_KEY doit être 64 caractères hexadécimaux (32 octets)');

  const tokenPepper = requis('TOKEN_PEPPER');
  if (tokenPepper && tokenPepper.length < 16) erreurs.push('TOKEN_PEPPER doit faire au moins 16 caractères');

  const port = Number(source.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) erreurs.push('PORT invalide');

  if (erreurs.length > 0) {
    throw new Error(`Configuration invalide :\n - ${erreurs.join('\n - ')}\nVoir .env.example`);
  }

  return {
    port,
    databaseUrl,
    jwtSecret,
    jwtExpiresIn: source.JWT_EXPIRES_IN ?? '15m',
    tokenRootKey: Buffer.from(racineHex, 'hex'),
    tokenPepper,
  };
}

/** Jeton d'injection de la configuration. */
export const ENV = Symbol('ENV');
