/**
 * Form Validation Utilities
 * Provides validation helpers for form inputs in UI components
 */

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validator function type
 */
export type Validator = (value: string) => ValidationResult;

/**
 * Field validation configuration
 */
export interface FieldConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: Validator;
}

/**
 * Built-in validators
 */
export const validators = {
  /**
   * Check if value is not empty
   */
  required: (message = 'This field is required'): Validator => {
    return (value: string): ValidationResult => {
      const isValid = value.trim().length > 0;
      return {
        valid: isValid,
        message: isValid ? undefined : message,
      };
    };
  },

  /**
   * Check minimum length
   */
  minLength: (min: number, message?: string): Validator => {
    return (value: string): ValidationResult => {
      const isValid = value.length >= min;
      return {
        valid: isValid,
        message: isValid ? undefined : message || `Minimum ${min} characters required`,
      };
    };
  },

  /**
   * Check maximum length
   */
  maxLength: (max: number, message?: string): Validator => {
    return (value: string): ValidationResult => {
      const isValid = value.length <= max;
      return {
        valid: isValid,
        message: isValid ? undefined : message || `Maximum ${max} characters allowed`,
      };
    };
  },

  /**
   * Check against a pattern
   */
  pattern: (regex: RegExp, message = 'Invalid format'): Validator => {
    return (value: string): ValidationResult => {
      // Empty values should pass pattern check (use required for empty check)
      if (value.length === 0) {
        return { valid: true };
      }
      const isValid = regex.test(value);
      return {
        valid: isValid,
        message: isValid ? undefined : message,
      };
    };
  },

  /**
   * Validate numeric value
   */
  numeric: (message = 'Must be a number'): Validator => {
    return (value: string): ValidationResult => {
      if (value.length === 0) {
        return { valid: true };
      }
      const isValid = !isNaN(Number(value)) && !isNaN(parseFloat(value));
      return {
        valid: isValid,
        message: isValid ? undefined : message,
      };
    };
  },

  /**
   * Validate integer value
   */
  integer: (message = 'Must be a whole number'): Validator => {
    return (value: string): ValidationResult => {
      if (value.length === 0) {
        return { valid: true };
      }
      const num = Number(value);
      const isValid = !isNaN(num) && Number.isInteger(num);
      return {
        valid: isValid,
        message: isValid ? undefined : message,
      };
    };
  },

  /**
   * Validate number in range
   */
  range: (min: number, max: number, message?: string): Validator => {
    return (value: string): ValidationResult => {
      if (value.length === 0) {
        return { valid: true };
      }
      const num = Number(value);
      const isValid = !isNaN(num) && num >= min && num <= max;
      return {
        valid: isValid,
        message: isValid ? undefined : message || `Value must be between ${min} and ${max}`,
      };
    };
  },

  /**
   * Validate URL format
   */
  url: (message = 'Invalid URL format'): Validator => {
    return (value: string): ValidationResult => {
      if (value.length === 0) {
        return { valid: true };
      }
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, message };
      }
    };
  },

  /**
   * Validate latitude value (-90 to 90)
   */
  latitude: (message = 'Latitude must be between -90 and 90'): Validator => {
    return (value: string): ValidationResult => {
      if (value.length === 0) {
        return { valid: true };
      }
      const num = Number(value);
      const isValid = !isNaN(num) && num >= -90 && num <= 90;
      return {
        valid: isValid,
        message: isValid ? undefined : message,
      };
    };
  },

  /**
   * Validate longitude value (-180 to 180)
   */
  longitude: (message = 'Longitude must be between -180 and 180'): Validator => {
    return (value: string): ValidationResult => {
      if (value.length === 0) {
        return { valid: true };
      }
      const num = Number(value);
      const isValid = !isNaN(num) && num >= -180 && num <= 180;
      return {
        valid: isValid,
        message: isValid ? undefined : message,
      };
    };
  },

  /**
   * Validate zoom level (0 to 22)
   */
  zoomLevel: (message = 'Zoom level must be between 0 and 22'): Validator => {
    return (value: string): ValidationResult => {
      if (value.length === 0) {
        return { valid: true };
      }
      const num = Number(value);
      const isValid = !isNaN(num) && num >= 0 && num <= 22;
      return {
        valid: isValid,
        message: isValid ? undefined : message,
      };
    };
  },
};

/**
 * Combine multiple validators
 */
