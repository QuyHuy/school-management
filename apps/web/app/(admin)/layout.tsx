export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-canvas" />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-canvas flex items-center px-6" />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
