import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { PatientSex, Species } from '@vet-plan/shared';
import { Tenant } from '../tenants/tenant.entity.js';

/** An animal treated by a clinic. */
@Entity('patients')
export class Patient {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index('idx_patients_tenant_id')
    @Column({ name: 'tenant_id', type: 'uuid' })
    tenantId: string;

    @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Relation<Tenant>;

    @Column({ length: 120 })
    name: string;

    @Column({ type: 'enum', enum: Species, enumName: 'species' })
    species: Species;

    @Column({ type: 'varchar', length: 120, nullable: true })
    breed: string | null;

    @Column({ type: 'enum', enum: PatientSex, enumName: 'patient_sex', nullable: true })
    sex: PatientSex | null;

    /** ISO date string (TypeORM maps Postgres `date` to 'YYYY-MM-DD'). */
    @Column({ name: 'date_of_birth', type: 'date', nullable: true })
    dateOfBirth: string | null;

    @Column({ name: 'weight_kg', type: 'double precision', nullable: true })
    weightKg: number | null;

    @Column({ name: 'owner_name', type: 'varchar', length: 160, nullable: true })
    ownerName: string | null;

    /** The clinic's own record number. */
    @Column({ name: 'external_id', type: 'varchar', length: 64, nullable: true })
    externalId: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
