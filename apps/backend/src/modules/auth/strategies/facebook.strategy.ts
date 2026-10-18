import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@vet-plan/shared';
import { Strategy } from 'passport-facebook';
import type { Profile } from 'passport-facebook';
import type { User } from '../../users/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import { oauthStrategyOptions } from '../oauth/oauth.config.js';
import { mapFacebookProfile } from '../oauth/oauth-profile.mappers.js';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, OAuthProvider.FACEBOOK) {
    constructor(configService: ConfigService, private readonly usersService: UsersService) {
        super({
            ...oauthStrategyOptions(configService, OAuthProvider.FACEBOOK),
            scope: ['email', 'public_profile'],
            profileFields: ['id', 'displayName', 'emails', 'photos'],
        });
    }

    validate(_accessToken: string, _refreshToken: string, profile: Profile): Promise<User> {
        return this.usersService.findOrCreateFromOAuth(mapFacebookProfile(profile));
    }
}
