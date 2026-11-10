import { Module } from '@nestjs/common';
import { CompteursController } from './compteurs.controller';
import { CompteursService } from './compteurs.service';

@Module({ controllers: [CompteursController], providers: [CompteursService] })
export class CompteursModule {}
