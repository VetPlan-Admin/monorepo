import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@vet-plan/shared';
import { Tenant } from '../tenants/tenant.entity.js';
import { OAuthAccount } from './oauth-account.entity.js';
import type { OAuthProfile } from './oauth-profile.js';
import { User } from './user.entity.js';

const TENANT_NAME_MAX_LENGTH = 120;

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User) private readonly users: Repository<User>,
        private readonly dataSource: DataSource,
    ) { }

    findById(id: string): Promise<User | null> {
        return this.users.findOne({ where: { id }, relations: { tenant: true } });
    }

    /**
     * Resolves the user behind a social login, in order:
     * 1. a previously linked provider identity,
     * 2. an existing user with the same verified email (links the new provider),
     * 3. otherwise a new clinic (tenant) with this user as its CLINIC_ADMIN.
     */
    async findOrCreateFromOAuth(profile: OAuthProfile): Promise<User> {
        if (!profile.email || !profile.emailVerified) {
            throw new UnauthorizedException(`A verified email is required to sign in with ${profile.provider}`);
        }
        const email = profile.email.trim().toLowerCase();

        const userId = await this.dataSource.transaction(async (manager) => {
            const accounts = manager.getRepository(OAuthAccount);
            const users = manager.getRepository(User);

            const linked = await accounts.findOne({
                where: { provider: profile.provider, providerUserId: profile.providerUserId },
                relations: { user: true },
            });

            let user = linked?.user ?? (await users.findOne({ where: { email } }));
            if (!user) {
                const tenant = await manager.getRepository(Tenant).save({
                    name: `${profile.displayName}'s Clinic`.slice(0, TENANT_NAME_MAX_LENGTH),
                });
                user = users.create({
                    email,
                    displayName: profile.displayName,
                    avatarUrl: profile.avatarUrl,
                    role: Role.CLINIC_ADMIN,
                    tenantId: tenant.id,
                });
            }

            user.lastLoginAt = new Date();
            user.avatarUrl ??= profile.avatarUrl;
            const saved = await users.save(user);

            if (!linked) {
                await accounts.save(
                    accounts.create({
                        provider: profile.provider,
                        providerUserId: profile.providerUserId,
                        userId: saved.id,
                    }),
                );
            }
            return saved.id;
        });

        const user = await this.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User disappeared during sign-in');
        }
        return user;
    }
}
