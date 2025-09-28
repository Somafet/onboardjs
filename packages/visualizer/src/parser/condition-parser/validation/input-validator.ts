import { ParseInput } from '../types'

export interface InputValidator {
    validate(input: ParseInput): boolean
    sanitize?(input: string): string
}

export class StringValidator implements InputValidator {
    validate(input: ParseInput): boolean {
        if (typeof input !== 'string') return false

        const trimmed = input.trim()
        if (!trimmed || trimmed.length < 3) return false

        if (!/[\w.]|===|!==|==|!=|>|<|\?|\(|\)|!/.test(trimmed)) {
            console.warn('Input string appears to be invalid condition syntax')
            return false
        }
        return true
    }

    sanitize(input: string): string {
        return input.replace(/eval|Function|setTimeout|setInterval/g, '')
    }
}

export class FunctionValidator implements InputValidator {
    validate(input: ParseInput): boolean {
        if (typeof input !== 'function') return false

        const str = input.toString()
        if (!str.includes('=>') && !str.includes('function')) {
            console.warn('Input function appears malformed')
            return false
        }

        if (!str.includes('context') && !str.includes('return') && str.length < 10) {
            console.warn('Function may not contain valid condition logic')
            return false
        }
        return true
    }
}

export class NumberValidator implements InputValidator {
    validate(input: ParseInput): boolean {
        return typeof input === 'number'
    }
}

export class CompositeInputValidator implements InputValidator {
    private _validators: InputValidator[] = [new StringValidator(), new FunctionValidator(), new NumberValidator()]

    validate(input: ParseInput): boolean {
        if (typeof input === 'undefined' || input === null) {
            return false
        }

        return this._validators.some((validator) => validator.validate(input))
    }

    sanitize(input: string): string {
        const stringValidator = this._validators.find((v) => v instanceof StringValidator) as StringValidator
        return stringValidator ? stringValidator.sanitize(input) : input
    }
}
