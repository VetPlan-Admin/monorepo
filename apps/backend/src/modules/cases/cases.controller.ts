import { Controller, Get, Post, Body, NotImplementedException } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '@vet-plan/shared';
import type { CreateCaseDto } from '@vet-plan/shared';

@Controller('cases')
export class CasesController {

    @Get()
    @Roles(Role.ASSISTANT, Role.VETERINARIAN, Role.CLINIC_ADMIN)
    findAllCases() {
        return [];
    }

    @Post()
    @Roles(Role.VETERINARIAN, Role.CLINIC_ADMIN)
    createCase(@Body() _createDto: CreateCaseDto): never {
        // Persistence arrives with the Case entity (ROADMAP Phase 5)
        throw new NotImplementedException('Case creation is not implemented yet');
    }
}
