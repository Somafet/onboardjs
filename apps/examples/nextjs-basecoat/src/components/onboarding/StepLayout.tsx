type StepLayoutProps = {
  children: React.ReactNode;
  aside: React.ReactNode;
};

export default function StepLayout({
  children,
  aside,
}: StepLayoutProps) {
  return (
    <>
      <main className="lg:pl-72">
        <div className="xl:pr-96">
          <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
            {children}
          </div>
        </div>
      </main>

      <aside className="fixed inset-y-0 right-0 hidden w-96 overflow-y-auto border-l px-4 py-6 sm:px-6 lg:px-8 xl:block">
        {aside}
      </aside>
    </>
  );
}
