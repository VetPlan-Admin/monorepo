import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller.js';

@Module({
  controllers: [CasesController],
})
export class CasesModule { }
