/** Name-first rep roster: placeholder email domain for reps added before their
 *  real login exists (beta flow). Connecting a real email replaces it. */
export const PENDING_EMAIL_DOMAIN = 'pending.pspcrm.local';

export const isPendingEmail = (email: string) => email.endsWith(`@${PENDING_EMAIL_DOMAIN}`);
