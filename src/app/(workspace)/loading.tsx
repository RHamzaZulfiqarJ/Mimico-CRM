export default function WorkspaceLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse"
      aria-label="Loading workspace"
      aria-busy="true"
    >
      <div className="h-4 w-36 rounded bg-slate-200" />
      <div className="mt-4 h-9 w-56 rounded bg-sky-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-lg bg-white shadow-sm" />
        <div className="h-24 rounded-lg bg-white shadow-sm" />
        <div className="h-24 rounded-lg bg-white shadow-sm" />
      </div>
      <div className="mt-6 h-72 rounded-lg border border-gray-100 bg-white shadow-sm" />
    </div>
  );
}
