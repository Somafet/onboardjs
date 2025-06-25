import StepLayout from "../StepLayout";

export default function AddProjectsStep() {
  return (
    <StepLayout aside={<div>Project details or actions can go here</div>}>
      <h2 className="text-2xl font-bold">Add Projects</h2>
      <p className="text-gray-600">
        Start by adding your projects to get organized and focused.
      </p>
      {/* Add project form or list can go here */}
    </StepLayout>
  );
}
