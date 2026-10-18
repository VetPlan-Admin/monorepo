import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import type { CreatePatientDto, Paginated, PatientDto, PatientQueryDto, UpdatePatientDto } from '@vet-plan/shared';
import { escapeLike } from '../../common/tenant.js';
import { SurgicalCase } from '../cases/surgical-case.entity.js';
import { Patient } from './patient.entity.js';
import { toPatientDto } from './patient.mapper.js';

@Injectable()
export class PatientsService {
    constructor(
        @InjectRepository(Patient) private readonly patients: Repository<Patient>,
        @InjectRepository(SurgicalCase) private readonly cases: Repository<SurgicalCase>,
    ) { }

    async list(tenantId: string, query: PatientQueryDto): Promise<Paginated<PatientDto>> {
        const qb = this.patients.createQueryBuilder('p').where('p.tenantId = :tenantId', { tenantId });
        if (query.species) {
            qb.andWhere('p.species = :species', { species: query.species });
        }
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
            .orderBy('p.name', 'ASC')
            .skip((query.page - 1) * query.pageSize)
            .take(query.pageSize)
            .getManyAndCount();
        return { items: rows.map(toPatientDto), total, page: query.page, pageSize: query.pageSize };
    }

    /** Throws 404 for patients of other clinics, so their existence isn't revealed. */
    async findEntity(tenantId: string, id: string): Promise<Patient> {
        const patient = await this.patients.findOne({ where: { id, tenantId } });
        if (!patient) {
            throw new NotFoundException('Patient not found');
        }
        return patient;
    }

    async get(tenantId: string, id: string): Promise<PatientDto> {
        return toPatientDto(await this.findEntity(tenantId, id));
    }

    async create(tenantId: string, dto: CreatePatientDto): Promise<PatientDto> {
        const patient = await this.patients.save(this.patients.create({ ...dto, tenantId }));
        return toPatientDto(patient);
    }

    async update(tenantId: string, id: string, dto: UpdatePatientDto): Promise<PatientDto> {
        const patient = await this.findEntity(tenantId, id);
        return toPatientDto(await this.patients.save(this.patients.merge(patient, dto)));
    }

    async remove(tenantId: string, id: string): Promise<void> {
        const patient = await this.findEntity(tenantId, id);
        if (await this.cases.exists({ where: { patientId: patient.id } })) {
            throw new ConflictException('This patient has surgical cases; delete or reassign them first');
        }
        await this.patients.remove(patient);
    }
}
