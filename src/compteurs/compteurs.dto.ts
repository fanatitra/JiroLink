import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { normaliserMac } from '../domain';

export class CreerCompteurDto {
  /**
   * Identifiant du compteur et deviceId MQTT (jirolink/{adresseMac}/…). Accepte "a4:cf:12:34:56:78",
   * "A4-CF-…", "a4cf.1234.5678" ou "A4CF…" ; normalisé en 12 hexadécimaux majuscules. Aucun caractère de topic MQTT (/ + #) n'est possible.
   */
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return normaliserMac(value);
    } catch {
      return value; // la validation @Matches ci-dessous produira l'erreur 400
    }
  })
  @Matches(/^[0-9A-F]{12}$/, { message: 'adresseMac : 12 caractères hexadécimaux (ex. A4:CF:12:34:56:78)' })
  adresseMac!: string;

  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/, {
    message: 'numeroSerie : 3 à 64 caractères (lettres, chiffres, point, tiret, underscore), sans espace',
  })
  numeroSerie!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  modele?: string;
}

export class ListerCompteursDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
