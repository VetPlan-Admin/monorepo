import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@vet-plan/shared';
import { Strategy } from 'passport-google-oauth20';
import type { Profile } from 'passport-google-oauth20';
import type { User } from '../../users/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import { oauthStrategyOptions } from '../oauth/oauth.config.js';
import { mapGoogleProfile } from '../oauth/oauth-profile.mappers.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, OAuthProvider.GOOGLE) {
    constructor(configService: ConfigService, private readonly usersService: UsersService) {
        super({ ...oauthStrategyOptions(configService, OAuthProvider.GOOGLE), scope: ['openid', 'email', 'profile'] });
    }

    validate(_accessToken: string, _refreshToken: string, profile: Profile): Promise<User> {
        return this.usersService.findOrCreateFromOAuth(mapGoogleProfile(profile));
    }
}
