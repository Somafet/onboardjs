'use client'

import type React from 'react'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRight, FolderPlusIcon } from 'lucide-react'
import { StepComponentProps, useOnboarding } from '@onboardjs/react'

export function ProjectSetupStep({ coreContext }: StepComponentProps) {
    const { next, updateContext } = useOnboarding()
    const [projectName, setProjectNameLocal] = useState<string>(coreContext.flowData?.projectName || '')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleCreateProject = async () => {
        if (!projectName.trim()) {
            setError('Project name is required')
            return
        }

        if (projectName.trim().length < 2) {
            setError('Project name must be at least 2 characters')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            // You can add your project creation logic here
            // For example, making an API call to create a project

            updateContext({ flowData: { projectName: projectName.trim() } })
            next()
        } catch (error) {
            console.error('Failed to create project:', error)
            setError('Failed to create project. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setProjectNameLocal(value)
        if (error) setError('')
    }

    const isValid = projectName.trim().length >= 2

    return (
        <>
            <CardHeader className="text-center pb-6">
                <div className="size-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <FolderPlusIcon className="size-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Let&#39;s Name Your First Project</CardTitle>
                <p className="text-muted-foreground mt-2">Organize your project assets and keep everything tidy</p>
            </CardHeader>

            <div className="space-y-6">
                <div className="space-y-3">
                    <Label htmlFor="projectName" className="text-base font-medium">
                        Project Name
                    </Label>
                    <Input
                        id="projectName"
                        autoFocus
                        placeholder="e.g., 'Summer Collection 2025' or 'My First Product Line'"
                        value={projectName}
                        onChange={handleInputChange}
                        className={`text-base h-12 ${error ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                        💡 <strong>Tip:</strong> You can always create more projects later and organize your products
                        however you like.
                    </p>
                </div>

                <Button onClick={handleCreateProject} disabled={!isValid || isLoading} size="lg" className="w-full">
                    {isLoading ? (
                        'Creating Project...'
                    ) : (
                        <>
                            Create Project
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>

                <div className="text-center">
                    <p className="text-xs text-muted-foreground">This will be your workspace for organizing products</p>
                </div>
            </div>
        </>
    )
}
