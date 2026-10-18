import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { canTransitionCase, CASE_STATUS_LABELS, computePlanResults, isCaseEditable } from '@vet-plan/shared';
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
import { escapeLike } from '../../common/tenant.js';
import { PatientsService } from '../patients/patients.service.js';
import { Tenant } from '../tenants/tenant.entity.js';
import { User } from '../users/user.entity.js';
import { toCaseDetailDto, toCaseSummaryDto, toPlanDto } from './case.mapper.js';
import { RadiographPlan } from './radiograph-plan.entity.js';
import { buildSurgicalPlanReport } from './report.builder.js';
import { SurgicalCase } from './surgical-case.entity.js';

@Injectable()
export class CasesService {
    constructor(
        @InjectRepository(SurgicalCase) private readonly cases: Repository<SurgicalCase>,
        @InjectRepository(RadiographPlan) private readonly plans: Repository<RadiographPlan>,
        @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
        @InjectRepository(User) private readonly users: Repository<User>,
        private readonly patientsService: PatientsService,
    ) { }

    async list(tenantId: string, query: CaseQueryDto): Promise<Paginated<CaseSummaryDto>> {
        const qb = this.cases
            .createQueryBuilder('c')
            .innerJoinAndSelect('c.patient', 'p')
            .where('c.tenantId = :tenantId', { tenantId });
        if (query.status) qb.andWhere('c.status = :status', { status: query.status });
        if (query.procedureType) qb.andWhere('c.procedureType = :procedureType', { procedureType: query.procedureType });
        if (query.patientId) qb.andWhere('c.patientId = :patientId', { patientId: query.patientId });
        if (query.search) {
            const search = `%${escapeLike(query.search)}%`;
            qb.andWhere(
                new Brackets((w) =>
                    w.where('p.name ILIKE :search', { search })
                        .orWhere('p.ownerName ILIKE :search', { search })
                        .orWhere('p.externalId ILIKE :search', { search }),
                ),
            );
        }
        const [rows, total] = await qb
            .orderBy('c.updatedAt', 'DESC')
            .skip((query.page - 1) * query.pageSize)
            .take(query.pageSize)
            .getManyAndCount();
        const counts = await this.planCounts(rows.map((c) => c.id));
        return {
            items: rows.map((c) => toCaseSummaryDto(c, counts.get(c.id) ?? 0)),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
    }

    private async planCounts(caseIds: string[]): Promise<Map<string, number>> {
        if (caseIds.length === 0) return new Map();
        const rows = await this.plans
            .createQueryBuilder('plan')
            .select('plan.caseId', 'caseId')
            .addSelect('COUNT(*)', 'count')
            .where('plan.caseId IN (:...caseIds)', { caseIds })
            .groupBy('plan.caseId')
            .getRawMany<{ caseId: string; count: string }>();
        return new Map(rows.map((row) => [row.caseId, Number(row.count)]));
    }

    /** Throws 404 for cases of other clinics, so their existence isn't revealed. */
    private async findEntity(tenantId: string, id: string): Promise<SurgicalCase> {
        const surgicalCase = await this.cases.findOne({
            where: { id, tenantId },
            relations: { patient: true, createdBy: true },
        });
        if (!surgicalCase) {
            throw new NotFoundException('Case not found');
        }
        return surgicalCase;
    }

    private findPlans(caseId: string): Promise<RadiographPlan[]> {
        return this.plans.find({ where: { caseId }, relations: { createdBy: true }, order: { createdAt: 'ASC' } });
    }

    async get(tenantId: string, id: string): Promise<CaseDetailDto> {
        const surgicalCase = await this.findEntity(tenantId, id);
        return toCaseDetailDto(surgicalCase, await this.findPlans(id));
    }

    async create(tenantId: string, userId: string, dto: CreateCaseDto): Promise<CaseDetailDto> {
        await this.patientsService.findEntity(tenantId, dto.patientId);
        const { id } = await this.cases.save(this.cases.create({ ...dto, tenantId, createdById: userId }));
        return this.get(tenantId, id);
    }

    async update(tenantId: string, id: string, dto: UpdateCaseDto): Promise<CaseDetailDto> {
        const surgicalCase = await this.findEntity(tenantId, id);
        const { status, notes, ...clinical } = dto;

        if (Object.keys(clinical).length > 0 && !isCaseEditable(surgicalCase.status)) {
            throw new ConflictException(`A ${CASE_STATUS_LABELS[surgicalCase.status].toLowerCase()} case can't be edited`);
        }
        if (status && status !== surgicalCase.status && !canTransitionCase(surgicalCase.status, status)) {
            throw new ConflictException(
                `A ${CASE_STATUS_LABELS[surgicalCase.status].toLowerCase()} case can't become ${CASE_STATUS_LABELS[status].toLowerCase()}`,
            );
        }
        await this.cases.update({ id }, { ...clinical, ...(notes !== undefined ? { notes } : {}), ...(status ? { status } : {}) });
        return this.get(tenantId, id);
    }

    async remove(tenantId: string, id: string): Promise<void> {
        await this.cases.remove(await this.findEntity(tenantId, id));
    }

    private async findEditableCase(tenantId: string, caseId: string): Promise<SurgicalCase> {
        const surgicalCase = await this.findEntity(tenantId, caseId);
        if (!isCaseEditable(surgicalCase.status)) {
            throw new ConflictException(`Plans of a ${CASE_STATUS_LABELS[surgicalCase.status].toLowerCase()} case can't change`);
        }
        return surgicalCase;
    }

    private planColumns(dto: SavePlanDto) {
        // Results are always recomputed here: values sent by a client are never trusted
        const { calibration, results } = computePlanResults(dto.measurements, dto.imageSpacing);
        return {
            label: dto.label,
            imageWidth: dto.imageWidth,
            imageHeight: dto.imageHeight,
            imageSpacing: dto.imageSpacing ?? null,
            measurements: dto.measurements,
            calibration,
            results,
        };
    }

    private async findPlanDto(planId: string): Promise<RadiographPlanDto> {
        const plan = await this.plans.findOneOrFail({ where: { id: planId }, relations: { createdBy: true } });
        return toPlanDto(plan);
    }

    async createPlan(tenantId: string, userId: string, caseId: string, dto: SavePlanDto): Promise<RadiographPlanDto> {
        await this.findEditableCase(tenantId, caseId);
        const { id } = await this.plans.save(this.plans.create({ ...this.planColumns(dto), caseId, createdById: userId }));
        await this.cases.update({ id: caseId }, { updatedAt: new Date() });
        return this.findPlanDto(id);
    }

    private async findPlan(caseId: string, planId: string): Promise<RadiographPlan> {
        const plan = await this.plans.findOne({ where: { id: planId, caseId } });
        if (!plan) {
            throw new NotFoundException('Plan not found');
        }
        return plan;
    }

    async updatePlan(tenantId: string, caseId: string, planId: string, dto: SavePlanDto): Promise<RadiographPlanDto> {
        await this.findEditableCase(tenantId, caseId);
        const plan = await this.findPlan(caseId, planId);
        await this.plans.save(this.plans.merge(plan, this.planColumns(dto)));
        await this.cases.update({ id: caseId }, { updatedAt: new Date() });
        return this.findPlanDto(planId);
    }

    async removePlan(tenantId: string, caseId: string, planId: string): Promise<void> {
        await this.findEditableCase(tenantId, caseId);
        await this.plans.remove(await this.findPlan(caseId, planId));
    }

    async report(tenantId: string, userId: string, caseId: string): Promise<SurgicalPlanReportDto> {
        const surgicalCase = await this.findEntity(tenantId, caseId);
        const [plans, clinic, generatedBy] = await Promise.all([
            this.findPlans(caseId),
            this.tenants.findOneByOrFail({ id: tenantId }),
            this.users.findOneByOrFail({ id: userId }),
        ]);
        return buildSurgicalPlanReport({ clinic, surgicalCase, plans, generatedBy, generatedAt: new Date() });
    }
}
