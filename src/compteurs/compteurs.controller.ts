import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { ParseMacPipe } from '../common/parse-mac.pipe';
import { P } from '../common/permissions';
import type { UtilisateurCourant } from '../common/auth.types';
import { CreerCompteurDto, ListerCompteursDto } from './compteurs.dto';
import { CompteursService } from './compteurs.service';

@Controller('compteurs')
export class CompteursController {
  constructor(private readonly compteurs: CompteursService) {}

  @Post()
  @RequirePermissions(P.COMPTEURS_ENREGISTRER)
  enregistrer(@CurrentUser() user: UtilisateurCourant, @Body() dto: CreerCompteurDto) {
    return this.compteurs.enregistrer(user, dto);
  }

  @Get()
  @RequirePermissions(P.COMPTEURS_LIRE)
  lister(@CurrentUser() user: UtilisateurCourant, @Query() q: ListerCompteursDto) {
    return this.compteurs.lister(user, q);
  }

  @Get(':adresseMac')
  @RequirePermissions(P.COMPTEURS_LIRE)
  obtenir(@CurrentUser() user: UtilisateurCourant, @Param('adresseMac', ParseMacPipe) adresseMac: string) {
    return this.compteurs.obtenir(user, adresseMac);
  }
}
