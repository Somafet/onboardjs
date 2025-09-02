import { useOnboarding } from '@onboardjs/react'
import clsx from 'clsx'
import { Highlight, themes } from 'prism-react-renderer'
import { Fragment } from 'react'

const codeBlock = `import { useOnboarding } from '@onboardjs/react'

// Inside your UI component
const { next, previous } = useOnboarding()

<button
  onClick={() => next()}
>
  Next
</button>`

export default function DevImplExample() {
    const { next, previous } = useOnboarding()
    return (
        <>
            <Highlight language="typescript" code={codeBlock} theme={themes.dracula}>
                {({ className, style, tokens, getTokenProps }) => {
                    return (
                        <div className={clsx(className, 'overflow-x-auto rounded-md bg-[#362d3d]')}>
                            <pre style={{ ...style, margin: 0 }} className="px-4 py-2">
                                <code className="text-wrap">
                                    {tokens.map((line, lineIndex) => (
                                        <Fragment key={lineIndex}>
                                            {line
                                                .filter((token) => !token.empty)
                                                .map((token, tokenIndex) => (
                                                    <span key={tokenIndex} {...getTokenProps({ token })} />
                                                ))}
                                            {'\n'}
                                        </Fragment>
                                    ))}
                                </code>
                            </pre>
                        </div>
                    )
                }}
            </Highlight>

            <div className="mt-6 flex w-full justify-end">
                <button
                    onClick={() => previous()}
                    className="mr-2 rounded-md bg-gray-200 px-4 py-2 text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    Back
                </button>
                <button
                    onClick={() => next()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    Next
                </button>
            </div>
        </>
    )
}
