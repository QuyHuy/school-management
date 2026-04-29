export default function LoginPage() {
  return (
    <div className="bg-canvas rounded-md shadow-card p-8">
      <h1 className="text-2xl font-bold text-ink text-display mb-2">
        School Management
      </h1>
      <p className="text-ash mb-8">Đăng nhập để tiếp tục</p>
      {/* Auth forms will be wired in Phase 7 */}
      <div className="space-y-4">
        <a
          href="/login/teacher"
          className="block w-full text-center bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-6 rounded-sm transition-colors"
        >
          Đăng nhập Giáo viên
        </a>
        <a
          href="/login/parent"
          className="block w-full text-center border border-border text-ink font-semibold py-3 px-6 rounded-sm hover:bg-surface transition-colors"
        >
          Đăng nhập Phụ huynh / Học sinh
        </a>
      </div>
    </div>
  );
}
