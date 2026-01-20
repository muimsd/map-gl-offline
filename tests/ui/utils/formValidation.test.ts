/**
 * Tests for Form Validation Utilities
 */

import {
  validators,
  composeValidators,
  createFieldValidator,
  FormValidator,
  applyValidationStyle,
  createErrorMessage,
  showFieldError,
  hideFieldError,
  createValidatedInput,
} from '../../../src/ui/utils/formValidation';

describe('Form Validation Utilities', () => {
  describe('validators', () => {
    describe('required', () => {
      it('should fail for empty string', () => {
        const result = validators.required()('');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('This field is required');
      });

      it('should fail for whitespace only', () => {
        const result = validators.required()('   ');
        expect(result.valid).toBe(false);
      });

      it('should pass for non-empty string', () => {
        const result = validators.required()('hello');
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
      });

      it('should use custom message', () => {
        const result = validators.required('Name is required')('');
        expect(result.message).toBe('Name is required');
      });
    });

    describe('minLength', () => {
      it('should fail for short string', () => {
        const result = validators.minLength(5)('abc');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Minimum 5 characters required');
      });

      it('should pass for exact length', () => {
        const result = validators.minLength(5)('abcde');
        expect(result.valid).toBe(true);
      });

      it('should pass for longer string', () => {
        const result = validators.minLength(5)('abcdefgh');
        expect(result.valid).toBe(true);
      });

      it('should use custom message', () => {
        const result = validators.minLength(5, 'Too short!')('abc');
        expect(result.message).toBe('Too short!');
      });
    });

    describe('maxLength', () => {
      it('should fail for long string', () => {
        const result = validators.maxLength(5)('abcdefgh');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Maximum 5 characters allowed');
      });

      it('should pass for exact length', () => {
        const result = validators.maxLength(5)('abcde');
        expect(result.valid).toBe(true);
      });

      it('should pass for shorter string', () => {
        const result = validators.maxLength(5)('abc');
        expect(result.valid).toBe(true);
      });

      it('should use custom message', () => {
        const result = validators.maxLength(5, 'Too long!')('abcdefgh');
        expect(result.message).toBe('Too long!');
      });
    });

    describe('pattern', () => {
      const alphaOnly = /^[a-zA-Z]+$/;

      it('should fail for non-matching string', () => {
        const result = validators.pattern(alphaOnly)('abc123');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Invalid format');
      });

      it('should pass for matching string', () => {
        const result = validators.pattern(alphaOnly)('abcABC');
        expect(result.valid).toBe(true);
      });

      it('should pass for empty string', () => {
        const result = validators.pattern(alphaOnly)('');
        expect(result.valid).toBe(true);
      });

      it('should use custom message', () => {
        const result = validators.pattern(alphaOnly, 'Letters only!')('123');
        expect(result.message).toBe('Letters only!');
      });
    });

    describe('numeric', () => {
      it('should pass for integer', () => {
        const result = validators.numeric()('42');
        expect(result.valid).toBe(true);
      });

      it('should pass for decimal', () => {
        const result = validators.numeric()('3.14');
        expect(result.valid).toBe(true);
      });

      it('should pass for negative', () => {
        const result = validators.numeric()('-42');
        expect(result.valid).toBe(true);
      });

      it('should fail for non-numeric', () => {
        const result = validators.numeric()('abc');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Must be a number');
      });

      it('should pass for empty string', () => {
        const result = validators.numeric()('');
        expect(result.valid).toBe(true);
      });
    });

    describe('integer', () => {
      it('should pass for integer', () => {
        const result = validators.integer()('42');
        expect(result.valid).toBe(true);
      });

      it('should fail for decimal', () => {
        const result = validators.integer()('3.14');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Must be a whole number');
      });

      it('should pass for negative integer', () => {
        const result = validators.integer()('-42');
        expect(result.valid).toBe(true);
      });

      it('should pass for empty string', () => {
        const result = validators.integer()('');
        expect(result.valid).toBe(true);
      });
    });

    describe('range', () => {
      it('should pass for value in range', () => {
        const result = validators.range(1, 10)('5');
        expect(result.valid).toBe(true);
      });

      it('should pass for min value', () => {
        const result = validators.range(1, 10)('1');
        expect(result.valid).toBe(true);
      });

      it('should pass for max value', () => {
        const result = validators.range(1, 10)('10');
        expect(result.valid).toBe(true);
      });

      it('should fail for value below range', () => {
        const result = validators.range(1, 10)('0');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Value must be between 1 and 10');
      });

      it('should fail for value above range', () => {
        const result = validators.range(1, 10)('11');
        expect(result.valid).toBe(false);
      });

      it('should pass for empty string', () => {
        const result = validators.range(1, 10)('');
        expect(result.valid).toBe(true);
      });
    });

    describe('url', () => {
      it('should pass for valid http url', () => {
        const result = validators.url()('http://example.com');
        expect(result.valid).toBe(true);
      });

      it('should pass for valid https url', () => {
        const result = validators.url()('https://example.com/path?query=1');
        expect(result.valid).toBe(true);
      });

      it('should fail for invalid url', () => {
        const result = validators.url()('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Invalid URL format');
      });

      it('should pass for empty string', () => {
        const result = validators.url()('');
        expect(result.valid).toBe(true);
      });
    });

    describe('latitude', () => {
      it('should pass for valid latitude', () => {
        const result = validators.latitude()('45.5');
        expect(result.valid).toBe(true);
      });

      it('should pass for -90', () => {
        const result = validators.latitude()('-90');
        expect(result.valid).toBe(true);
      });

      it('should pass for 90', () => {
        const result = validators.latitude()('90');
        expect(result.valid).toBe(true);
      });

      it('should fail for below -90', () => {
        const result = validators.latitude()('-91');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Latitude must be between -90 and 90');
      });

      it('should fail for above 90', () => {
        const result = validators.latitude()('91');
        expect(result.valid).toBe(false);
      });

      it('should pass for empty string', () => {
        const result = validators.latitude()('');
        expect(result.valid).toBe(true);
      });
    });

    describe('longitude', () => {
      it('should pass for valid longitude', () => {
        const result = validators.longitude()('-122.5');
        expect(result.valid).toBe(true);
      });

      it('should pass for -180', () => {
        const result = validators.longitude()('-180');
        expect(result.valid).toBe(true);
      });

      it('should pass for 180', () => {
        const result = validators.longitude()('180');
        expect(result.valid).toBe(true);
      });

      it('should fail for below -180', () => {
        const result = validators.longitude()('-181');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Longitude must be between -180 and 180');
      });

      it('should fail for above 180', () => {
        const result = validators.longitude()('181');
        expect(result.valid).toBe(false);
      });
    });

    describe('zoomLevel', () => {
      it('should pass for valid zoom', () => {
        const result = validators.zoomLevel()('12');
        expect(result.valid).toBe(true);
      });

      it('should pass for 0', () => {
        const result = validators.zoomLevel()('0');
        expect(result.valid).toBe(true);
      });

      it('should pass for 22', () => {
        const result = validators.zoomLevel()('22');
        expect(result.valid).toBe(true);
      });

      it('should fail for negative', () => {
        const result = validators.zoomLevel()('-1');
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Zoom level must be between 0 and 22');
      });

      it('should fail for above 22', () => {
        const result = validators.zoomLevel()('23');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('composeValidators', () => {
    it('should run validators in order', () => {
      const composed = composeValidators(
        validators.required(),
        validators.minLength(3)
      );

      // Empty fails required first
      const result1 = composed('');
      expect(result1.valid).toBe(false);
      expect(result1.message).toBe('This field is required');

      // Short string fails minLength
      const result2 = composed('ab');
      expect(result2.valid).toBe(false);
      expect(result2.message).toBe('Minimum 3 characters required');

      // Valid string passes both
      const result3 = composed('abc');
      expect(result3.valid).toBe(true);
    });

    it('should stop at first failure', () => {
      const calls: string[] = [];

      const validator1 = (value: string) => {
        calls.push('v1');
        return { valid: false, message: 'First failed' };
      };

      const validator2 = (value: string) => {
        calls.push('v2');
        return { valid: true };
      };

      const composed = composeValidators(validator1, validator2);
      composed('test');

      expect(calls).toEqual(['v1']);
    });
  });

  describe('createFieldValidator', () => {
    it('should create validator from config', () => {
      const validator = createFieldValidator({
        required: true,
        minLength: 2,
        maxLength: 10,
      });

      expect(validator('').valid).toBe(false);
      expect(validator('a').valid).toBe(false);
      expect(validator('ab').valid).toBe(true);
      expect(validator('12345678901').valid).toBe(false);
    });

    it('should support pattern', () => {
      const validator = createFieldValidator({
        pattern: /^[A-Z]+$/,
        patternMessage: 'Uppercase only',
      });

      expect(validator('abc').valid).toBe(false);
      expect(validator('abc').message).toBe('Uppercase only');
      expect(validator('ABC').valid).toBe(true);
    });

    it('should support custom validator', () => {
      const validator = createFieldValidator({
        custom: (value) => ({
          valid: value === 'secret',
          message: 'Wrong value',
        }),
      });

      expect(validator('wrong').valid).toBe(false);
      expect(validator('secret').valid).toBe(true);
    });
  });

  describe('FormValidator', () => {
    let formValidator: FormValidator;

    beforeEach(() => {
      formValidator = new FormValidator();
    });

    describe('registerField', () => {
      it('should register a validator', () => {
        formValidator.registerField('name', validators.required());
        const result = formValidator.validateField('name', '');
        expect(result.valid).toBe(false);
      });
    });

    describe('registerFieldWithConfig', () => {
      it('should register from config', () => {
        formValidator.registerFieldWithConfig('name', {
          required: true,
          minLength: 2,
        });

        expect(formValidator.validateField('name', '').valid).toBe(false);
        expect(formValidator.validateField('name', 'a').valid).toBe(false);
        expect(formValidator.validateField('name', 'ab').valid).toBe(true);
      });
    });

    describe('unregisterField', () => {
      it('should remove field', () => {
        formValidator.registerField('name', validators.required());
        formValidator.validateField('name', '');
        expect(formValidator.getError('name')).toBeDefined();

        formValidator.unregisterField('name');
        expect(formValidator.getError('name')).toBeUndefined();
      });
    });

    describe('validateField', () => {
      it('should return valid for unregistered field', () => {
        const result = formValidator.validateField('unknown', 'value');
        expect(result.valid).toBe(true);
      });

      it('should mark field as touched', () => {
        formValidator.registerField('name', validators.required());
        formValidator.validateField('name', 'value');
        expect(formValidator.isTouched('name')).toBe(true);
      });

      it('should track errors', () => {
        formValidator.registerField('name', validators.required());
        formValidator.validateField('name', '');
        expect(formValidator.getError('name')).toBe('This field is required');
      });

      it('should clear error when valid', () => {
        formValidator.registerField('name', validators.required());
        formValidator.validateField('name', '');
        formValidator.validateField('name', 'valid');
        expect(formValidator.getError('name')).toBeUndefined();
      });
    });

    describe('validateAll', () => {
      beforeEach(() => {
        formValidator.registerField('name', validators.required());
        formValidator.registerField('email', validators.required());
      });

      it('should validate all fields', () => {
        const valid = formValidator.validateAll({
          name: 'John',
          email: 'john@example.com',
        });
        expect(valid).toBe(true);
      });

      it('should return false if any invalid', () => {
        const valid = formValidator.validateAll({
          name: 'John',
          email: '',
        });
        expect(valid).toBe(false);
      });

      it('should handle missing values as empty', () => {
        const valid = formValidator.validateAll({ name: 'John' });
        expect(valid).toBe(false);
      });

      it('should touch all fields', () => {
        formValidator.validateAll({ name: 'John', email: 'test@test.com' });
        expect(formValidator.isTouched('name')).toBe(true);
        expect(formValidator.isTouched('email')).toBe(true);
      });
    });

    describe('isValid', () => {
      it('should return true when no errors', () => {
        expect(formValidator.isValid()).toBe(true);
      });

      it('should return false when has errors', () => {
        formValidator.registerField('name', validators.required());
        formValidator.validateField('name', '');
        expect(formValidator.isValid()).toBe(false);
      });
    });

    describe('getErrors', () => {
      it('should return all errors', () => {
        formValidator.registerField('name', validators.required());
        formValidator.registerField('age', validators.required());
        formValidator.validateAll({ name: '', age: '' });

        const errors = formValidator.getErrors();
        expect(errors).toHaveProperty('name');
        expect(errors).toHaveProperty('age');
      });
    });

    describe('touch', () => {
      it('should mark field as touched', () => {
        formValidator.touch('name');
        expect(formValidator.isTouched('name')).toBe(true);
      });
    });

    describe('reset', () => {
      it('should clear errors and touched state', () => {
        formValidator.registerField('name', validators.required());
        formValidator.validateField('name', '');

        formValidator.reset();

        expect(formValidator.isValid()).toBe(true);
        expect(formValidator.isTouched('name')).toBe(false);
      });
    });

    describe('clearErrors', () => {
      it('should clear only errors', () => {
        formValidator.registerField('name', validators.required());
        formValidator.validateField('name', '');

        formValidator.clearErrors();

        expect(formValidator.isValid()).toBe(true);
        expect(formValidator.isTouched('name')).toBe(true);
      });
    });
  });

  describe('DOM helpers', () => {
    let container: HTMLDivElement;
    let input: HTMLInputElement;

    beforeEach(() => {
      container = document.createElement('div');
      input = document.createElement('input');
      input.id = 'test-input';
      input.name = 'test';
      container.appendChild(input);
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    describe('applyValidationStyle', () => {
      it('should apply valid styles', () => {
        applyValidationStyle(input, true);
        expect(input.classList.contains('border-gray-300')).toBe(true);
        expect(input.classList.contains('border-red-500')).toBe(false);
        expect(input.getAttribute('aria-invalid')).toBe('false');
      });

      it('should apply invalid styles', () => {
        applyValidationStyle(input, false);
        expect(input.classList.contains('border-red-500')).toBe(true);
        expect(input.classList.contains('border-gray-300')).toBe(false);
        expect(input.getAttribute('aria-invalid')).toBe('true');
      });
    });

    describe('createErrorMessage', () => {
      it('should create error element', () => {
        const error = createErrorMessage('Test error');
        expect(error.tagName).toBe('P');
        expect(error.textContent).toBe('Test error');
        expect(error.getAttribute('role')).toBe('alert');
        expect(error.classList.contains('text-red-600')).toBe(true);
      });

      it('should set id if provided', () => {
        const error = createErrorMessage('Test', 'error-id');
        expect(error.id).toBe('error-id');
      });
    });

    describe('showFieldError', () => {
      it('should show error message', () => {
        showFieldError(input, 'Error message');

        const error = container.querySelector('p');
        expect(error).not.toBeNull();
        expect(error?.textContent).toBe('Error message');
      });

      it('should link error to input with aria-describedby', () => {
        showFieldError(input, 'Error');

        const describedBy = input.getAttribute('aria-describedby');
        expect(describedBy).toBe('test-input-error');
      });

      it('should apply invalid styling', () => {
        showFieldError(input, 'Error');
        expect(input.getAttribute('aria-invalid')).toBe('true');
      });
    });

    describe('hideFieldError', () => {
      it('should remove error message', () => {
        showFieldError(input, 'Error');
        hideFieldError(input);

        const error = container.querySelector('p');
        expect(error).toBeNull();
      });

      it('should remove aria-describedby', () => {
        showFieldError(input, 'Error');
        hideFieldError(input);

        expect(input.hasAttribute('aria-describedby')).toBe(false);
      });

      it('should apply valid styling', () => {
        showFieldError(input, 'Error');
        hideFieldError(input);

        expect(input.getAttribute('aria-invalid')).toBe('false');
      });
    });

    describe('createValidatedInput', () => {
      it('should create input element', () => {
        const validatedInput = createValidatedInput({
          name: 'email',
          validator: validators.required(),
        });

        expect(validatedInput.tagName).toBe('INPUT');
        expect(validatedInput.name).toBe('email');
        expect(validatedInput.id).toBe('email');
      });

      it('should set type and placeholder', () => {
        const validatedInput = createValidatedInput({
          type: 'email',
          name: 'email',
          placeholder: 'Enter email',
          validator: validators.required(),
        });

        expect(validatedInput.type).toBe('email');
        expect(validatedInput.placeholder).toBe('Enter email');
      });

      it('should validate on blur by default', () => {
        const onValidate = jest.fn();
        const validatedInput = createValidatedInput({
          name: 'test',
          validator: validators.required(),
          onValidate,
        });
        container.appendChild(validatedInput);

        validatedInput.dispatchEvent(new Event('blur'));

        expect(onValidate).toHaveBeenCalledWith({ valid: false, message: 'This field is required' });
      });

      it('should validate on input when enabled', () => {
        const onValidate = jest.fn();
        const validatedInput = createValidatedInput({
          name: 'test',
          validator: validators.required(),
          validateOnBlur: false,
          validateOnInput: true,
          onValidate,
        });
        container.appendChild(validatedInput);

        validatedInput.dispatchEvent(new Event('input'));

        expect(onValidate).toHaveBeenCalled();
      });
    });
  });
});
