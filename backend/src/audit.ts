import { Request } from "express";
import { prisma } from "./db";

export type AuditEvent =
  | "login.success"
  | "login.failed"
  | "login.locked"
  | "logout.all"
  | "password.changed"
  | "password.reset.requested"
  | "password.reset.completed"
  | "user.created"
  | "user.deactivated"
  | "user.role_changed"
  | "user.password_reset_by_admin"
  | "invitation.sent"
  | "invitation.accepted"
  | "invitation.revoked"
  | "profile.updated"
  | "2fa.enrolled"
  | "2fa.disabled"
  | "settings.updated";

interface LogArgs {
  event: AuditEvent;
  userId?: number | null;
  actorLabel?: string | null;
  targetType?: string;
  targetId?: string | number;
  meta?: Record<string, any>;
  req?: Request;
}

export async function audit(args: LogArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        event: args.event,
        userId: args.userId ?? null,
        actorLabel: args.actorLabel ?? null,
        targetType: args.targetType ?? null,
        targetId: args.targetId !== undefined ? String(args.targetId) : null,
        ip: args.req
          ? (args.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
            args.req.socket.remoteAddress ||
            null
          : null,
        userAgent: args.req ? (args.req.headers["user-agent"] as string) || null : null,
        meta: args.meta ? args.meta : undefined,
      },
    });
  } catch (e) {
    // Never let audit logging break a request
    console.error("audit log failed:", e);
  }
}
