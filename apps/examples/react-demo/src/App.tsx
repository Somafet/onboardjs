import './App.css'
import ReactIcon from './components/icons/react'
import OnobardJsLogo from './components/logo'
import OnboardingLayout from './components/onboarding/onboarding-layout'

function App() {
    return (
        <>
            <div className="antialiased">
                <div className="mb-6 flex items-center justify-center">
                    <a href="https://onboardjs.com" target="_blank">
                        <OnobardJsLogo className="block text-white size-12 sm:size-18" />
                    </a>

                    <span className="mx-8 text-2xl font-bold text-white">x</span>

                    <ReactIcon className="ml-2 block size-12 sm:size-16" />
                </div>
                {/**
                 * This is the main entry point for the React application.
                 * Since this is a simple example, we are only using the OnboardingLayout component here.
                 * In a real application, you would likely have more components and routes.
                 */}
                <OnboardingLayout />

                <div className="mt-6 w-full text-center">
                    <a href="https://docs.onboardjs.com" target="_blank" className="text-blue-400 hover:underline">
                        Read the Docs 📖
                    </a>

                    <span className="mx-4">|</span>

                    <a
                        href="https://github.com/Somafet/onboardjs"
                        target="_blank"
                        className="text-blue-400 hover:underline"
                    >
                        Star on GitHub ⭐
                    </a>
                </div>
            </div>
        </>
    )
}

export default App
