import { redirect } from 'next/navigation';

/** Worklists was superseded: My Day is the action queue; its lists live on as
 *  dashboard drill-throughs (/coverage?rag=…, /accounts?filter=…). Old links
 *  and bookmarks land safely on My Day. */
export default function WorklistsRedirect() {
  redirect('/my-day');
}
