import { CaseStatus, MeasurementType, OAuthProvider, ProcedureType, Role, Species } from '@vet-plan/shared';
import type { CaseDetailDto, Paginated, CaseSummaryDto, PatientDto, RadiographPlanDto, SurgicalPlanReportDto } from '@vet-plan/shared';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { User } from '../src/modules/users/user.entity.js';
import { UsersService } from '../src/modules/users/users.service.js';
import { createTestApp } from './utils/test-app.js';
import type { TestContext } from './utils/test-app.js';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

describe('Patients & cases (e2e)', () => {
    let ctx: TestContext;
    let tokens: Record<'adminA' | 'vetA' | 'assistantA' | 'adminB' | 'superAdmin', string>;

    const call = (who: keyof typeof tokens, method: Method, url: string, body?: object) => {
        const req = request(ctx.app.getHttpServer())[method](url).set('Authorization', `Bearer ${tokens[who]}`);
        return body ? req.send(body) : req;
    };

    beforeAll(async () => {
        ctx = await createTestApp();
        const usersService = ctx.app.get(UsersService);
        const auth = ctx.app.get(AuthService);
        const users = ctx.dataSource.getRepository(User);
        const signUp = (email: string, providerUserId: string) =>
            usersService.findOrCreateFromOAuth({ provider: OAuthProvider.GOOGLE, providerUserId, email, emailVerified: true, displayName: email.split('@')[0]!, avatarUrl: null });

        const adminA = await signUp('admin@clinic-a.test', 'a-admin');
        const adminB = await signUp('admin@clinic-b.test', 'b-admin');
        const staff = (email: string, role: Role, tenantId: string | null) =>
            users.save(users.create({ email, displayName: email.split('@')[0]!, role, tenantId, avatarUrl: null, lastLoginAt: null }));
        const vetA = await staff('vet@clinic-a.test', Role.VETERINARIAN, adminA.tenantId);
        const assistantA = await staff('assistant@clinic-a.test', Role.ASSISTANT, adminA.tenantId);
        const superAdmin = await staff('root@vetplan.test', Role.SUPER_ADMIN, null);

        const token = (user: User) => auth.issueAccessToken(user).accessToken;
        tokens = { adminA: token(adminA), vetA: token(vetA), assistantA: token(assistantA), adminB: token(adminB), superAdmin: token(superAdmin) };
    });

    afterAll(async () => {
        await ctx.close();
    });

    async function createPatient(name: string, extra: object = {}): Promise<PatientDto> {
        const res = await call('assistantA', 'post', '/patients', { name, species: Species.CANINE, ...extra }).expect(201);
        return res.body as PatientDto;
    }

    async function createCase(patientId: string, procedureType = ProcedureType.TPLO): Promise<CaseDetailDto> {
        const res = await call('vetA', 'post', '/cases', { patientId, procedureType, limb: 'LEFT' }).expect(201);
        return res.body as CaseDetailDto;
    }

    describe('patients', () => {
        it('lets assistants register patients and validates input', async () => {
            const patient = await createPatient('  Thor ', { breed: 'Labrador', weightKg: 34.2, ownerName: 'Ana Souza', externalId: 'R-1001', dateOfBirth: '2019-04-02' });
            expect(patient).toMatchObject({ name: 'Thor', breed: 'Labrador', weightKg: 34.2, dateOfBirth: '2019-04-02', sex: null });

            const invalid = await call('assistantA', 'post', '/patients', { species: 'DRAGON' }).expect(400);
            expect(invalid.body.message).toBe('Validation failed');
            expect(invalid.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(['name', 'species']);
        });

        it('searches by patient, owner or record number with pagination, scoped to the clinic', async () => {
            await createPatient('Luna', { species: Species.FELINE, ownerName: 'Bruno Lima' });
            await createPatient('Mel', { externalId: 'R-2002' });

            const byOwner = await call('vetA', 'get', '/patients?search=bruno').expect(200);
            expect((byOwner.body as Paginated<PatientDto>).items.map((p) => p.name)).toEqual(['Luna']);
            const byRecord = await call('vetA', 'get', '/patients?search=r-2002').expect(200);
            expect(byRecord.body.items.map((p: PatientDto) => p.name)).toEqual(['Mel']);
            const felines = await call('vetA', 'get', '/patients?species=FELINE').expect(200);
            expect(felines.body.total).toBe(1);
            const page = await call('vetA', 'get', '/patients?page=2&pageSize=2').expect(200);
            expect(page.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
            expect(page.body.items).toHaveLength(1);
            // LIKE wildcards are literal
            expect((await call('vetA', 'get', '/patients?search=%25').expect(200)).body.total).toBe(0);

            expect((await call('adminB', 'get', '/patients').expect(200)).body.total).toBe(0);
        });

        it('hides other clinics’ patients and updates partially', async () => {
            const patient = await createPatient('Bolt');
            await call('adminB', 'get', `/patients/${patient.id}`).expect(404);
            await call('adminB', 'patch', `/patients/${patient.id}`, { name: 'Stolen' }).expect(404);
            const updated = await call('vetA', 'patch', `/patients/${patient.id}`, { weightKg: 20, breed: null }).expect(200);
            expect(updated.body).toMatchObject({ name: 'Bolt', weightKg: 20, breed: null });
            await call('vetA', 'get', '/patients/not-a-uuid').expect(400);
        });

        it('keeps SUPER_ADMIN out of clinical data', async () => {
            await call('superAdmin', 'get', '/patients').expect(403);
            await call('superAdmin', 'get', '/cases').expect(403);
        });
    });

    describe('cases', () => {
        let patient: PatientDto;

        beforeAll(async () => {
            patient = await createPatient('Duke', { ownerName: 'Carla Dias' });
        });

        it('only planners create cases, for their own clinic’s patients', async () => {
            await call('assistantA', 'post', '/cases', { patientId: patient.id, procedureType: 'TPLO' }).expect(403);
            const otherClinicPatient = (await call('adminB', 'post', '/patients', { name: 'Ghost', species: 'CANINE' }).expect(201)).body as PatientDto;
            const crossTenant = await call('vetA', 'post', '/cases', { patientId: otherClinicPatient.id, procedureType: 'TPLO' }).expect(404);
            expect(crossTenant.body.message).toBe('Patient not found');

            const created = await createCase(patient.id);
            expect(created).toMatchObject({
                status: CaseStatus.PLANNING,
                procedureType: 'TPLO',
                limb: 'LEFT',
                patient: { id: patient.id, name: 'Duke' },
                createdBy: { displayName: 'vet' },
                plans: [],
                allowedTransitions: [CaseStatus.PLANNED, CaseStatus.CANCELLED],
            });
            await call('adminB', 'get', `/cases/${created.id}`).expect(404);
        });

        it('lists with filters, search and plan counts', async () => {
            await createCase(patient.id, ProcedureType.TTA);
            const all = (await call('assistantA', 'get', '/cases?search=carla').expect(200)).body as Paginated<CaseSummaryDto>;
            expect(all.total).toBeGreaterThanOrEqual(2);
            expect(all.items.every((c) => c.patient.ownerName === 'Carla Dias' && c.planCount === 0)).toBe(true);
            const tta = (await call('assistantA', 'get', '/cases?procedureType=TTA').expect(200)).body as Paginated<CaseSummaryDto>;
            expect(tta.items.map((c) => c.procedureType)).toEqual(['TTA']);
            await call('assistantA', 'get', '/cases?status=DONE').expect(400);
        });

        it('enforces the status workflow', async () => {
            const { id } = await createCase(patient.id);
            const invalid = await call('vetA', 'patch', `/cases/${id}`, { status: 'COMPLETED' }).expect(409);
            expect(invalid.body.message).toBe("A planning case can't become completed");

            await call('vetA', 'patch', `/cases/${id}`, { status: 'PLANNED', surgeryDate: '2026-11-03' }).expect(200);
            const completed = (await call('vetA', 'patch', `/cases/${id}`, { status: 'COMPLETED' }).expect(200)).body as CaseDetailDto;
            expect(completed).toMatchObject({ status: 'COMPLETED', surgeryDate: '2026-11-03', allowedTransitions: [] });

            await call('vetA', 'patch', `/cases/${id}`, { procedureType: 'TTA' }).expect(409);
            await call('vetA', 'patch', `/cases/${id}`, { notes: 'Recovered well' }).expect(200);
            await call('vetA', 'patch', `/cases/${id}`, { status: 'PLANNING' }).expect(409);
            await call('vetA', 'patch', `/cases/${id}`, {}).expect(400);
        });
    });

    describe('plans & report', () => {
        // 800×600 image, y down. Marker: r = 50 px for a 25 mm ball → 0.25 mm/px. TPA built at 20°.
        const rad = (20 * Math.PI) / 180;
        const plan = {
            label: 'Left stifle, mediolateral',
            imageWidth: 800,
            imageHeight: 600,
            imageSpacing: { mmPerPixel: 0.2, source: 'PixelSpacing' },
            measurements: [
                { id: 'cal', type: MeasurementType.CALIBRATION_MARKER, points: { markerOutline: [{ x: 700, y: 120 }, { x: 600, y: 120 }, { x: 650, y: 70 }] }, parameters: { markerDiameterMm: 25 } },
                {
                    id: 'tpa',
                    type: MeasurementType.TIBIAL_PLATEAU_ANGLE,
                    points: {
                        plateauCaudal: [{ x: 260, y: 160 }],
                        plateauCranial: [{ x: 260 + 80 * Math.cos(rad), y: 160 - 80 * Math.sin(rad) }],
                        intercondylarEminence: [{ x: 300, y: 150 }],
                        talusCenter: [{ x: 300, y: 550 }],
                    },
                    parameters: { targetPlateauAngle: 5, sawBladeRadiusMm: 24 },
                },
                { id: 'len', type: MeasurementType.DISTANCE, points: { start: [{ x: 100, y: 400 }], end: [{ x: 200, y: 400 }] }, parameters: {} },
            ],
            // A client can't inject results: unknown keys are stripped and values recomputed
            results: [{ id: 'tpa', values: [{ key: 'tpa', value: 99 }] }],
        };
        let caseId: string;
        let planId: string;

        beforeAll(async () => {
            const patient = await createPatient('Nina');
            caseId = (await createCase(patient.id)).id;
        });

        it('recomputes results on the server when a plan is saved', async () => {
            const saved = (await call('vetA', 'post', `/cases/${caseId}/plans`, plan).expect(201)).body as RadiographPlanDto;
            planId = saved.id;
            expect(saved.calibration).toEqual({ mmPerPixel: expect.closeTo(0.25, 9), source: 'Calibration (marker ball)' });
            const value = (id: string, key: string) => saved.results.find((r) => r.id === id)!.values.find((v) => v.key === key)!.value;
            expect(value('tpa', 'tpa')).toBeCloseTo(20, 9);
            expect(value('tpa', 'rotation')).toBeCloseTo(15, 9);
            expect(value('len', 'distance')).toBeCloseTo(25, 9);
            expect(saved.createdBy?.displayName).toBe('vet');

            const detail = (await call('assistantA', 'get', `/cases/${caseId}`).expect(200)).body as CaseDetailDto;
            expect(detail.plans.map((p) => p.id)).toEqual([planId]);
            expect((await call('assistantA', 'get', '/cases?search=nina').expect(200)).body.items[0].planCount).toBe(1);
        });

        it('rejects landmarks outside the image and assistants editing plans', async () => {
            const outside = { ...plan, measurements: [{ ...plan.measurements[2], points: { start: [{ x: 900, y: 1 }] } }] };
            await call('vetA', 'post', `/cases/${caseId}/plans`, outside).expect(400);
            await call('assistantA', 'post', `/cases/${caseId}/plans`, plan).expect(403);
        });

        it('updates a plan with fresh results', async () => {
            const withoutMarker = { ...plan, label: 'Re-measured', measurements: plan.measurements.slice(1) };
            const updated = (await call('vetA', 'put', `/cases/${caseId}/plans/${planId}`, withoutMarker).expect(200)).body as RadiographPlanDto;
            expect(updated.label).toBe('Re-measured');
            expect(updated.calibration).toEqual({ mmPerPixel: 0.2, source: 'DICOM PixelSpacing' });
            expect(updated.results.find((r) => r.id === 'len')!.values[0]!.value).toBeCloseTo(20, 9);
        });

        it('exports a JSON report any clinic member can download', async () => {
            const res = await call('assistantA', 'get', `/cases/${caseId}/report`).expect(200);
            expect(res.headers['content-type']).toContain('application/json');
            expect(res.headers['content-disposition']).toBe(`attachment; filename="vet-plan-case-${caseId.slice(0, 8)}-report.json"`);
            const report = res.body as SurgicalPlanReportDto;
            expect(report).toMatchObject({
                format: 'vet-plan.surgical-plan-report',
                version: 1,
                generatedBy: { displayName: 'assistant' },
                clinic: { name: "admin's Clinic" },
                patient: { name: 'Nina' },
                case: { id: caseId, status: 'PLANNING' },
            });
            const tpa = report.plans[0]!.measurements.find((m) => m.id === 'tpa')!;
            expect(tpa).toMatchObject({ name: 'Tibial plateau angle (TPLO)', status: 'complete', parameters: { sawBladeRadiusMm: 24 } });
            expect(tpa.values.map((v) => v.formatted)).toEqual(['20.0°', '15.0°', '6.3 mm']);
            expect(report.disclaimer).toContain('Decision support only');
            await call('adminB', 'get', `/cases/${caseId}/report`).expect(404);
        });

        it('freezes plans once the case is completed', async () => {
            await call('vetA', 'patch', `/cases/${caseId}`, { status: 'PLANNED' }).expect(200);
            await call('vetA', 'patch', `/cases/${caseId}`, { status: 'COMPLETED' }).expect(200);
            const frozen = await call('vetA', 'put', `/cases/${caseId}/plans/${planId}`, plan).expect(409);
            expect(frozen.body.message).toBe("Plans of a completed case can't change");
            await call('vetA', 'delete', `/cases/${caseId}/plans/${planId}`).expect(409);
        });

        it('deletes plans, cases and patients with the right roles and order', async () => {
            const patient = await createPatient('Toby');
            const { id } = await createCase(patient.id);
            const saved = (await call('vetA', 'post', `/cases/${id}/plans`, plan).expect(201)).body as RadiographPlanDto;
            await call('vetA', 'delete', `/cases/${id}/plans/${saved.id}`).expect(204);
            await call('vetA', 'delete', `/cases/${id}/plans/${saved.id}`).expect(404);

            await call('vetA', 'delete', `/patients/${patient.id}`).expect(403);
            const blocked = await call('adminA', 'delete', `/patients/${patient.id}`).expect(409);
            expect(blocked.body.message).toContain('has surgical cases');
            await call('vetA', 'delete', `/cases/${id}`).expect(403);
            await call('adminA', 'delete', `/cases/${id}`).expect(204);
            await call('adminA', 'delete', `/patients/${patient.id}`).expect(204);
            await call('adminA', 'get', `/patients/${patient.id}`).expect(404);
        });
    });
});
