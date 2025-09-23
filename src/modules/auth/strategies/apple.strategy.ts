import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-apple';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor() {
    super({
      clientID: process.env.APPLE_CLIENT_ID, // Service ID from Apple
      teamID: process.env.APPLE_TEAM_ID, // Team ID from Apple Dev
      keyID: process.env.APPLE_KEY_ID, // Key ID from Apple Dev
      privateKeyString: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // from .p8 file
      callbackURL: process.env.APPLE_CALLBACK_URL, // redirect_uri
      passReqToCallback: false,
      scope: ['name', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: any,
    profile: Profile,
    done: Function,
  ): Promise<any> {
    // profile => contains user info (id, emails, etc.)
    const user = {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.name,
      accessToken,
    };

    done(null, user);
  }
}
