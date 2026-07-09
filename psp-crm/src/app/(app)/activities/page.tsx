import { redirect } from 'next/navigation';

/** Activities merged into My Day (tasks + touch log + recent history live
 *  there now) — old links and bookmarks land safely. */
export default function ActivitiesRedirect() {
  redirect('/my-day');
}
