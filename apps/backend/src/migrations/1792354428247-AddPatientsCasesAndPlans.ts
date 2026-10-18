import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPatientsCasesAndPlans1792354428247 implements MigrationInterface {
    name = 'AddPatientsCasesAndPlans1792354428247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."species" AS ENUM('CANINE', 'FELINE')`);
        await queryRunner.query(`CREATE TYPE "public"."patient_sex" AS ENUM('MALE', 'MALE_NEUTERED', 'FEMALE', 'FEMALE_SPAYED')`);
        await queryRunner.query(`CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "species" "public"."species" NOT NULL, "breed" character varying(120), "sex" "public"."patient_sex", "date_of_birth" date, "weight_kg" double precision, "owner_name" character varying(160), "external_id" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_patients_tenant_id" ON "patients"  ("tenant_id") `);
        await queryRunner.query(`CREATE TYPE "public"."procedure_type" AS ENUM('TPLO', 'TTA', 'HIP_ASSESSMENT', 'OTHER')`);
        await queryRunner.query(`CREATE TYPE "public"."limb" AS ENUM('LEFT', 'RIGHT', 'BILATERAL')`);
        await queryRunner.query(`CREATE TYPE "public"."case_status" AS ENUM('PLANNING', 'PLANNED', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "surgical_cases" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "tenant_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "procedure_type" "public"."procedure_type" NOT NULL, "limb" "public"."limb", "status" "public"."case_status" NOT NULL DEFAULT 'PLANNING', "surgery_date" date, "notes" text, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_570744922c7c6026307e9769c71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_surgical_cases_patient_id" ON "surgical_cases"  ("patient_id") `);
        await queryRunner.query(`CREATE INDEX "idx_surgical_cases_tenant_status" ON "surgical_cases"  ("tenant_id", "status") `);
        await queryRunner.query(`CREATE TABLE "radiograph_plans" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "case_id" uuid NOT NULL, "label" character varying(120) NOT NULL, "image_width" integer NOT NULL, "image_height" integer NOT NULL, "image_spacing" jsonb, "calibration" jsonb, "measurements" jsonb NOT NULL, "results" jsonb NOT NULL, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2a29b6750adbdb8ec1489755080" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_radiograph_plans_case_id" ON "radiograph_plans"  ("case_id") `);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_21b4c71c7ab2d8ac04be7691a42" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "surgical_cases" ADD CONSTRAINT "FK_417b8ced44b05509756a29f2107" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "surgical_cases" ADD CONSTRAINT "FK_630fcbc05fc8c340a1902283f35" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "surgical_cases" ADD CONSTRAINT "FK_118e9c8415027fc5be62ef41441" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "radiograph_plans" ADD CONSTRAINT "FK_1c6264545f0850cd46aca1b859f" FOREIGN KEY ("case_id") REFERENCES "surgical_cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "radiograph_plans" ADD CONSTRAINT "FK_a1e45d3c2fa03b916d750a0a0d9" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "radiograph_plans" DROP CONSTRAINT "FK_a1e45d3c2fa03b916d750a0a0d9"`);
        await queryRunner.query(`ALTER TABLE "radiograph_plans" DROP CONSTRAINT "FK_1c6264545f0850cd46aca1b859f"`);
        await queryRunner.query(`ALTER TABLE "surgical_cases" DROP CONSTRAINT "FK_118e9c8415027fc5be62ef41441"`);
        await queryRunner.query(`ALTER TABLE "surgical_cases" DROP CONSTRAINT "FK_630fcbc05fc8c340a1902283f35"`);
        await queryRunner.query(`ALTER TABLE "surgical_cases" DROP CONSTRAINT "FK_417b8ced44b05509756a29f2107"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_21b4c71c7ab2d8ac04be7691a42"`);
        await queryRunner.query(`DROP INDEX "public"."idx_radiograph_plans_case_id"`);
        await queryRunner.query(`DROP TABLE "radiograph_plans"`);
        await queryRunner.query(`DROP INDEX "public"."idx_surgical_cases_tenant_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_surgical_cases_patient_id"`);
        await queryRunner.query(`DROP TABLE "surgical_cases"`);
        await queryRunner.query(`DROP TYPE "public"."case_status"`);
        await queryRunner.query(`DROP TYPE "public"."limb"`);
        await queryRunner.query(`DROP TYPE "public"."procedure_type"`);
        await queryRunner.query(`DROP INDEX "public"."idx_patients_tenant_id"`);
        await queryRunner.query(`DROP TABLE "patients"`);
        await queryRunner.query(`DROP TYPE "public"."patient_sex"`);
        await queryRunner.query(`DROP TYPE "public"."species"`);
    }

}
