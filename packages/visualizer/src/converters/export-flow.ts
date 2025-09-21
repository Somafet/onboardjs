import { OnboardingContext } from '@onboardjs/core'
import { FlowState } from '../types/flow-types'
import { exportFlowAsSteps } from './flow-to-steps'

/**
 * Format steps array with proper handling of function strings
 * Converts function strings back to actual functions in the output
 */
function formatStepsWithFunctions(steps: any[], indent: number = 2): string {
    let result = JSON.stringify(steps, null, indent)

    // Remove unnecessary quotes from property names
    result = result.replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1:')

    // Convert function strings back to actual functions
    // We need to handle the full function content including escaped quotes
    result = result.replace(
        /(nextStep|previousStep|skipToStep):\s*"((?:\\.|[^"\\])*?\(context\)(?:\\.|[^"\\])*)"/g,
        (_, property, functionBody) => {
            // Unescape the function body completely
            let unescapedFunction = functionBody
                .replace(/\\n/g, '\n') // Convert \n to actual newlines
                .replace(/\\"/g, '"') // Convert \" to "
                .replace(/\\\\/g, '\\') // Convert \\\\ to \\

            // Fix quotes within the function: convert "null" to null, keep step IDs as strings
            unescapedFunction = unescapedFunction.replace(/"\s*null\s*"/g, 'null') // "null" -> null

            return `${property}: ${unescapedFunction}`
        }
    )

    return result
}

/**
 * Generate TypeScript/JavaScript code from FlowState
 * This provides more flexibility than the step format
 */
export function exportFlowAsCode(
    flowState: FlowState,
    options: {
        format?: 'typescript' | 'javascript'
        includeTypes?: boolean
        includeComments?: boolean
        variableName?: string
    } = {}
): string {
    const { format = 'typescript', includeTypes = true, includeComments = true, variableName = 'flowSteps' } = options

    const steps = exportFlowAsSteps(flowState)
    const isTypeScript = format === 'typescript'

    let code = ''

    if (includeComments) {
        code += '// Generated onboarding flow\n'
        code += `// Generated on ${new Date().toISOString()}\n\n`
    }

    if (isTypeScript && includeTypes) {
        code += "import type { OnboardingStep } from '@onboardjs/core'\n\n"
    }

    const typeAnnotation = isTypeScript && includeTypes ? ': OnboardingStep[]' : ''

    // Convert to string with proper formatting and function handling
    const stepsString = formatStepsWithFunctions(steps, 2)
    code += `export const ${variableName}${typeAnnotation} = ${stepsString}\n`

    return code
}

/**
 * Export flow as JSON string with customizable formatting
 */
export function exportFlowAsJSON<TContext extends OnboardingContext = OnboardingContext>(
    flowState: FlowState,
    options: {
        prettyPrint?: boolean
        includeMetadata?: boolean
        stepFormat?: boolean
    } = {}
): string {
    const { prettyPrint = true, stepFormat = true } = options

    if (stepFormat) {
        const steps = exportFlowAsSteps<TContext>(flowState)
        return prettyPrint ? JSON.stringify(steps, null, 2) : JSON.stringify(steps)
    }

    // Export full flow state
    return prettyPrint ? JSON.stringify(flowState, null, 2) : JSON.stringify(flowState)
}

/**
 * Create downloadable content for export
 */
export function createDownloadableContent(
    content: string,
    format: 'json' | 'typescript' | 'javascript'
): { content: string; filename: string; mimeType: string } {
    const timestamp = new Date().toISOString().split('T')[0]

    const formatData = {
        json: {
            filename: `onboarding-flow-${timestamp}.json`,
            mimeType: 'application/json',
        },
        typescript: {
            filename: `onboarding-flow-${timestamp}.ts`,
            mimeType: 'text/typescript',
        },
        javascript: {
            filename: `onboarding-flow-${timestamp}.js`,
            mimeType: 'text/javascript',
        },
    }

    const { filename, mimeType } = formatData[format]

    return {
        content,
        filename,
        mimeType,
    }
}
