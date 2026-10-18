import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgicalCase } from '../cases/surgical-case.entity.js';
import { Patient } from './patient.entity.js';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([Patient, SurgicalCase])],
    controllers: [PatientsController],
    providers: [PatientsService],
    exports: [PatientsService],
})
export class PatientsModule { }
