// src/parser/onboardjs-parser.ts

import { OnboardingStep, OnboardingContext } from '@onboardjs/core'
import { parse, type Property, type Node } from 'acorn'
import ParsingError from '../parsing-error'

// Helper function to get a property from an AST ObjectExpression
function getObjectProperty(node: Node, key: string): Property | undefined {
    if (node.type !== 'ObjectExpression') return undefined

    if (!('properties' in node) || !Array.isArray(node.properties)) return undefined

    // Acorn's `Property` type has a key of type `Expression`. We assume `Identifier` for simplicity.
    return node.properties.find((p: any) => p.type === 'Property' && p.key.name === key) as Property | undefined
}

/**
 * A safe parser for OnboardJS step definitions from a string of code.
 * Uses an AST parser (acorn) to avoid code execution.
 */
export class OnboardJSParser {
    /**
     * Parses a string containing JS/TS code to extract an array of OnboardingSteps.
     * This method is safe and does not execute any of the input code.
     *
     * @param code The string content of the file.
     * @returns An array of OnboardingStep objects.
     * @throws A ParsingError if the steps array is not found or is malformed.
     */
    public static parseSteps<TContext extends OnboardingContext = OnboardingContext>(
        code: string
    ): OnboardingStep<TContext>[] {
        const ast = parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true,
        })

        let stepsArrayNode: any = null

        // Find the exported 'steps' array declaration in the AST
        for (const node of ast.body) {
            if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
                const declaration = node.declaration.declarations.find(
                    (d: any) =>
                        d.id.type === 'Identifier' && d.id.name === 'steps' && d.init?.type === 'ArrayExpression'
                )
                if (declaration) {
                    stepsArrayNode = declaration.init
                    break
                }
            }
        }

        if (!stepsArrayNode) {
            throw new ParsingError("Could not find an exported 'steps' array in the file.")
        }

        // Convert the AST array expression into OnboardingStep objects
        return stepsArrayNode.elements.map((stepNode: any): OnboardingStep<TContext> => {
            if (stepNode.type !== 'ObjectExpression') {
                throw new ParsingError('Found a non-object element in the steps array.')
            }
            return this._parseStepObject(stepNode, code)
        })
    }

    /**
     * Parses a single AST ObjectExpression node into an OnboardingStep.
     */
    private static _parseStepObject<TContext extends OnboardingContext = OnboardingContext>(
        node: Node,
        code: string
    ): OnboardingStep<TContext> {
        const step: Partial<OnboardingStep<TContext>> = {}

        // Extract 'id'
        const idProp = getObjectProperty(node, 'id')
        if (idProp && idProp.value.type === 'Literal') {
            step.id = idProp.value.value as string
        } else {
            throw new ParsingError('Step is missing a valid `id` property.')
        }

        // Extract 'type' or default it
        const typeProp = getObjectProperty(node, 'type')
        if (typeProp && typeProp.value.type === 'Literal') {
            step.type = typeProp.value.value as OnboardingStep<TContext>['type']
        } else {
            step.type = 'INFORMATION' // Default type if not specified
        }

        // Extract 'payload' or default it
        step.payload = {} // Default to empty payload

        // Extract step links ('nextStep', 'previousStep', 'skipToStep')
        try {
            step.nextStep = this._parseStepLink(getObjectProperty(node, 'nextStep'), code)
            step.previousStep = this._parseStepLink(getObjectProperty(node, 'previousStep'), code)
            step.skipToStep = this._parseStepLink(getObjectProperty(node, 'skipToStep'), code)
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred'
            throw new ParsingError(`Failed to parse a link property for step "${step.id}": ${message}`, e)
        }

        return step as OnboardingStep<TContext>
    }

    /**
     * Parses a property that can be a function, a string literal, or null.
     */
    private static _parseStepLink<TContext extends OnboardingContext = OnboardingContext>(
        prop: Property | undefined,
        code: string
    ): OnboardingStep<TContext>['nextStep'] | undefined {
        if (!prop) {
            return undefined
        }

        const valueNode = prop.value

        switch (valueNode.type) {
            case 'Literal':
                // Handles strings, null, booleans, numbers
                return valueNode.value as string | null

            case 'ArrowFunctionExpression':
            case 'FunctionExpression': {
                const functionString = code.slice(valueNode.start, valueNode.end)
                try {
                    // Safely reconstruct the function without immediate execution
                    return new Function('return ' + functionString)()
                } catch (e) {
                    throw new ParsingError('Could not reconstruct function string.', e)
                }
            }

            default:
                // Ignore unsupported types like Identifiers pointing to other variables
                return undefined
        }
    }
}
