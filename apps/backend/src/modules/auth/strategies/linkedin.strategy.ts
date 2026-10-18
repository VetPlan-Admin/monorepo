import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@vet-plan/shared';
import type { User } from '../../users/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import { LinkedInOidcStrategy } from '../oauth/linkedin-oidc.strategy.js';
import { oauthStrategyOptions } from '../oauth/oauth.config.js';
import { mapLinkedInProfile } from '../oauth/oauth-profile.mappers.js';
import type { LinkedInUserInfo } from '../oauth/oauth-profile.mappers.js';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(LinkedInOidcStrategy, OAuthProvider.LINKEDIN) {
    constructor(configService: ConfigService, private readonly usersService: UsersService) {
        super(oauthStrategyOptions(configService, OAuthProvider.LINKEDIN));
    }

    validate(_accessToken: string, _refreshToken: string, info: LinkedInUserInfo): Promise<User> {
        return this.usersService.findOrCreateFromOAuth(mapLinkedInProfile(info));
    }
}