export function composeValidators(...validatorList: Validator[]): Validator {
  return (value: string): ValidationResult => {
    for (const validator of validatorList) {
      const result = validator(value);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  };
}

/**
 * Create a field validator from configuration
 */
export function createFieldValidator(config: FieldConfig): Validator {
  const validatorList: Validator[] = [];

  if (config.required) {
    validatorList.push(validators.required());
  }

  if (config.minLength !== undefined) {
    validatorList.push(validators.minLength(config.minLength));
  }

  if (config.maxLength !== undefined) {
    validatorList.push(validators.maxLength(config.maxLength));
  }

  if (config.pattern) {
    validatorList.push(validators.pattern(config.pattern, config.patternMessage));
  }

  if (config.custom) {
    validatorList.push(config.custom);
  }

  return composeValidators(...validatorList);
}

/**
 * Form validation state manager
 */
export class FormValidator {
  private fields: Map<string, Validator> = new Map();
  private errors: Map<string, string> = new Map();
  private touched: Set<string> = new Set();

  /**
   * Register a field with its validator
   */
  public registerField(name: string, validator: Validator): void {
    this.fields.set(name, validator);
  }

  /**
   * Register a field with configuration
   */
  public registerFieldWithConfig(name: string, config: FieldConfig): void {
    this.fields.set(name, createFieldValidator(config));
  }

  /**
   * Unregister a field
   */
  public unregisterField(name: string): void {
    this.fields.delete(name);
    this.errors.delete(name);
    this.touched.delete(name);
  }

  /**
   * Validate a single field
   */
  public validateField(name: string, value: string): ValidationResult {
    const validator = this.fields.get(name);
    if (!validator) {
      return { valid: true };
    }

    const result = validator(value);
    this.touched.add(name);

    if (result.valid) {
      this.errors.delete(name);
    } else if (result.message) {
      this.errors.set(name, result.message);
    }

    return result;
  }

  /**
   * Validate all fields
   */
  public validateAll(values: Record<string, string>): boolean {
    let allValid = true;

    for (const [name, validator] of this.fields) {
      const value = values[name] || '';
      const result = validator(value);
      this.touched.add(name);

      if (!result.valid) {
        allValid = false;
        if (result.message) {
          this.errors.set(name, result.message);
        }
      } else {
        this.errors.delete(name);
      }
    }

    return allValid;
  }

  /**
   * Check if form is valid
   */
  public isValid(): boolean {
    return this.errors.size === 0;
  }

  /**
   * Get error for a field
   */
  public getError(name: string): string | undefined {
    return this.errors.get(name);
  }

  /**
   * Get all errors
   */
  public getErrors(): Record<string, string> {
    return Object.fromEntries(this.errors);
  }

  /**
   * Check if field has been touched
   */
  public isTouched(name: string): boolean {
    return this.touched.has(name);
  }

  /**
   * Mark field as touched
   */
  public touch(name: string): void {
    this.touched.add(name);
  }

  /**
   * Reset validation state
   */
  public reset(): void {
    this.errors.clear();
    this.touched.clear();
  }

  /**
   * Clear errors only
   */
  public clearErrors(): void {
    this.errors.clear();
  }
}

/**
 * Apply validation styling to an input element
 */
export function applyValidationStyle(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  valid: boolean
): void {
  if (valid) {
    element.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    element.classList.add('border-gray-300', 'focus:ring-blue-500', 'focus:border-blue-500');
    element.setAttribute('aria-invalid', 'false');
  } else {
    element.classList.remove('border-gray-300', 'focus:ring-blue-500', 'focus:border-blue-500');
    element.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
    element.setAttribute('aria-invalid', 'true');
  }
}

/**
 * Create error message element
 */
export function createErrorMessage(message: string, id?: string): HTMLElement {
  const error = document.createElement('p');
  error.className = 'mt-1 text-sm text-red-600 dark:text-red-400';
  error.textContent = message;
  error.setAttribute('role', 'alert');
  if (id) {
    error.id = id;
  }
  return error;
}

/**
 * Show validation error for an input
 */
export function showFieldError(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  message: string
): HTMLElement {
  const errorId = `${input.id || input.name}-error`;

  // Remove existing error
  hideFieldError(input);

  // Apply invalid styling
  applyValidationStyle(input, false);

  // Create and insert error message
  const error = createErrorMessage(message, errorId);
  input.setAttribute('aria-describedby', errorId);
  input.parentElement?.appendChild(error);

  return error;
}

/**
 * Hide validation error for an input
 */
export function hideFieldError(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): void {
  const errorId = input.getAttribute('aria-describedby');
  if (errorId) {
    const error = document.getElementById(errorId);
    error?.remove();
    input.removeAttribute('aria-describedby');
  }

  applyValidationStyle(input, true);
}

/**
 * Create validated input with automatic validation
 */
export function createValidatedInput(options: {
  type?: string;
  name: string;
  placeholder?: string;
  validator: Validator;
  validateOnBlur?: boolean;
  validateOnInput?: boolean;
  onValidate?: (result: ValidationResult) => void;
}): HTMLInputElement {
  const {
    type = 'text',
    name,
    placeholder,
    validator,
    validateOnBlur = true,
    validateOnInput = false,
    onValidate,
  } = options;

  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.id = name;
  if (placeholder) {
    input.placeholder = placeholder;
  }
  input.className = `
    w-full px-3 py-2 rounded-lg border border-gray-300
    dark:border-gray-600 dark:bg-gray-700 dark:text-white
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    transition-colors
  `
    .replace(/\s+/g, ' ')
    .trim();

  const validate = (): void => {
    const result = validator(input.value);
    if (result.valid) {
      hideFieldError(input);
    } else if (result.message) {
      showFieldError(input, result.message);
    }
    onValidate?.(result);
  };

  if (validateOnBlur) {
    input.addEventListener('blur', validate);
  }

  if (validateOnInput) {
    input.addEventListener('input', validate);
  }

  return input;
}
