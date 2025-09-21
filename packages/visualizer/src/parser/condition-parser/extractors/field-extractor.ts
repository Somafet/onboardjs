export class FieldExtractor {
    extract(node: any): string {
        if (!node) return ''

        let current = node
        const propertyNames: string[] = []
        let baseField = ''

        // Handle multiple ChainExpressions and MemberExpressions
        while (current) {
            if (current.type === 'ChainExpression') {
                current = current.expression
                continue
            }

            if (current.type === 'MemberExpression') {
                this._extractMemberProperty(current, propertyNames)
                current = current.object

                if (current?.type === 'ThisExpression') {
                    baseField = 'this'
                    break
                }
            } else {
                if (current.type === 'Identifier') {
                    baseField = current.name
                }
                break
            }
        }

        const fullPath = [baseField, ...propertyNames].filter(Boolean).join('.')
        return this._normalizeFieldPath(fullPath)
    }

    private _extractMemberProperty(memberNode: any, propertyNames: string[]): void {
        if (memberNode.computed && memberNode.property) {
            this._extractComputedProperty(memberNode.property, propertyNames)
        } else if (memberNode.property?.type === 'Identifier') {
            propertyNames.unshift(memberNode.property.name)
        } else if (memberNode.property?.type === 'Literal') {
            propertyNames.unshift(String(memberNode.property.value))
        }
    }

    private _extractComputedProperty(property: any, propertyNames: string[]): void {
        if (property.type === 'Literal') {
            propertyNames.unshift(`[${property.value}]`)
        } else if (property.type === 'Identifier') {
            propertyNames.unshift(`['${property.name}']`)
        } else if (property.type === 'TemplateLiteral' && property.expressions.length === 0) {
            const literalValue = property.quasis[0].value.cooked
            propertyNames.unshift(`['${literalValue}']`)
        }
    }

    private _normalizeFieldPath(fullPath: string): string {
        if (fullPath.startsWith('context.')) {
            return fullPath.replace('context.', '').replace(/^flowData\./, '')
        }
        return fullPath
    }
}
