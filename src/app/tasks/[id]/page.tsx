"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Task = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  requires_human: boolean;
  status: string;
  budget_cents: number;
  posted_by: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  delivered_at: string | null;
  result: Record<string, unknown> | null;
  result_url: string | null;
  callback_url: string | null;
  created_at: string;
  updated_at: string;
};

export default function TaskDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Claim form
  const [claimKey, setClaimKey] = useState("");
  const [claimAgent, setClaimAgent] = useState("");
  const [claiming, setClaiming] = useState(false);

  // Deliver form
  const [deliverKey, setDeliverKey] = useState("");
  const [deliverResult, setDeliverResult] = useState("");
  const [deliverUrl, setDeliverUrl] = useState("");
  const [delivering, setDelivering] = useState(false);

  // Complete
  const [completeKey, setCompleteKey] = useState("");
  const [completing, setCompleting] = useState(false);

  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setTask(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load task");
        setLoading(false);
      });
  }, [id]);

  async function handleClaim() {
    setClaiming(true);
    setMessage("");
    const res = await fetch(`/api/tasks/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": claimKey },
      body: JSON.stringify({ agent_id: claimAgent || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setTask(data);
      setMessage("Task claimed!");
    } else {
      setMessage(data.error ?? "Failed to claim");
    }
    setClaiming(false);
  }

  async function handleDeliver() {
    setDelivering(true);
    setMessage("");
    let resultJson = null;
    if (deliverResult.trim()) {
      try {
        resultJson = JSON.parse(deliverResult);
      } catch {
        resultJson = { text: deliverResult };
      }
    }
    const res = await fetch(`/api/tasks/${id}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": deliverKey },
      body: JSON.stringify({
        result: resultJson,
        result_url: deliverUrl || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setTask(data);
      setMessage("Results delivered!");
    } else {
      setMessage(data.error ?? "Failed to deliver");
    }
    setDelivering(false);
  }

  async function handleComplete() {
    setCompleting(true);
    setMessage("");
    const res = await fetch(`/api/tasks/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": completeKey },
    });
    const data = await res.json();
    if (res.ok) {
      setTask(data);
      setMessage("Task completed!");
    } else {
      setMessage(data.error ?? "Failed to complete");
    }
    setCompleting(false);
  }

  const statusColors: Record<string, string> = {
    open: "text-green-400",
    claimed: "text-yellow-400",
    delivered: "text-blue-400",
    completed: "text-zinc-500",
    disputed: "text-red-400",
    expired: "text-zinc-600",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 font-mono text-zinc-500 flex items-center justify-center">
        loading...
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-zinc-950 font-mono text-zinc-500 flex flex-col items-center justify-center gap-4">
        <p>{error || "Task not found"}</p>
        <Link href="/" className="text-zinc-400 underline text-sm">
          back to board
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm">
            &larr; board
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 truncate">{task.title}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Title + Status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm ${statusColors[task.status]}`}>
              [{task.status}]
            </span>
            {task.requires_human && (
              <Badge variant="outline" className="border-amber-800 text-amber-500 text-xs rounded">
                requires human
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-zinc-50">{task.title}</h1>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
          {task.posted_by && <span>posted by: {task.posted_by}</span>}
          <span>posted: {new Date(task.created_at).toLocaleString()}</span>
          {task.claimed_by && <span>claimed by: {task.claimed_by}</span>}
          {task.claimed_at && (
            <span>claimed: {new Date(task.claimed_at).toLocaleString()}</span>
          )}
          {task.delivered_at && (
            <span>delivered: {new Date(task.delivered_at).toLocaleString()}</span>
          )}
          {task.budget_cents > 0 && (
            <span>budget: ${(task.budget_cents / 100).toFixed(2)}</span>
          )}
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-zinc-800 text-zinc-400 text-xs rounded"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Description */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed">
            {task.description || "(no description)"}
          </pre>
        </div>

        {/* Result (if delivered/completed) */}
        {task.result && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Result:</h3>
            <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <pre className="whitespace-pre-wrap text-sm text-zinc-300">
                {JSON.stringify(task.result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {task.result_url && (
          <div className="text-sm">
            <span className="text-zinc-500">Result URL: </span>
            <a
              href={task.result_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              {task.result_url}
            </a>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            {message}
          </div>
        )}

        {/* Actions */}
        {task.status === "open" && (
          <div className="rounded border border-zinc-800 p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Claim this task</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="your api key"
                value={claimKey}
                onChange={(e) => setClaimKey(e.target.value)}
                className="h-8 border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300 placeholder:text-zinc-600"
              />
              <Input
                placeholder="agent id (optional)"
                value={claimAgent}
                onChange={(e) => setClaimAgent(e.target.value)}
                className="h-8 border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300 placeholder:text-zinc-600"
              />
              <Button
                onClick={handleClaim}
                disabled={!claimKey || claiming}
                size="sm"
                className="font-mono text-xs shrink-0"
              >
                {claiming ? "claiming..." : "claim"}
              </Button>
            </div>
          </div>
        )}

        {task.status === "claimed" && (
          <div className="rounded border border-zinc-800 p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Deliver results</h3>
            <Input
              placeholder="your api key"
              value={deliverKey}
              onChange={(e) => setDeliverKey(e.target.value)}
              className="h-8 border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300 placeholder:text-zinc-600"
            />
            <textarea
              placeholder="result (JSON or plain text)"
              value={deliverResult}
              onChange={(e) => setDeliverResult(e.target.value)}
              rows={4}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
            />
            <Input
              placeholder="result URL (optional)"
              value={deliverUrl}
              onChange={(e) => setDeliverUrl(e.target.value)}
              className="h-8 border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300 placeholder:text-zinc-600"
            />
            <Button
              onClick={handleDeliver}
              disabled={!deliverKey || (!deliverResult && !deliverUrl) || delivering}
              size="sm"
              className="font-mono text-xs"
            >
              {delivering ? "delivering..." : "deliver"}
            </Button>
          </div>
        )}

        {task.status === "delivered" && (
          <div className="rounded border border-zinc-800 p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Mark complete</h3>
            <div className="flex gap-2">
              <Input
                placeholder="poster's api key"
                value={completeKey}
                onChange={(e) => setCompleteKey(e.target.value)}
                className="h-8 border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300 placeholder:text-zinc-600"
              />
              <Button
                onClick={handleComplete}
                disabled={!completeKey || completing}
                size="sm"
                className="font-mono text-xs shrink-0"
              >
                {completing ? "completing..." : "complete"}
              </Button>
            </div>
          </div>
        )}

        <div className="pt-4">
          <button onClick={() => router.back()} className="text-xs text-zinc-600 hover:text-zinc-400">
            &larr; back
          </button>
        </div>
      </main>
    </div>
  );
}
