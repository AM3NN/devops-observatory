import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plug,
  Copy,
  Check,
  Plus,
  Activity,
  Clock,
  Terminal,
  Zap,
  FileText,
  BarChart2,
  GitBranch,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
const API_BASE = "/api";

interface Agent {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  status: "active" | "inactive";
  host: string | null;
  language: string | null;
  lastSeen: string | null;
  totalLogs: number;
  totalMetrics: number;
  totalTraces: number;
  createdAt: string;
}

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/ingest/agents`);
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

async function registerAgent(data: { name: string; description: string; host: string; language: string }): Promise<Agent> {
  const res = await fetch(`${API_BASE}/ingest/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to register agent");
  return res.json();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200">
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-black/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
        <span className="text-xs font-mono text-slate-400">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const [showKey, setShowKey] = useState(false);
  const isRecent = agent.lastSeen
    ? Date.now() - new Date(agent.lastSeen).getTime() < 5 * 60_000
    : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/60 border border-white/5 rounded-2xl p-5 hover:border-primary/20 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Plug className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">{agent.name}</h3>
            <p className="text-xs text-slate-500">{agent.description || "Aucune description"}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
          isRecent
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRecent ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
          {isRecent ? "Actif" : "Inactif"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: FileText, label: "Logs", value: agent.totalLogs.toLocaleString() },
          { icon: BarChart2, label: "Métriques", value: agent.totalMetrics.toLocaleString() },
          { icon: GitBranch, label: "Traces", value: agent.totalTraces.toLocaleString() },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-background/50 rounded-xl p-3 text-center">
            <Icon className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
            <p className="text-sm font-bold text-slate-200">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* API Key */}
      <div className="bg-background/50 rounded-xl p-3 border border-white/5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 font-mono">API KEY</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-xs text-primary hover:underline"
            >
              {showKey ? "Masquer" : "Afficher"}
            </button>
            <CopyButton text={agent.apiKey} />
          </div>
        </div>
        <p className="text-xs font-mono text-slate-300 truncate">
          {showKey ? agent.apiKey : "•".repeat(Math.min(agent.apiKey.length, 32))}
        </p>
      </div>

      {/* Meta */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        {agent.host && <span>🖥 {agent.host}</span>}
        {agent.language && <span>⚡ {agent.language}</span>}
        {agent.lastSeen && (
          <span className="ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(agent.lastSeen).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function RegisterModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (agent: Agent) => void }) {
  const [form, setForm] = useState({ name: "", description: "", host: "", language: "Node.js" });
  const mutation = useMutation({ mutationFn: registerAgent, onSuccess });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-md"
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-1">Nouvel agent</h2>
        <p className="text-sm text-slate-500 mb-5">Une clé API unique sera générée automatiquement.</p>

        <div className="space-y-4">
          {[
            { key: "name", label: "Nom du service *", placeholder: "ex: mon-api-node" },
            { key: "description", label: "Description", placeholder: "ex: API backend de production" },
            { key: "host", label: "Hôte / IP", placeholder: "ex: 192.168.1.10 ou mon-serveur.com" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">{label}</label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full bg-background/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-primary/40 placeholder-slate-600"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Langage</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="w-full bg-background/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-primary/40"
            >
              {["Node.js", "Python", "Java", "Go", "PHP", "Ruby", "Rust", "C#", "Autre"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:bg-white/5 transition"
          >
            Annuler
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={!form.name || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition disabled:opacity-40"
          >
            {mutation.isPending ? "Création..." : "Créer l'agent"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const DEMO_KEY = "obs-key-pfe-demo-2024";

const nodeExample = `// npm install node-fetch
const fetch = require('node-fetch');

const OBSERVATORY_URL = '${typeof window !== "undefined" ? window.location.origin : ""}/api';
const API_KEY = '${DEMO_KEY}';

// Envoyer des logs
await fetch(\`\${OBSERVATORY_URL}/ingest/logs\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    logs: [
      {
        level: 'INFO',
        service: 'mon-service',
        message: 'Utilisateur connecté avec succès',
        environment: 'production',
        metadata: { userId: '123', ip: '10.0.0.1' }
      },
      {
        level: 'ERROR',
        service: 'mon-service',
        message: 'Connexion DB échouée: timeout après 5s',
        environment: 'production'
      }
    ]
  })
});`;

const curlExample = `# Envoyer un log simple
curl -X POST /api/ingest/logs \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${DEMO_KEY}" \\
  -d '{
    "logs": [{
      "level": "ERROR",
      "service": "mon-api",
      "message": "Timeout connexion base de données",
      "environment": "production",
      "metadata": { "db": "postgres", "timeout": 5000 }
    }]
  }'

# Envoyer des métriques APM
curl -X POST /api/ingest/metrics \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${DEMO_KEY}" \\
  -d '{
    "service": "mon-api",
    "responseTime": 142,
    "throughput": 350,
    "errorRate": 1.2,
    "cpuUsage": 45,
    "memoryUsage": 62,
    "activeConnections": 28
  }'`;

const pythonExample = `import requests

OBSERVATORY_URL = "/api"
API_KEY = "${DEMO_KEY}"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY
}

# Envoyer des logs
requests.post(f"{OBSERVATORY_URL}/ingest/logs", headers=headers, json={
    "logs": [
        {
            "level": "WARN",
            "service": "mon-service-python",
            "message": "Mémoire heap proche du maximum: 87%",
            "environment": "production",
            "metadata": {"heap_mb": 1740, "max_mb": 2000}
        }
    ]
})

# Envoyer des traces
requests.post(f"{OBSERVATORY_URL}/ingest/traces", headers=headers, json={
    "spans": [{
        "traceId": "abc123",
        "spanId": "span001",
        "service": "mon-service-python",
        "operation": "processOrder",
        "duration": 345,
        "status": "ok",
        "tags": {"order.id": "ORD-789", "user.id": "usr-456"}
    }]
})`;

export default function Agents() {
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState<"node" | "curl" | "python">("curl");
  const [newAgent, setNewAgent] = useState<Agent | null>(null);

  const { data: agents = [], isLoading, refetch } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    refetchInterval: 30_000,
  });

  const handleRegisterSuccess = (agent: Agent) => {
    setShowRegister(false);
    setNewAgent(agent);
    queryClient.invalidateQueries({ queryKey: ["agents"] });
  };

  const codeExamples = { node: nodeExample, curl: curlExample, python: pythonExample };
  const tabLabels = { node: "Node.js", curl: "cURL", python: "Python" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 font-display">Agents d'Ingestion</h1>
          <p className="text-slate-500 text-sm mt-1">
            Connectez n'importe quel service externe à l'observatoire via l'API d'ingestion
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nouvel agent
          </button>
        </div>
      </div>

      {/* New agent success banner */}
      {newAgent && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-start gap-3"
        >
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-300">Agent « {newAgent.name} » créé avec succès</p>
            <p className="text-xs text-slate-400 mt-1">Copiez votre clé API — elle ne sera plus affichée en clair.</p>
            <div className="flex items-center gap-2 mt-2 bg-black/30 rounded-lg px-3 py-2">
              <code className="text-xs font-mono text-green-300 flex-1">{newAgent.apiKey}</code>
              <CopyButton text={newAgent.apiKey} />
            </div>
          </div>
          <button onClick={() => setNewAgent(null)} className="text-slate-500 hover:text-slate-300">✕</button>
        </motion.div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Agents enregistrés", value: agents.length, icon: Plug, color: "text-primary" },
          { label: "Agents actifs", value: agents.filter(a => a.lastSeen && Date.now() - new Date(a.lastSeen).getTime() < 5 * 60_000).length, icon: Activity, color: "text-green-400" },
          { label: "Logs ingérés", value: agents.reduce((s, a) => s + a.totalLogs, 0).toLocaleString(), icon: FileText, color: "text-blue-400" },
          { label: "Traces ingérées", value: agents.reduce((s, a) => s + a.totalTraces, 0).toLocaleString(), icon: GitBranch, color: "text-purple-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card/60 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Agents list */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Agents connectés</h2>
          {isLoading ? (
            <div className="text-center text-slate-500 py-8">Chargement...</div>
          ) : agents.length === 0 ? (
            <div className="text-center text-slate-500 py-8">Aucun agent enregistré</div>
          ) : (
            agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
          )}
        </div>

        {/* Right: Code examples */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Guide d'intégration</h2>
            <div className="flex gap-1 bg-background/50 rounded-xl p-1 border border-white/5">
              {(["curl", "node", "python"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === tab ? "bg-primary text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>
          </div>

          <CodeBlock code={codeExamples[activeTab]} lang={tabLabels[activeTab]} />

          {/* Endpoint reference */}
          <div className="bg-card/60 border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Référence des endpoints
            </h3>
            <div className="space-y-2">
              {[
                { method: "POST", path: "/api/ingest/logs", desc: "Batch de logs (max 500/appel)" },
                { method: "POST", path: "/api/ingest/metrics", desc: "Snapshot métriques APM" },
                { method: "POST", path: "/api/ingest/traces", desc: "Spans distribués (max 200/appel)" },
                { method: "POST", path: "/api/ingest/heartbeat", desc: "Signal de vie de l'agent" },
                { method: "GET", path: "/api/ingest/agents", desc: "Liste des agents enregistrés" },
                { method: "POST", path: "/api/ingest/agents", desc: "Enregistrer un nouvel agent" },
              ].map(({ method, path, desc }) => (
                <div key={path} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                    method === "POST" ? "bg-blue-500/15 text-blue-400" : "bg-green-500/15 text-green-400"
                  }`}>
                    {method}
                  </span>
                  <code className="text-xs font-mono text-slate-300 shrink-0">{path}</code>
                  <span className="text-xs text-slate-500 hidden lg:block">{desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-background/50 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                Authentification : en-tête <code className="text-primary">X-API-Key: &lt;votre-clé&gt;</code> sur tous les endpoints d'ingestion
              </p>
            </div>
          </div>
        </div>
      </div>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onSuccess={handleRegisterSuccess} />}
    </div>
  );
}
