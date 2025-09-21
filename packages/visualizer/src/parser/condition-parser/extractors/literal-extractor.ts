import { SAFE_MATH_OPERATORS, SPECIAL_IDENTIFIERS } from '../types'

export class LiteralExtractor {
    extract(node: any): any {
        if (!node) return undefined

        switch (node.type) {
            case 'Literal':
                return node.value
            case 'Identifier':
                return this._handleIdentifier(node)
            case 'TemplateLiteral':
                return this._handleTemplateLiteral(node)
            case 'BinaryExpression':
                return this._handleMathExpression(node)
            case 'ArrayExpression':
                return JSON.stringify(node.elements.map((el: any) => this.extract(el)))
            case 'ObjectExpression':
                return this._handleObjectExpression(node)
            default:
                throw new Error(`Unsupported literal node: ${node.type}`)
        }
    }

    private _handleIdentifier(node: any): any {
        const name = node.name
        if (SPECIAL_IDENTIFIERS.includes(name)) {
            return this._evaluateSpecialValue(name)
        }
        return name
    }

    private _handleTemplateLiteral(node: any): any {
        if (node.expressions.length === 0) {
            return node.quasis[0].value.cooked
        }

        if (node.expressions.length === 1 && node.quasis.length === 2) {
            const expr = node.expressions[0]
            if (expr.type === 'Identifier' && SPECIAL_IDENTIFIERS.includes(expr.name)) {
                const cooked = node.quasis[0].value.cooked
                return cooked.replace(/\$\{${expr.name}\}/, String(this._evaluateSpecialValue(expr.name)))
            }
        }

        return node.quasis.map((q: any) => q.value.cooked).join('')
    }

    private _handleMathExpression(node: any): any {
        if (!SAFE_MATH_OPERATORS.includes(node.operator)) {
            throw new Error(`Unsafe math operator: ${node.operator}`)
        }

        const leftVal = this.extract(node.left)
        const rightVal = this.extract(node.right)

        if (
            leftVal !== undefined &&
            rightVal !== undefined &&
            typeof leftVal === 'number' &&
            typeof rightVal === 'number'
        ) {
            try {
                switch (node.operator) {
                    case '+':
                        return leftVal + rightVal
                    case '-':
                        return leftVal - rightVal
                    case '*':
                        return leftVal * rightVal
                    case '/':
                        return leftVal / rightVal
                }
            } catch {
                throw new Error('Math evaluation failed')
            }
        }

        throw new Error('Invalid operands for math expression')
    }

    private _handleObjectExpression(node: any): string {
        const obj: any = {}
        node.properties.forEach((prop: any) => {
            if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.value) {
                obj[prop.key.name] = this.extract(prop.value)
            }
        })
        return JSON.stringify(obj)
    }

    private _evaluateSpecialValue(name: string): any {
        switch (name) {
            case 'true':
                return true
            case 'false':
                return false
            case 'null':
                return null
            case 'undefined':
                return undefined
            default:
                return name
        }
    }

    getValueType(val: any): 'string' | 'number' | 'boolean' {
        if (val === null) return 'string'
        if (typeof val === 'string') return 'string'
        if (typeof val === 'number' && !isNaN(val)) return 'number'
        if (typeof val === 'boolean') return 'boolean'
        return 'string'
    }
}
