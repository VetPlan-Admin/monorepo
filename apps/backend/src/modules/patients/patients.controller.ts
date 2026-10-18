import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CLINICAL_ROLES, createPatientSchema, patientQuerySchema, Role, updatePatientSchema } from '@vet-plan/shared';
import type { CreatePatientDto, Paginated, PatientDto, PatientQueryDto, UpdatePatientDto } from '@vet-plan/shared';
import { requireTenantId } from '../../common/tenant.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { PatientsService } from './patients.service.js';

@Controller('patients')
export class PatientsController {
    constructor(private readonly patientsService: PatientsService) { }

    @Get()
    @Roles(...CLINICAL_ROLES)
    list(
        @CurrentUser() user: AuthenticatedUser,
        @Query(new ZodValidationPipe(patientQuerySchema)) query: PatientQueryDto,
    ): Promise<Paginated<PatientDto>> {
        return this.patientsService.list(requireTenantId(user), query);
    }

    @Get(':id')
    @Roles(...CLINICAL_ROLES)
    get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<PatientDto> {
        return this.patientsService.get(requireTenantId(user), id);
    }

    // Assistants register and update patients; only clinic admins delete them
    @Post()
    @Roles(...CLINICAL_ROLES)
    create(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(createPatientSchema)) dto: CreatePatientDto,
    ): Promise<PatientDto> {
        return this.patientsService.create(requireTenantId(user), dto);
    }

    @Patch(':id')
    @Roles(...CLINICAL_ROLES)
    update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body(new ZodValidationPipe(updatePatientSchema)) dto: UpdatePatientDto,
    ): Promise<PatientDto> {
        return this.patientsService.update(requireTenantId(user), id, dto);
    }

    @Delete(':id')
    @HttpCode(204)
    @Roles(Role.CLINIC_ADMIN)
    remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.patientsService.remove(requireTenantId(user), id);
    }
}
