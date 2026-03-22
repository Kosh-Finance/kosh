import { redirect } from 'next/navigation';

// The app has no landing page — kosh.finance serves that purpose.
// Redirect immediately to the circles dashboard.
export default function RootPage() {
  redirect('/circles');
}
