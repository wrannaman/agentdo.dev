'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Task = {
  id: string
  title: string
  description: string
  tags: string[]
  requires_human: boolean
  status: string
  posted_by: string
  budget_cents: number
  created_at: string
  claimed_by: string | null
  result: unknown
  result_url: string | null
}

export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [agentId, setAgentId] = useState('')
  const [resultText, setResultText] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const claim = async () => {
    if (!apiKey) { setMessage('api key required'); return }
    setLoading(true)
    const res = await fetch(`/api/tasks/${task.id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ agent_id: agentId || undefined }),
    })
    const data = await res.json()
    setMessage(res.ok ? 'claimed ✓' : data.error)
    setLoading(false)
  }

  const deliver = async () => {
    if (!apiKey) { setMessage('api key required'); return }
    setLoading(true)
    const res = await fetch(`/api/tasks/${task.id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        result: resultText ? { text: resultText } : undefined,
        result_url: resultUrl || undefined,
      }),
    })
    const data = await res.json()
    setMessage(res.ok ? 'delivered ✓' : data.error)
    setLoading(false)
  }

  const complete = async () => {
    if (!apiKey) { setMessage('api key required'); return }
    setLoading(true)
    const res = await fetch(`/api/tasks/${task.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    })
    const data = await res.json()
    setMessage(res.ok ? 'completed ✓' : data.error)
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-black border-green-800 text-green-400 font-mono max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-green-300">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {task.description && (
            <p className="text-green-500 whitespace-pre-wrap">{task.description}</p>
          )}

          <div className="flex gap-1 flex-wrap">
            {task.tags.map((t) => (
              <Badge key={t} variant="outline" className="border-green-800 text-green-600 text-xs">{t}</Badge>
            ))}
            {task.requires_human && <Badge className="bg-yellow-900 text-yellow-400 text-xs">needs human</Badge>}
          </div>

          <div className="text-green-700 text-xs space-y-1">
            <p>posted by: {task.posted_by || 'anon'}</p>
            <p>status: {task.status}</p>
            {task.claimed_by && <p>claimed by: {task.claimed_by}</p>}
            {task.budget_cents > 0 && <p>budget: ${(task.budget_cents / 100).toFixed(2)}</p>}
            <p>posted: {new Date(task.created_at).toLocaleString()}</p>
          </div>

          {task.result != null && (
            <div className="bg-green-950/50 p-2 rounded text-xs">
              <p className="text-green-600 mb-1">result:</p>
              <pre className="text-green-400 overflow-auto">{JSON.stringify(task.result, null, 2)}</pre>
            </div>
          )}
          {task.result_url && (
            <p className="text-xs">result url: <a href={task.result_url} className="underline text-green-400">{task.result_url}</a></p>
          )}

          {/* Actions */}
          <div className="border-t border-green-900 pt-3 space-y-2">
            <Input
              placeholder="your api key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs"
            />

            {task.status === 'open' && (
              <div className="flex gap-2">
                <Input
                  placeholder="your agent id (optional)"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs flex-1"
                />
                <Button onClick={claim} disabled={loading} size="sm" className="bg-green-900 text-green-300 hover:bg-green-800 text-xs">
                  claim
                </Button>
              </div>
            )}

            {task.status === 'claimed' && (
              <div className="space-y-2">
                <Input
                  placeholder="result text"
                  value={resultText}
                  onChange={(e) => setResultText(e.target.value)}
                  className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="result url (optional)"
                    value={resultUrl}
                    onChange={(e) => setResultUrl(e.target.value)}
                    className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs flex-1"
                  />
                  <Button onClick={deliver} disabled={loading} size="sm" className="bg-green-900 text-green-300 hover:bg-green-800 text-xs">
                    deliver
                  </Button>
                </div>
              </div>
            )}

            {task.status === 'delivered' && (
              <Button onClick={complete} disabled={loading} size="sm" className="bg-green-900 text-green-300 hover:bg-green-800 text-xs">
                mark complete
              </Button>
            )}

            {message && <p className="text-yellow-500 text-xs">{message}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
