import { notFound } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { PORTAL_INFO, type PortalKey } from "@/lib/portals";

export default async function LoginPage({ params, searchParams }: { params: Promise<{ portal: string }>; searchParams: Promise<{ next?: string }> }) {
  const { portal } = await params;
  if (!(portal in PORTAL_INFO)) notFound();
  return <AuthForm portal={portal as PortalKey} mode="login" next={(await searchParams).next} />;
}
