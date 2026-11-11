export function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm leading-relaxed">
      <h1 className="mb-3 text-lg font-semibold text-amber-300">Il manque la configuration</h1>
      <ol className="list-decimal space-y-2 pl-5 text-zinc-300">
        <li>Crée un projet sur supabase.com, puis colle <code>supabase/schema.sql</code> dans SQL Editor et clique Run.</li>
        <li>Copie <code>.env.example</code> en <code>.env.local</code> et remplis les clés (Supabase, Meta, Anthropic).</li>
        <li>Redémarre <code>npm run dev</code>.</li>
      </ol>
    </div>
  );
}
