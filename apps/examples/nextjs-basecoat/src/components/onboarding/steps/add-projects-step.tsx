"use client";

import { XIcon, YoutubeIcon } from "lucide-react";
import StepLayout from "../StepLayout";
import Link from "next/link";
import { StepComponentProps, useOnboarding } from "@onboardjs/react";
import { useRef } from "react";
import { Project } from "@/types/Project";

const Aside = () => (
  <div>
    <h3 className="text-lg font-semibold">
      Identify your key project to track in Increaser
    </h3>
    <p className="text-muted mt-6">
      Begin by adding projects that represent your focused endeavors. These
      projects will help you organize your tasks and goals effectively.
    </p>

    <Link
      href="https://youtube.com"
      target="_blank"
      className="px-5 py-5.5 mt-10 bg-zinc-900 rounded-lg flex items-center gap-x-4"
    >
      <YoutubeIcon className="size-8" />{" "}
      <span className="tracking-wide font-semibold">
        Watch a video to learn more
      </span>
    </Link>
  </div>
);

export default function AddProjectsStep({ coreContext }: StepComponentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateContext } = useOnboarding();

  const addProject = () => {
    if (!inputRef.current) return;
    const projectName = inputRef.current?.value.trim();
    if (projectName) {
      updateContext({
        flowData: {
          projects: [
            ...(coreContext.flowData.projects ?? []),
            { name: projectName, tasks: [] },
          ],
        },
      });

      inputRef.current.value = ""; // Clear the input after adding
    }
  };

  const removeProject = (name: string) => {
    updateContext({
      flowData: {
        projects: coreContext.flowData.projects?.filter(
          (project: Project) => project.name !== name,
        ),
      },
    });
  };

  return (
    <StepLayout aside={<Aside />}>
      <h2 className="text-2xl font-bold">Add Projects</h2>
      <p className="text-muted mt-2">
        Start by adding your projects to get organized and focused.
      </p>

      <div className="mt-12 space-y-6">
        <div className="grid gap-3">
          <label className="label" htmlFor="project-name">
            Project name
          </label>
          <input
            className="input"
            id="project-name"
            type="text"
            placeholder="Project name"
            autoFocus
            ref={inputRef}
          />

          <button className="btn btn-primary mt-8" onClick={addProject}>
            Add Project
          </button>
        </div>

        <div className="mt-24">
          <h3 className="text-lg font-semibold">Your Projects</h3>
          <ul className="mt-4 space-x-2 flex items-center">
            {coreContext.flowData.projects &&
            coreContext.flowData.projects.length > 0 ? (
              <>
                {coreContext.flowData.projects.map(
                  (project: Project, index: number) => (
                    <li
                      key={index}
                      className="pl-4 pr-0.5 bg-zinc-900 rounded-lg flex items-center justify-between gap-x-4"
                    >
                      <p className="text-sm ">{project.name}</p>
                      <button
                        className="btn-ghost"
                        onClick={() => removeProject(project.name)}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </li>
                  ),
                )}
              </>
            ) : (
              <p className="text-muted">No projects added yet.</p>
            )}
          </ul>
        </div>
      </div>
    </StepLayout>
  );
}
