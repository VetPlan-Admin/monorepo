import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsModule } from '../patients/patients.module.js';
import { Tenant } from '../tenants/tenant.entity.js';
import { User } from '../users/user.entity.js';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { RadiographPlan } from './radiograph-plan.entity.js';
import { SurgicalCase } from './surgical-case.entity.js';

@Module({
    imports: [TypeOrmModule.forFeature([SurgicalCase, RadiographPlan, Tenant, User]), PatientsModule],
    controllers: [CasesController],
    providers: [CasesService],
})
export class CasesModule { }
