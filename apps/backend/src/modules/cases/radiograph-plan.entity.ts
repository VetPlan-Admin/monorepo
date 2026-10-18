import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { ImageSpacing, MeasurementResult, PlanMeasurement } from '@vet-plan/shared';
import { User } from '../users/user.entity.js';
import { SurgicalCase } from './surgical-case.entity.js';

/**
 * Landmarks placed on one radiograph. The image itself is NOT stored (privacy, $0 storage):
 * only its pixel dimensions and declared scale, so the plan can be re-attached to the same file.
 */
@Entity('radiograph_plans')
export class RadiographPlan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index('idx_radiograph_plans_case_id')
    @Column({ name: 'case_id', type: 'uuid' })
    caseId: string;

    @ManyToOne(() => SurgicalCase, (surgicalCase) => surgicalCase.plans, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'case_id' })
    surgicalCase: Relation<SurgicalCase>;

    @Column({ length: 120 })
    label: string;

    @Column({ name: 'image_width', type: 'integer' })
    imageWidth: number;

    @Column({ name: 'image_height', type: 'integer' })
    imageHeight: number;

    @Column({ name: 'image_spacing', type: 'jsonb', nullable: true })
    imageSpacing: ImageSpacing | null;

    /** Scale the server resolved when computing `results`. */
    @Column({ type: 'jsonb', nullable: true })
    calibration: { mmPerPixel: number; source: string } | null;

    @Column({ type: 'jsonb' })
    measurements: PlanMeasurement[];

    /** Server-computed snapshot at save time (`computePlanResults`). */
    @Column({ type: 'jsonb' })
    results: MeasurementResult[];

    @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
    createdById: string | null;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'created_by_id' })
    createdBy: Relation<User> | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
