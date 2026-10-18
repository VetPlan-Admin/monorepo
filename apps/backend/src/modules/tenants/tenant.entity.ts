import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** A veterinary clinic. Every non-SUPER_ADMIN user belongs to exactly one tenant. */
@Entity('tenants')
export class Tenant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 120 })
    name: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
