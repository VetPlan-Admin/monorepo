import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import {
    caseQuerySchema,
    CLINICAL_ROLES,
    createCaseSchema,
    PLANNING_ROLES,
    Role,
    savePlanSchema,
    updateCaseSchema,
} from '@vet-plan/shared';
import type {
    CaseDetailDto,
    CaseQueryDto,
    CaseSummaryDto,
    CreateCaseDto,
    Paginated,
    RadiographPlanDto,
    SavePlanDto,
    SurgicalPlanReportDto,
    UpdateCaseDto,
} from '@vet-plan/shared';
import type { Response } from 'express';
import { requireTenantId } from '../../common/tenant.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { CasesService } from './cases.service.js';

@Controller('cases')
export class CasesController {
    constructor(private readonly casesService: CasesService) { }

    @Get()
    @Roles(...CLINICAL_ROLES)
    list(
        @CurrentUser() user: AuthenticatedUser,
        @Query(new ZodValidationPipe(caseQuerySchema)) query: CaseQueryDto,
    ): Promise<Paginated<CaseSummaryDto>> {
        return this.casesService.list(requireTenantId(user), query);
    }

    @Get(':id')
    @Roles(...CLINICAL_ROLES)
    get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CaseDetailDto> {
        return this.casesService.get(requireTenantId(user), id);
    }

    @Post()
    @Roles(...PLANNING_ROLES)
    create(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodValidationPipe(createCaseSchema)) dto: CreateCaseDto,
    ): Promise<CaseDetailDto> {
        return this.casesService.create(requireTenantId(user), user.userId, dto);
    }

    @Patch(':id')
    @Roles(...PLANNING_ROLES)
    update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body(new ZodValidationPipe(updateCaseSchema)) dto: UpdateCaseDto,
    ): Promise<CaseDetailDto> {
        return this.casesService.update(requireTenantId(user), id, dto);
    }

    @Delete(':id')
    @HttpCode(204)
    @Roles(Role.CLINIC_ADMIN)
    remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.casesService.remove(requireTenantId(user), id);
    }

    @Post(':id/plans')
    @Roles(...PLANNING_ROLES)
    createPlan(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Body(new ZodValidationPipe(savePlanSchema)) dto: SavePlanDto,
    ): Promise<RadiographPlanDto> {
        return this.casesService.createPlan(requireTenantId(user), user.userId, id, dto);
    }

    @Put(':id/plans/:planId')
    @Roles(...PLANNING_ROLES)
    updatePlan(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('planId', ParseUUIDPipe) planId: string,
        @Body(new ZodValidationPipe(savePlanSchema)) dto: SavePlanDto,
    ): Promise<RadiographPlanDto> {
        return this.casesService.updatePlan(requireTenantId(user), id, planId, dto);
    }

    @Delete(':id/plans/:planId')
    @HttpCode(204)
    @Roles(...PLANNING_ROLES)
    removePlan(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Param('planId', ParseUUIDPipe) planId: string,
    ): Promise<void> {
        return this.casesService.removePlan(requireTenantId(user), id, planId);
    }

    /** JSON planning report, served as a download. */
    @Get(':id/report')
    @Roles(...CLINICAL_ROLES)
    async report(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id', ParseUUIDPipe) id: string,
        @Res({ passthrough: true }) response: Response,
    ): Promise<SurgicalPlanReportDto> {
        const report = await this.casesService.report(requireTenantId(user), user.userId, id);
        response.setHeader('Content-Disposition', `attachment; filename="vet-plan-case-${id.slice(0, 8)}-report.json"`);
        return report;
    }
}
