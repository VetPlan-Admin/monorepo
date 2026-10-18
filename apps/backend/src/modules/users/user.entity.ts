import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Role } from '@vet-plan/shared';
import { Tenant } from '../tenants/tenant.entity.js';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Stored lowercased; one account per email across all tenants. */
    @Index('uq_users_email', { unique: true })
    @Column({ length: 320 })
    email: string;

    @Column({ name: 'display_name', length: 200 })
    displayName: string;

    @Column({ name: 'avatar_url', type: 'text', nullable: true })
    avatarUrl: string | null;

    // Roles are a fixed set shared with the frontend, so they live in a Postgres enum, not a table
    @Column({ type: 'enum', enum: Role, enumName: 'user_role' })
    role: Role;

    /** Null only for SUPER_ADMIN (platform staff). */
    @Index('idx_users_tenant_id')
    @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
    tenantId: string | null;

    @ManyToOne(() => Tenant, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Relation<Tenant> | null;

    @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
    lastLoginAt: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
