import * as acorn from 'acorn'
import type { OnboardingStep } from '@onboardjs/core'

/**
 * Optimized OnboardJS parser that extracts step data from user code
 * Prioritizes performance and simplicity for the OnboardJS exported format
 */
export class OnboardJSParser {
    /**
     * Parses user-provided code and extracts onboarding steps
     * @param code - The user-provided JavaScript/TypeScript code
     * @returns Array of parsed onboarding steps or empty array if parsing fails
     */
    static parseSteps(code: string): OnboardingStep[] {
        if (!code || typeof code !== 'string') {
            return []
        }

        try {
            // Extract condition functions first
            const conditionFunctions = this.extractConditionFunctions(code)

            // Try regex extraction first - it works better for our standard format
            const regexSteps = this.extractStepsWithFallbackRegex(code, conditionFunctions)
            if (regexSteps.length > 0) {
                return regexSteps
            }

            // Fall back to AST parsing if regex fails
            console.info('Using AST parser for OnboardJS steps')
            const astSteps = this.simplifiedASTExtraction(code, conditionFunctions)

            return astSteps
        } catch (error) {
            console.error('Failed to parse onboarding steps:', error)
            return []
        }
    }

    /**
     * Extracts condition functions from the code
     * @param code - The source code
     * @returns Map of function names to function bodies
     */
    private static extractConditionFunctions(code: string): Map<string, string> {
        const functionMap = new Map<string, string>()

        // Extract function declarations in format: const funcName = (params) => body
        // Handles TypeScript parameter types like (context: OnboardingContext)
        const arrowFunctionRegex = /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*([^;]+);/g
        let match

        while ((match = arrowFunctionRegex.exec(code)) !== null) {
            const functionName = match[1]
            const params = match[2].replace(/:\s*[\w\d_$<>[\]]+/g, '') // Remove TS type annotations
            const body = match[3]
            functionMap.set(functionName, `(${params}) => ${body}`)
        }

        return functionMap
    }

    /**
     * Alternative regex extraction that's more lenient with the input format
     * Used as a fallback when the main regex extraction fails
     */
    private static extractStepsWithFallbackRegex(
        code: string,
        conditionFunctions: Map<string, string>
    ): OnboardingStep[] {
        try {
            // Look for any array with objects that contain step-like properties
            // This is more lenient than the primary extraction method
            const objectPattern = /\{\s*id\s*:\s*['"]([^'"]+)['"]/g
            const matches = Array.from(code.matchAll(objectPattern))

            if (matches.length === 0) return []

            const steps: OnboardingStep[] = []

            for (const match of matches) {
                const startPos = match.index
                if (startPos === undefined) continue

                // Find the closing brace of this object
                let openBraces = 1
                let endPos = startPos + 1

                for (let i = startPos + 1; i < code.length; i++) {
                    if (code[i] === '{') openBraces++
                    else if (code[i] === '}') openBraces--

                    if (openBraces === 0) {
                        endPos = i + 1
                        break
                    }
                }

                const objectStr = code.substring(startPos, endPos)
                const step = this.parseStepObjectFromString(objectStr, conditionFunctions)

                if (step && step.id) {
                    // Check if we already have this step (avoid duplicates)
                    if (!steps.some((existingStep) => existingStep.id === step.id)) {
                        steps.push(step)
                    }
                }
            }

            return this.validateSteps(steps)
        } catch (error) {
            console.warn('Fallback regex extraction failed:', error)
            return []
        }
    }

    /**
     * Parse a step object from its string representation
     */
    private static parseStepObjectFromString(
        objectStr: string,
        conditionFunctions: Map<string, string>
    ): OnboardingStep | null {
        const step: Partial<OnboardingStep> = {}

        // Extract ID (required)
        const idMatch = objectStr.match(/id\s*:\s*['"]([^'"]+)['"]/)
        if (!idMatch) return null
        step.id = idMatch[1]

        // Extract nextStep
        const nextStepMatch = objectStr.match(/nextStep\s*:\s*(['"]([^'"]+)['"]|null)/)
        if (nextStepMatch) {
            step.nextStep = nextStepMatch[2] || null
            if (step.nextStep === 'null') step.nextStep = null
        }

        // Extract previousStep
        const prevStepMatch = objectStr.match(/previousStep\s*:\s*(['"]([^'"]+)['"]|null)/)
        if (prevStepMatch) {
            step.previousStep = prevStepMatch[2] || null
            if (step.previousStep === 'null') step.previousStep = null
        }

        // Extract skipToStep
        const skipToMatch = objectStr.match(/skipToStep\s*:\s*(['"]([^'"]+)['"]|null)/)
        if (skipToMatch) {
            step.skipToStep = skipToMatch[2] || null
            if (step.skipToStep === 'null') step.skipToStep = null
        }

        // Extract isSkippable
        const skippableMatch = objectStr.match(/isSkippable\s*:\s*(true|false)/)
        if (skippableMatch) {
            step.isSkippable = skippableMatch[1] === 'true'
        }

        // Extract condition reference and resolve to function body if possible
        const conditionMatch = objectStr.match(/condition\s*:\s*(\w+)/)
        if (conditionMatch) {
            const conditionName = conditionMatch[1]
            if (conditionFunctions.has(conditionName)) {
                step.condition = conditionFunctions.get(conditionName) as any
            } else {
                step.condition = `(context) => { /* Function reference: ${conditionName} */ }` as any
            }
        } else {
            // Check for inline arrow function
            const inlineConditionMatch = objectStr.match(/condition\s*:\s*(\([^)]*\)\s*=>\s*[^,}]+)/)
            if (inlineConditionMatch) {
                step.condition = inlineConditionMatch[1].trim() as any
            }
        }

