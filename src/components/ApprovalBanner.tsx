"use client";
import { useEffect, useState } from "react";
import { Alert, api } from "./ui";

/** Shows a pending-approval notice for expert/recruiter accounts awaiting admin verification. */
export default function ApprovalBanner() {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    api<{ user: { role: string; approved: boolean } }>("/api/auth/me").then(({ user }) => {
      if (!user.approved && user.role === "mentor") setPending("Your expert account is awaiting admin approval. You can complete your profile now; students will be able to find and book you once approved.");
      if (!user.approved && user.role === "recruiter") setPending("Your recruiter account is awaiting admin approval. Student profiles become visible once approved.");
    }).catch(() => {});
  }, []);
  return pending ? <div className="mb-6"><Alert kind="warn">{pending}</Alert></div> : null;
}
