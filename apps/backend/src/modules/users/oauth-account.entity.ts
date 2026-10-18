import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { OAuthProvider } from '@vet-plan/shared';
import { User } from './user.entity.js';

/** Links a social login identity (Google, LinkedIn, Facebook) to a user. */
@Entity('oauth_accounts')
@Unique('uq_oauth_accounts_provider_user', ['provider', 'providerUserId'])
export class OAuthAccount {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: OAuthProvider, enumName: 'oauth_provider' })
    provider: OAuthProvider;

    /** The provider's stable subject id (never the email). */
    @Column({ name: 'provider_user_id', length: 255 })
    providerUserId: string;

    @Index('idx_oauth_accounts_user_id')
    @Column({ name: 'user_id', type: 'uuid' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: Relation<User>;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}
