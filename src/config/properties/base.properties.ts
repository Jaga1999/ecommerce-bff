import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { InternalServerErrorException } from '@nestjs/common';

export abstract class BaseProperties {
  static validate<T extends object>(
    cls: ClassConstructor<T>,
    config: Record<string, unknown>,
  ): T {
    // Strip undefined values to allow class defaults to be used
    const cleanConfig = Object.fromEntries(
      Object.entries(config).filter(([, v]) => v !== undefined),
    );

    const validatedConfig = plainToInstance(cls, cleanConfig, {
      enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const message = this.formatErrors(errors);
      throw new InternalServerErrorException(
        `Config validation error in ${cls.name}: ${message}`,
      );
    }
    return validatedConfig;
  }

  private static formatErrors(errors: ValidationError[]): string {
    return errors
      .map((error) => {
        if (error.constraints) {
          const constraints = Object.values(error.constraints).join(', ');
          return `${error.property}: { expected: ${constraints}, actual: ${JSON.stringify(error.value)} }`;
        }
        if (error.children && error.children.length > 0) {
          return this.formatErrors(error.children);
        }
        return '';
      })
      .filter((msg) => msg !== '')
      .join('; ');
  }
}
