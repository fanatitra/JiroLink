import { garde } from './shared';
import type { StatusTenant, StatusUtilisateur, TypeTenant } from './enums';

export class Tenant {
  constructor(
    public readonly idTenant: string,
    public nom: string,
    public typeTenant: TypeTenant,
    public statusTenant: StatusTenant = 'ACTIF',
    public adresse?: string,
    public telephone?: string,
    public email?: string,
    /** Carte d'identité nationale : donnée personnelle sensible, à ne jamais journaliser ni exposer par l'API. */
    public cin?: string,
  ) {
    garde(nom.trim().length > 0, 'TENANT_NOM_REQUIS', 'Le nom du tenant est obligatoire');
  }

  suspendre(): void {
    garde(this.statusTenant === 'ACTIF', 'TENANT_DEJA_SUSPENDU', 'Tenant déjà suspendu');
    this.statusTenant = 'SUSPENDU';
  }

  reactiver(): void {
    garde(this.statusTenant === 'SUSPENDU', 'TENANT_DEJA_ACTIF', 'Tenant déjà actif');
    this.statusTenant = 'ACTIF';
  }
}

/** Le diagramme porte « permission » comme attribut de Role (pas de classe Permission) : liste de codes "MODULE:ACTION". */
export class Role {
  private readonly codes: Set<string>;

  constructor(
    public readonly idRole: string,
    public nom: string,
    permissions: readonly string[] = [],
    public description?: string,
  ) {
    this.codes = new Set(permissions);
  }

  get permissions(): readonly string[] {
    return [...this.codes];
  }

  accorder(code: string): void {
    this.codes.add(code);
  }

  retirer(code: string): void {
    this.codes.delete(code);
  }

  possede(code: string): boolean {
    return this.codes.has(code);
  }
}

export class Utilisateur {
  public readonly email: string;

  constructor(
    public readonly idUtilisateur: string,
    public readonly tenantId: string, // « Appartenir » : chaque utilisateur appartient à un tenant (RM2 pkg 7)
    public roleId: string, // un utilisateur a exactement un rôle (Role 1 — 0..* Utilisateur)
    public nom: string,
    public prenom: string,
    email: string,
    private readonly motDePasseHash: string, // RM5 pkg 7 : jamais de mot de passe en clair
    public statusUtilisateur: StatusUtilisateur = 'ACTIF',
    public telephone?: string,
    public derniereConnexion?: Date,
    public readonly dateCreation: Date = new Date(),
  ) {
    garde(/^\S+@\S+\.\S+$/.test(email), 'EMAIL_INVALIDE', `Email invalide : ${email}`);
    this.email = email.toLowerCase();
  }

  /** RM3 pkg 7 : les permissions viennent du rôle. Un compte non actif n'a aucune permission. */
  aPermission(code: string, role: Role): boolean {
    return this.statusUtilisateur === 'ACTIF' && role.idRole === this.roleId && role.possede(code);
  }

  changerRole(roleId: string): void {
    this.roleId = roleId;
  }

  verifierMotDePasse(hashCandidat: string): boolean {
    return this.motDePasseHash === hashCandidat;
  }

  enregistrerConnexion(maintenant: Date = new Date()): void {
    garde(this.statusUtilisateur === 'ACTIF', 'COMPTE_INACTIF', 'Compte désactivé ou verrouillé');
    this.derniereConnexion = maintenant;
  }

  desactiver(): void {
    this.statusUtilisateur = 'DESACTIVE';
  }

  verrouiller(): void {
    this.statusUtilisateur = 'VERROUILLE';
  }
}
