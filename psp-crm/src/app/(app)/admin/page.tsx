import { Placeholder } from '@/components/Placeholder';
import { requireRole } from '@/lib/auth';
export default async function Page() {
  await requireRole('admin');
  return (
    <Placeholder
      title="Admin"
      milestone="Full build · milestone 8"
      blurb="User management, targets/threshold editor, and audit-log viewer. v0 manages users via the Supabase dashboard and seeds targets; the audit_log table already exists."
    />
  );
}
