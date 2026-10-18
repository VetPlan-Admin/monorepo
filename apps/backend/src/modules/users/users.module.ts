import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity.js';
import { OAuthAccount } from './oauth-account.entity.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([User, OAuthAccount, Tenant])],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
