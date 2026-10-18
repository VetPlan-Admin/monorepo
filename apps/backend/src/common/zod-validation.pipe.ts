import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { ValidationErrorResponse } from '@vet-plan/shared';
import type { output, ZodType } from 'zod';

/**
 * Validates and normalizes a body or query with a schema from @vet-plan/shared, so the API and
 * the clients enforce the same rules. Responds 400 with every issue and its path.
 */
@Injectable()
export class ZodValidationPipe<Schema extends ZodType> implements PipeTransform<unknown, output<Schema>> {
    constructor(private readonly schema: Schema) { }

    transform(value: unknown): output<Schema> {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            const response: ValidationErrorResponse = {
                message: 'Validation failed',
                errors: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
            };
            throw new BadRequestException(response);
        }
        return result.data;
    }
}
