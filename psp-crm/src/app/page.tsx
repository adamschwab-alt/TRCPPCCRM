import { redirect } from 'next/navigation';

export default function Home() {
  // The proxy gates auth + MFA; land everyone on the dashboard.
  redirect('/dashboard');
}
