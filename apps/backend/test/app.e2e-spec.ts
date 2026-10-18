import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@vet-plan/shared';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

process.env.JWT_SECRET ??= 'e2e-test-secret';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const tokenFor = (role: Role) =>
    jwtService.sign({ sub: 'user-1', tenantId: 'tenant-1', role });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  it('GET /health is public', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /cases rejects requests without a token', () => {
    return request(app.getHttpServer()).get('/cases').expect(401);
  });

  it('GET /cases allows a permitted role', () => {
    return request(app.getHttpServer())
      .get('/cases')
      .set('Authorization', `Bearer ${tokenFor(Role.VETERINARIAN)}`)
      .expect(200)
      .expect([]);
  });

  it('GET /cases allows assistants', () => {
    return request(app.getHttpServer())
      .get('/cases')
      .set('Authorization', `Bearer ${tokenFor(Role.ASSISTANT)}`)
      .expect(200);
  });

  it('GET /cases forbids a role outside @Roles', () => {
    return request(app.getHttpServer())
      .get('/cases')
      .set('Authorization', `Bearer ${tokenFor(Role.SUPER_ADMIN)}`)
      .expect(403);
  });

  it('POST /cases forbids assistants', () => {
    return request(app.getHttpServer())
      .post('/cases')
      .set('Authorization', `Bearer ${tokenFor(Role.ASSISTANT)}`)
      .send({})
      .expect(403);
  });

  it('POST /cases reaches the handler for veterinarians', () => {
    return request(app.getHttpServer())
      .post('/cases')
      .set('Authorization', `Bearer ${tokenFor(Role.VETERINARIAN)}`)
      .send({})
      .expect(501);
  });

  afterEach(async () => {
    await app.close();
  });
});
