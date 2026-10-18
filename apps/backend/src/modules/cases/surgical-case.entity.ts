import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { CaseStatus, Limb, ProcedureType } from '@vet-plan/shared';
import { Patient } from '../patients/patient.entity.js';
import { Tenant } from '../tenants/tenant.entity.js';
import { User } from '../users/user.entity.js';
import { RadiographPlan } from './radiograph-plan.entity.js';

@Entity('surgical_cases')
@Index('idx_surgical_cases_tenant_status', ['tenantId', 'status'])
export class SurgicalCase {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'tenant_id', type: 'uuid' })
    tenantId: string;

    @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Relation<Tenant>;

    @Index('idx_surgical_cases_patient_id')
    @Column({ name: 'patient_id', type: 'uuid' })
    patientId: string;

    @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'patient_id' })
    patient: Relation<Patient>;

    @Column({ name: 'procedure_type', type: 'enum', enum: ProcedureType, enumName: 'procedure_type' })
    procedureType: ProcedureType;

    @Column({ type: 'enum', enum: Limb, enumName: 'limb', nullable: true })
    limb: Limb | null;

    @Column({ type: 'enum', enum: CaseStatus, enumName: 'case_status', default: CaseStatus.PLANNING })
    status: CaseStatus;

    @Column({ name: 'surgery_date', type: 'date', nullable: true })
    surgeryDate: string | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
    createdById: string | null;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'created_by_id' })
    createdBy: Relation<User> | null;

    @OneToMany(() => RadiographPlan, (plan) => plan.surgicalCase)
    plans: Relation<RadiographPlan>[];

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
