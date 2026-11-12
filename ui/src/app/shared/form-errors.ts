import { AbstractControl, FormGroup, type ValidatorFn } from '@angular/forms';
import { ApiError } from '../api/api-error';

export const NAME_MAX = 200;
export const TEXT_MAX = 100;
export const REASON_MAX = 500;

/** The contract's text rule: trimmed, then required and/or at most `max` characters. */
export function trimmedText(max: number, options: { required?: boolean } = {}): ValidatorFn {
  const { required = true } = options;
  return (control: AbstractControl) => {
    const length = String(control.value ?? '').trim().length;
    if (length === 0) {
      return required ? { required: true } : null;
    }
    return length > max ? { tooLong: { max, actual: length } } : null;
  };
}

/** The message to show under a field, or null while it is valid. Server messages win. */
export function fieldErrorText(control: AbstractControl, label: string): string | null {
  const errors = control.errors;
  if (!errors) {
    return null;
  }
  if (typeof errors['server'] === 'string') {
    return errors['server'];
  }
  if (errors['required']) {
    return `${label} is required.`;
  }
  if (errors['tooLong']) {
    return `${label} must be at most ${errors['tooLong'].max} characters.`;
  }
  if (typeof errors['custom'] === 'string') {
    return errors['custom'];
  }
  return `${label} is not valid.`;
}

/** Re-runs the client rules on every control, which also clears the server errors of the previous attempt. */
export function revalidate(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    control.updateValueAndValidity({ emitEvent: false });
  }
  form.updateValueAndValidity({ emitEvent: false });
}

const SERVER_ACTOR_MESSAGE =
  'Your "Acting as" name is missing or not accepted. Set it in the toolbar, then try again.';

export interface ServerErrorOptions {
  /** API field name (case-insensitive) -> the control that shows it. */
  fields: Record<string, AbstractControl>;
  /** Where a 409 conflict is shown (the API sends no field for it). */
  conflict?: AbstractControl;
}

/**
 * Maps a failed write onto the form: `errors[]` entries land on their field, a 409 on `conflict`.
 * Returns the message for the form-level alert (anything that has no field), or null when every error has one.
 */
export function applyServerError(error: unknown, options: ServerErrorOptions): string | null {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Try again.';
  }
  const fields = new Map(
    Object.entries(options.fields).map(([name, control]) => [name.toLowerCase(), control]),
  );
  const show = (control: AbstractControl, message: string) => {
    control.setErrors({ server: message });
    control.markAsTouched();
  };

  if (error.status === 409 && options.conflict) {
    show(options.conflict, error.message);
    return null;
  }
  if (error.errors.length === 0) {
    return error.message;
  }
  const leftover: string[] = [];
  for (const { field, message } of error.errors) {
    const control = fields.get(field.toLowerCase());
    if (control) {
      show(control, message);
    } else if (field.toLowerCase() === 'x-actor') {
      leftover.push(SERVER_ACTOR_MESSAGE);
    } else {
      leftover.push(message);
    }
  }
  return leftover.length > 0 ? [...new Set(leftover)].join(' ') : null;
}

/** Moves focus to the first invalid field of a form. */
export function focusFirstInvalid(root: HTMLElement): void {
  root
    .querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, select.ng-invalid')
    ?.focus();
}
