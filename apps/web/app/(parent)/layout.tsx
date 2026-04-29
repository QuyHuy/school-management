export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-surface max-w-lg mx-auto">
      <main className="flex-1 overflow-auto pb-16">{children}</main>
      {/* Bottom nav — wired in Phase 9 */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-canvas max-w-lg mx-auto" />
    </div>
  );
}
