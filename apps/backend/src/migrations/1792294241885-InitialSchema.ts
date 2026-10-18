import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792294241885 implements MigrationInterface {
    name = 'InitialSchema1792294241885'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'CLINIC_ADMIN', 'VETERINARIAN', 'ASSISTANT')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(320) NOT NULL, "display_name" character varying(200) NOT NULL, "avatar_url" text, "role" "public"."user_role" NOT NULL, "tenant_id" uuid, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users"  ("email") `);
        await queryRunner.query(`CREATE INDEX "idx_users_tenant_id" ON "users"  ("tenant_id") `);
        await queryRunner.query(`CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'linkedin', 'facebook')`);
        await queryRunner.query(`CREATE TABLE "oauth_accounts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "provider" "public"."oauth_provider" NOT NULL, "provider_user_id" character varying(255) NOT NULL, "user_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_oauth_accounts_provider_user" UNIQUE ("provider", "provider_user_id"), CONSTRAINT "PK_710a81523f515b78f894e33bb10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_oauth_accounts_user_id" ON "oauth_accounts"  ("user_id") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oauth_accounts" ADD CONSTRAINT "FK_22a05e92f51a983475f9281d3b0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "oauth_accounts" DROP CONSTRAINT "FK_22a05e92f51a983475f9281d3b0"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_109638590074998bb72a2f2cf08"`);
        await queryRunner.query(`DROP INDEX "public"."idx_oauth_accounts_user_id"`);
        await queryRunner.query(`DROP TABLE "oauth_accounts"`);
        await queryRunner.query(`DROP TYPE "public"."oauth_provider"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
    }

}
