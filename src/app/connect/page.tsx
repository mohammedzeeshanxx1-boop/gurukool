import { Alert, PageHeader } from "@/components/ui";

export default function ConnectPage() {
  const url = process.env.NEXT_PUBLIC_CONNECT_URL;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Connect" subtitle="Meet mentors and peers, form teams, and learn together." />
      <div className="card space-y-4 text-center">
        <div className="text-5xl">◎</div>
        <h2 className="h2">GURUKOOL Community</h2>
        <p className="text-sm text-slate-500">Join live study rooms, doubt-solving sessions and team-formation calls.</p>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">Open Connect →</a>
        ) : (
          <Alert kind="warn">Connect link not configured. Set <code>NEXT_PUBLIC_CONNECT_URL</code> in <code>.env.local</code> and restart the server.</Alert>
        )}
      </div>
    </div>
  );
}