        // Extract type
        const typeMatch = objectStr.match(/type\s*:\s*['"]([^'"]+)['"]/)
        if (typeMatch) {
            const validTypes = [
                'INFORMATION',
                'MULTIPLE_CHOICE',
                'SINGLE_CHOICE',
                'CONFIRMATION',
                'CUSTOM_COMPONENT',
                'CHECKLIST',
            ] as const

            if ((validTypes as readonly string[]).includes(typeMatch[1] as any)) {
                ;(step as any).type = typeMatch[1]
            }
        }

        // Extract title & description
        const titleMatch = objectStr.match(/title\s*:\s*['"]([^'"]+)['"]/)
        const descMatch = objectStr.match(/description\s*:\s*['"]([^'"]+)['"]/)

        if (titleMatch || descMatch) {
            step.meta = {}
            if (titleMatch) step.meta.title = titleMatch[1]
            if (descMatch) step.meta.description = descMatch[1]
        }

        return step as OnboardingStep
    }

    /**
     * Simplified AST-based extraction as a fallback
     */
    private static simplifiedASTExtraction(code: string, conditionFunctions: Map<string, string>): OnboardingStep[] {
        try {
            // Preprocess code to remove TypeScript-specific syntax
            const preprocessedCode = this.preprocessTypeScript(code)

            try {
                // Try parsing as module first (which supports import/export)
                try {
                    const moduleAst = acorn.parse(preprocessedCode, {
                        ecmaVersion: 2022,
                        sourceType: 'module',
                        allowImportExportEverywhere: true,
                        locations: true,
                    })

                    // Extract steps array from AST
                    const moduleSteps = this.extractStepsFromAST(moduleAst, conditionFunctions)
                    if (moduleSteps.length > 0) {
                        return moduleSteps
                    }
                } catch (moduleError) {
                    console.warn('Module AST parsing failed:', moduleError)
                }

                // Fallback to script parsing if module parsing fails
                const scriptAst = acorn.parse(preprocessedCode, {
                    ecmaVersion: 2022,
                    sourceType: 'script',
                    locations: true,
                })

                // Extract steps array from AST
                const scriptSteps = this.extractStepsFromAST(scriptAst, conditionFunctions)
                if (scriptSteps.length > 0) {
                    return scriptSteps
                }
            } catch (error) {
                console.warn('AST parsing failed:', error)

                // Last attempt: manually extract array content with regex
                try {
                    const arrayMatch = preprocessedCode.match(
                        /(?:const|let|var)\s+\w+\s*(?::\s*[^=]+)?\s*=\s*(\[[\s\S]*?\])\s*(?:as\s+const\s*)?;?/
                    )
                    if (arrayMatch && arrayMatch[1]) {
                        const arrayCode = `const temp = ${arrayMatch[1]};`
                        const ast = acorn.parse(arrayCode, {
                            ecmaVersion: 2022,
                            sourceType: 'script',
                            locations: true,
                        })

                        return this.extractStepsFromAST(ast, conditionFunctions)
                    }
                } catch (finalError) {
                    console.warn('Final extraction attempt failed:', finalError)
                }

                return []
            }
        } catch (error) {
            console.warn('Simplified AST extraction failed:', error)
            return []
        }

        return []
    }

    /**
     * Preprocesses TypeScript code to make it compatible with JavaScript parsers
     * Removes imports, exports, type annotations, and other TypeScript-specific syntax
     */
    private static preprocessTypeScript(code: string): string {
        let processedCode = code
            // Remove import statements
            .replace(/^\s*import\s+.*?[;\n]/gm, '')
            // Remove export keywords but keep the content
            .replace(/export\s+(?:default\s+)?/g, '')
            // Remove single-line comments
            .replace(/\/\/.*$/gm, '')
            // Remove multiline comments
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Remove type annotations on variables (e.g., ": string", ": number", ": Type")
            .replace(/:\s*[\w\d_$]+(?:<[^>]*>)?(?:\[\])*/g, '')
            // Remove interface and type declarations
            .replace(/^\s*(interface|type)\s+[\w\d_$]+\s*(<.*?>)?\s*\{[\s\S]*?\}\s*;?/gm, '')
            // Remove "as const" assertions
            .replace(/\s+as\s+const/g, '')
            // Handle TypeScript parameter annotations (e.g., (param: Type) => {})
            .replace(/\(([^)]*)\)\s*=>/g, (match, params) => {
                // Remove type annotations from parameters
                const cleanParams = params.replace(/:\s*[\w\d_$<>[\]]+/g, '').trim()
                return `(${cleanParams}) =>`
            })
            // Remove namespace declarations but keep content
            .replace(/namespace\s+[\w\d_$]+\s*\{([\s\S]*?)\}/g, '$1')
            // Remove declare statements
            .replace(/^\s*declare\s+.*?;/gm, '')

        return processedCode
    } /**
     * Extract steps from the AST
     */
    private static extractStepsFromAST(ast: any, conditionFunctions: Map<string, string>): OnboardingStep[] {
        const allSteps: OnboardingStep[] = []

        // Special case: if we used the fragment parsing as a last resort
        if (
            ast &&
            ast.body &&
            ast.body.length === 1 &&
            ast.body[0].type === 'VariableDeclaration' &&
            ast.body[0].declarations &&
            ast.body[0].declarations[0] &&
            ast.body[0].declarations[0].id &&
            ast.body[0].declarations[0].id.name === 'temp'
        ) {
            const declaration = ast.body[0].declarations[0]
            if (declaration.init && declaration.init.type === 'ArrayExpression') {
                const stepObjects = declaration.init.elements || []

                for (const stepObj of stepObjects) {
                    if (stepObj && stepObj.type === 'ObjectExpression') {
                        const step = this.parseStepObject(stepObj, conditionFunctions)
                        if (step) {
                            allSteps.push(step)
                        }
                    }
                }

                return this.validateSteps(allSteps)
            }
        }

        // Look for arrays in the AST
        this.traverseAST(ast, (node) => {
            // Look for variable declarations with array initializers
            if (node.type === 'VariableDeclaration' && node.declarations && node.declarations.length > 0) {
                for (const declaration of node.declarations) {
                    // Check if it's an array literal
                    if (declaration.init && declaration.init.type === 'ArrayExpression') {
                        // Look for arrays with name containing "steps"
                        const isStepsArray =
                            declaration.id &&
                            declaration.id.type === 'Identifier' &&
                            declaration.id.name.toLowerCase().includes('step')

                        if (isStepsArray) {
                            const stepObjects = declaration.init.elements || []

                            for (const stepObj of stepObjects) {
                                if (stepObj && stepObj.type === 'ObjectExpression') {
                                    const step = this.parseStepObject(stepObj, conditionFunctions)
                                    if (step) {
                                        allSteps.push(step)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Look for arrays that might be directly in assignments
            if (node.type === 'ArrayExpression' && node.elements && node.elements.length > 0) {
                // Check if this array contains step-like objects
                let stepLikeCount = 0

                for (const element of node.elements) {
                    if (element && element.type === 'ObjectExpression') {
                        // Count properties that suggest this is a step object
                        const properties = element.properties || []
                        let hasIdProperty = false

                        for (const prop of properties) {
                            if (
                                prop.key &&
                                ((prop.key.type === 'Identifier' && prop.key.name === 'id') ||
                                    (prop.key.type === 'Literal' && prop.key.value === 'id'))
                            ) {
                                hasIdProperty = true
                                break
                            }
                        }

                        if (hasIdProperty) {
                            stepLikeCount++
                        }
                    }
                }

                // If more than half of the array elements look like steps, parse them
                if (stepLikeCount > 0 && stepLikeCount >= node.elements.length / 2) {
                    for (const stepObj of node.elements) {
                        if (stepObj && stepObj.type === 'ObjectExpression') {
                            const step = this.parseStepObject(stepObj, conditionFunctions)
                            if (step) {
                                allSteps.push(step)
                            }
                        }
                    }
                }
            }
        })

        return this.validateSteps(allSteps)
    }

    /**
     * Traverses an AST and calls the callback for each node
     */
    private static traverseAST(node: any, callback: (node: any) => void) {
        if (!node || typeof node !== 'object') return

        callback(node)

        // Recursively process all properties of the node
        for (const key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key)) {
                const child = node[key]

                if (Array.isArray(child)) {
                    for (const item of child) {
                        if (item && typeof item === 'object') {
                            this.traverseAST(item, callback)
                        }
                    }
                } else if (child && typeof child === 'object') {
                    this.traverseAST(child, callback)
                }
            }
        }
    }

    /**
     * Parses a step object from an AST node
     */
    private static parseStepObject(node: any, conditionFunctions: Map<string, string>): OnboardingStep | null {
        if (!node || node.type !== 'ObjectExpression') return null

        const properties = node.properties || []
        const step: Partial<OnboardingStep> = {}

        for (const prop of properties) {
            if (!prop.key || !prop.value) continue

            const keyName = this.getPropertyKeyName(prop.key)
            if (!keyName) continue

            switch (keyName) {
                case 'id':
                    const id = this.extractStringValue(prop.value)
                    if (id !== null) {
                        step.id = id
                    }
                    break

                case 'nextStep':
                    step.nextStep = this.extractNavigationValue(prop.value)
                    // Convert 'null' to null
                    if (step.nextStep === 'null') step.nextStep = null
                    break

                case 'previousStep':
                    step.previousStep = this.extractNavigationValue(prop.value)
                    // Convert 'null' to null
                    if (step.previousStep === 'null') step.previousStep = null
                    break

                case 'skipToStep':
                    step.skipToStep = this.extractNavigationValue(prop.value)
                    // Convert 'null' to null
                    if (step.skipToStep === 'null') step.skipToStep = null
                    break

                case 'isSkippable':
                    step.isSkippable = this.extractBooleanValue(prop.value)
                    break

                case 'condition':
                    const conditionValue = this.extractConditionValue(prop.value, conditionFunctions)
                    if (conditionValue) {
                        step.condition = conditionValue as any
                    }
                    break

                case 'type':
                    const typeValue = this.extractStringValue(prop.value)
                    if (typeValue) {
                        const validTypes = [
                            'INFORMATION',
                            'MULTIPLE_CHOICE',
                            'SINGLE_CHOICE',
                            'CONFIRMATION',
                            'CUSTOM_COMPONENT',
                            'CHECKLIST',
                        ] as const

                        if ((validTypes as readonly string[]).includes(typeValue)) {
                            ;(step as any).type = typeValue
                        }
                    }
                    break

                case 'title':
                case 'description':
                    if (!step.meta) step.meta = {}
                    const textValue = this.extractStringValue(prop.value)
                    if (textValue !== null) {
                        step.meta[keyName] = textValue
                    }
                    break
            }
        }

        // Ensure the step has a valid ID
        if (!step.id || typeof step.id !== 'string' || step.id.trim() === '') {
            return null
        }

        return step as OnboardingStep
    }

    /**
     * Gets the name of a property key
     */
    private static getPropertyKeyName(key: any): string | null {
        if (!key) return null

        if (key.type === 'Identifier') {
            return key.name
        } else if (key.type === 'Literal' && typeof key.value === 'string') {
            return key.value
        }

        return null
    }

    /**
     * Extracts a string value from an AST node
     */
    private static extractStringValue(node: any): string | null {
        if (!node) return null

        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value
        } else if (node.type === 'TemplateLiteral' && node.quasis && node.quasis.length === 1) {
            // Simple template literal without expressions
            return node.quasis[0].value.cooked
        }

        return null
    }

    /**
     * Extracts a boolean value from an AST node
     */
    private static extractBooleanValue(node: any): boolean | undefined {
        if (!node) return undefined

        if (node.type === 'Literal' && typeof node.value === 'boolean') {
            return node.value
        }

        return undefined
    }

    /**
     * Extracts a navigation value (string or null) from an AST node
     */
    private static extractNavigationValue(node: any): string | null | undefined {
        if (!node) return undefined

        if (node.type === 'Literal') {
            if (node.value === null) {
                return null
            } else if (typeof node.value === 'string') {
                return node.value
            }
        } else if (node.type === 'Identifier' && node.name === 'null') {
            return null
        } else if (node.type === 'TemplateLiteral' && node.quasis && node.quasis.length === 1) {
            // Simple template literal without expressions
            return node.quasis[0].value.cooked
        }

        return undefined
    }

    /**
     * Extracts a condition value from an AST node
     */
    private static extractConditionValue(node: any, conditionFunctions: Map<string, string>): string | null {
        if (!node) return null

        if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
            // This is an inline function - extract the actual implementation
            try {
                const params = node.params.map((p: any) => p.name || 'param').join(', ')

                if (node.body.type === 'BlockStatement') {
                    // Block statement - just indicate it's a complex function
                    return `(${params}) => { /* Complex function body */ }`
                } else if (node.body.type === 'BinaryExpression') {
                    // Binary expression like context.flowData?.userRole === 'value'
                    const left = this.extractExpressionString(node.body.left)
                    const operator = node.body.operator
                    const right = this.extractExpressionString(node.body.right)
                    return `(${params}) => ${left} ${operator} ${right}`
                } else if (node.body.type === 'MemberExpression') {
                    // Member expression like context.someProperty
                    const memberExpr = this.extractExpressionString(node.body)
                    return `(${params}) => ${memberExpr}`
                } else {
                    // Other expression types
                    return `(${params}) => { /* Expression body */ }`
                }
            } catch (error) {
                return '(context) => { /* Inline function */ }'
            }
        } else if (node.type === 'Identifier') {
            // This is a reference to a function variable
            const funcName = node.name
            if (conditionFunctions.has(funcName)) {
                return conditionFunctions.get(funcName) || null
            } else {
                return `(context) => { /* Function reference: ${funcName} */ }`
            }
        }

        return null
    }

    /**
     * Helper to extract string representation from AST expressions
     */
    private static extractExpressionString(node: any): string {
        if (!node) return 'undefined'

        switch (node.type) {
            case 'Identifier':
                return node.name
            case 'Literal':
                return typeof node.value === 'string' ? `'${node.value}'` : String(node.value)
            case 'MemberExpression':
                const object = this.extractExpressionString(node.object)
                const property = node.computed
                    ? `[${this.extractExpressionString(node.property)}]`
                    : `.${node.property.name}`
                const optional = node.optional ? '?' : ''
                return `${object}${optional}${property}`
            case 'CallExpression':
                const callee = this.extractExpressionString(node.callee)
                const args = node.arguments.map((arg: any) => this.extractExpressionString(arg)).join(', ')
                return `${callee}(${args})`
            default:
                return '/* complex expression */'
        }
    }

    /**
     * Validates and filters the parsed steps
     * Also deduplicates steps by ID
     */
    private static validateSteps(steps: OnboardingStep[]): OnboardingStep[] {
        // First, filter out invalid steps
        const validSteps = steps.filter((step) => {
            // Must have an id
            if (!step.id || typeof step.id !== 'string' || step.id.trim() === '') {
                return false
            }

            // Validate string or null properties if present
            const stringOrNullProps = ['nextStep', 'previousStep', 'skipToStep']
            for (const prop of stringOrNullProps) {
                const value = (step as Record<string, unknown>)[prop]

                if (value !== undefined && value !== null && typeof value !== 'string') {
                    // Convert non-string/non-null values to null
                    ;(step as Record<string, unknown>)[prop] = null
                }

                // Convert 'null' to null
                if (value === 'null') {
                    ;(step as Record<string, unknown>)[prop] = null
                }
            }

            return true
        })

        // Then deduplicate by ID - keep only the first occurrence of each ID
        const seenIds = new Set<string>()
        return validSteps.filter((step) => {
            const id = String(step.id) // Ensure it's a string
            if (seenIds.has(id)) {
                return false // Skip duplicate
            }
            seenIds.add(id)
            return true
        })
    }
}
