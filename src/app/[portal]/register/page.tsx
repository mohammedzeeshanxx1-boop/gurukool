import { notFound } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { PORTAL_INFO, type PortalKey } from "@/lib/portals";

export default async function RegisterPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params;
  if (!(portal in PORTAL_INFO) || !PORTAL_INFO[portal as PortalKey].canRegister) notFound(); // no public admin signup
  return <AuthForm portal={portal as PortalKey} mode="register" />;
}
