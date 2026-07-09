import { redirect } from 'next/navigation';

/** Reports merged into Call Tracking as a tab — old links land there. */
export default function ReportsRedirect() {
  redirect('/call-tracking?tab=reports');
}
