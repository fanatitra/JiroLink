# Format de token de recharge « JLT1 » — spécification firmware

Destinataires : équipe firmware ESP32. Statut : **provisoire**, en attendant l'arbitrage STS (point ouvert n°2 du cahier des charges). La plateforme et le compteur ne communiquent que par ce format ; remplacer l'algorithme plus tard ne touche pas le reste du système.

## Pourquoi ce format

Le compteur valide le code **hors ligne** (cahier des charges §10) : il n'a pas de base de données à interroger. Le token doit donc contenir lui-même son contenu (index + crédits) et une signature vérifiable avec une clé que seul ce compteur possède.

## Clés

| Clé | Usage | Où elle vit |
|---|---|---|
| Clé racine | Dérive la clé de chaque compteur | Serveur uniquement (jamais dans un compteur) |
| `K_m` (clé compteur) | Signer / vérifier les tokens | Serveur (dérivable) + NVS du compteur, injectée au provisionnement |
| Secret MQTT | Authentification auprès du broker | Distincte de `K_m` |

```
K_m = HMAC-SHA256( cléRacine , "JIROLINK-TOKEN-KEY-V1|" + deviceId )     // 32 octets
```

`deviceId` = **adresse MAC du compteur**, en MAJUSCULES, 12 caractères hexadécimaux, sans séparateur (ex. `A4CF12345678`), chaîne UTF-8 sans terminateur. Le firmware la lit lui-même (`esp_read_mac`) : aucune saisie manuelle. C'est aussi l'identifiant dans les topics MQTT (`jirolink/A4CF12345678/telemetry`).

## Structure du token (23 chiffres décimaux)

```
 chiffres 1–15   : EN-TÊTE  = entier de 48 bits, écrit en décimal sur 15 chiffres (zéros à gauche)
 chiffres 16–23  : MAC      = entier de 24 bits, écrit en décimal sur 8 chiffres (zéros à gauche)

 EN-TÊTE (48 bits, big-endian) :  version (4 bits) | index (20 bits) | crédits en centièmes (24 bits)
 MAC     (24 bits)             :  3 premiers octets de HMAC-SHA256( K_m , en-tête sur 6 octets big-endian )
```

- `version` = 1.
- `index` : 1 à 1 048 575. Compteur de séquence propre à chaque compteur.
- `crédits` : 1 à 16 777 215 centièmes (0,01 à 167 772,15 crédits).
- Le zéro initial du token est normal (« 0175… ») : le saisir tel quel.

## Algorithme de validation (à implémenter dans le compteur)

```
1. code = 23 chiffres exactement, sinon REFUS (format).
2. entete = decimal(code[0..14])   // tient dans un uint64
   mac    = decimal(code[15..22])
3. Si entete >= 2^48 ou mac >= 2^24 → REFUS.
4. octets = entete sur 6 octets big-endian
   attendu = HMAC-SHA256(K_m, octets)[0..2]
   Comparer attendu et mac EN TEMPS CONSTANT → sinon REFUS (invalide).
5. version = entete >> 44 ; si version != 1 → REFUS.
6. index   = (entete >> 24) & 0xFFFFF
   Si index <= dernierIndexAccepté (lu en NVS) → REFUS (rejeu).
7. crédits = (entete & 0xFFFFFF) / 100
   Écrire en NVS, de façon atomique : nouveau solde ET dernierIndexAccepté = index.
8. Afficher le nouveau solde ; publier jirolink/{deviceId}/recharge/ack dès que la liaison existe.
```

## Exigences de sécurité côté firmware (obligatoires)

Le MAC ne fait que 24 bits (16 millions de combinaisons) : il n'est sûr **que** si la saisie est limitée.

1. **Verrouillage anti-force-brute** : après 5 codes erronés consécutifs, bloquer la saisie 15 minutes (durée persistante en NVS, le redémarrage ne doit pas remettre le compteur à zéro).
2. **Index monotone** : ne jamais accepter un index ≤ au dernier accepté. Conséquence métier : si un client reçoit deux tokens (index 5 puis 6) et saisit le 6 d'abord, le 5 devient inutilisable. La plateforme n'émet les tokens que dans l'ordre.
3. **Atomicité** : le crédit du solde et la mise à jour de l'index doivent être écrits ensemble (une coupure de courant entre les deux permettrait de rejouer le token).
4. **Expiration** : un token n'expire pas côté compteur (pas d'horloge fiable hors ligne). L'expiration est gérée côté plateforme.

## Vecteurs de test

`docs/token-test-vectors.json` contient des cas valides (avec la clé compteur, l'en-tête en hexadécimal et le MAC) et des cas à refuser (chiffre modifié, mauvais compteur, rejeu, format). Le firmware doit produire / refuser exactement les mêmes résultats. La clé racine qui s'y trouve est une **clé de test** ; la valeur réelle de production n'apparaît nulle part dans le dépôt.

Régénération : `npm run vecteurs:token`.
