import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Validates that this date string is strictly after the date string in the
 * sibling field `property`. Unparseable dates fail.
 */
export function IsAfter(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be after ${property}`, ...validationOptions },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const related: unknown = Reflect.get(args.object, property);
          if (typeof value !== 'string' || typeof related !== 'string') return false;
          return Date.parse(value) > Date.parse(related);
        },
      },
    });
  };
}
