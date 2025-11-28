import { createSupabaseClient } from "@/lib/supabaseClient";

type Project = {
  id: number;
  name: string;
};

async function loadProjects() {
  const hasEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasEnv) {
    return { configured: false, projects: [] as Project[], error: null as string | null };
  }

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .order("id", { ascending: true })
      .limit(5);

    return {
      configured: true,
      projects: data ?? [],
      error: error?.message ?? null,
    };
  } catch (error) {
    return {
      configured: true,
      projects: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default async function Home() {
  const { configured, projects, error } = await loadProjects();

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-sky-50 px-6 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white/80 p-10 shadow-xl backdrop-blur">
        <div className="mb-10 flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-600">
            Quiz Tracker
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Next.js + Tailwind + Supabase starter
          </h1>
          <p className="text-lg text-zinc-600">
            Your stack is wired up and ready. Add your Supabase URL and anon key
            to start reading and writing data.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              Connection status
            </h2>
            {!configured && (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to a{" "}
                <code>.env.local</code> file, then restart <code>npm run dev</code>.
              </div>
            )}
            {configured && !error && (
              <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Connected. Update the query below to match your schema.
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-lg border border-dashed border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Supabase responded with: {error}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Sample query
            </h2>
            <p className="mb-3 text-sm text-zinc-600">
              We fetch a few rows from a <code>projects</code> table. Replace this
              with your own tables or RPC calls.
            </p>
            <div className="space-y-2 text-sm">
              {projects.length === 0 && (
                <p className="text-zinc-500">No rows yet.</p>
              )}
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-800"
                >
                  <span className="font-medium">#{project.id}</span>
                  <span>{project.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 rounded-xl border border-sky-100 bg-sky-50/80 p-6 text-sm text-sky-900">
          <div className="font-semibold uppercase tracking-[0.15em] text-sky-700">
            Quick setup
          </div>
          <div>
            1) Create a <code>.env.local</code> file with your Supabase project values.<br />
            2) Restart the dev server.<br />
            3) Swap the <code>projects</code> query in <code>src/app/page.tsx</code> for your own tables.
          </div>
        </div>
      </div>
    </main>
  );
}
