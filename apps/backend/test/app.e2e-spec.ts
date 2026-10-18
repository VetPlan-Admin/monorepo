import { Role } from '@vet-plan/shared';
import request from 'supertest';
import { createTestApp } from './utils/test-app.js';
import type { TestContext } from './utils/test-app.js';

describe('App (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /health is public', () => {
    return request(ctx.app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('allows CORS from APP_URL only', async () => {
    const allowed = await request(ctx.app.getHttpServer()).get('/health').set('Origin', 'http://app.test');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://app.test');

    const blocked = await request(ctx.app.getHttpServer()).get('/health').set('Origin', 'http://evil.test');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('GET /cases rejects requests without a token', () => {
    return request(ctx.app.getHttpServer()).get('/cases').expect(401);
  });

  it('GET /cases allows a permitted role', () => {
    return request(ctx.app.getHttpServer())
      .get('/cases')
      .set('Authorization', `Bearer ${ctx.accessTokenFor(Role.VETERINARIAN)}`)
      .expect(200)
      .expect([]);
  });

  it('GET /cases allows assistants', () => {
    return request(ctx.app.getHttpServer())
      .get('/cases')
      .set('Authorization', `Bearer ${ctx.accessTokenFor(Role.ASSISTANT)}`)
      .expect(200);
  });

  it('GET /cases forbids a role outside @Roles', () => {
    return request(ctx.app.getHttpServer())
      .get('/cases')
      .set('Authorization', `Bearer ${ctx.accessTokenFor(Role.SUPER_ADMIN)}`)
      .expect(403);
  });

  it('POST /cases forbids assistants', () => {
    return request(ctx.app.getHttpServer())
      .post('/cases')
      .set('Authorization', `Bearer ${ctx.accessTokenFor(Role.ASSISTANT)}`)
      .send({})
      .expect(403);
  });

  it('POST /cases reaches the handler for veterinarians', () => {
    return request(ctx.app.getHttpServer())
      .post('/cases')
      .set('Authorization', `Bearer ${ctx.accessTokenFor(Role.VETERINARIAN)}`)
      .send({})
      .expect(501);
  });
});
