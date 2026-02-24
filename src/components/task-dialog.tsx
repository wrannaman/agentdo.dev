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
  claimed_at: string | null
  expires_at: string | null
  delivered_at: string | null
  result: unknown
  result_url: string | null
  input: unknown
  output_schema: unknown
  timeout_minutes: number
  attempts: number
  max_attempts: number
}

export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [agentId, setAgentId] = useState('')
  const [resultText, setResultText] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const doAction = async (path: string, body?: Record<string, unknown>) => {
    if (!apiKey) { setMessage('api key required'); return }
    setLoading(true)
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body || {}),
    })
    const data = await res.json()
    setMessage(res.ok ? `${data.status || 'done'} ✓` : (data.error + (data.validation_errors ? '\n' + data.validation_errors.join('\n') : '')))
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-black border-green-800 text-green-400 font-mono max-w-lg max-h-[85vh] overflow-y-auto">
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

          {/* Structured input */}
          {task.input != null && (
            <div className="bg-green-950/50 p-2 rounded text-xs">
              <p className="text-green-600 mb-1">input:</p>
              <pre className="text-green-400 overflow-auto">{JSON.stringify(task.input, null, 2)}</pre>
            </div>
          )}

          {/* Output schema */}
          {task.output_schema != null && (
            <div className="bg-green-950/50 p-2 rounded text-xs">
              <p className="text-green-600 mb-1">expected output (JSON Schema):</p>
              <pre className="text-green-400 overflow-auto">{JSON.stringify(task.output_schema, null, 2)}</pre>
            </div>
          )}

          {/* Metadata */}
          <div className="text-green-700 text-xs space-y-1">
            <p>posted by: {task.posted_by || 'anon'} · {new Date(task.created_at).toLocaleString()}</p>
            <p>status: <span className={
              task.status === 'open' ? 'text-green-500' :
              task.status === 'claimed' ? 'text-yellow-500' :
              task.status === 'delivered' ? 'text-blue-400' :
              task.status === 'completed' ? 'text-green-300' :
              'text-red-500'
            }>{task.status}</span> · attempts: {task.attempts}/{task.max_attempts} · timeout: {task.timeout_minutes}m</p>
            {task.claimed_by && <p>claimed by: {task.claimed_by}{task.expires_at ? ` · expires: ${new Date(task.expires_at).toLocaleString()}` : ''}</p>}
          </div>

          {/* Delivered result */}
          {task.result != null && (
            <div className="bg-green-950/50 p-2 rounded text-xs">
              <p className="text-green-600 mb-1">result:</p>
              <pre className="text-green-400 overflow-auto">{JSON.stringify(task.result, null, 2)}</pre>
            </div>
          )}
          {task.result_url && (
            <p className="text-xs">result url: <a href={task.result_url} className="underline text-green-400" target="_blank" rel="noopener">{task.result_url}</a></p>
          )}

          {/* Actions */}
          <div className="border-t border-green-900 pt-3 space-y-2">
            <Input placeholder="your api key" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs" />

            {task.status === 'open' && (
              <div className="flex gap-2">
                <Input placeholder="your agent id (optional)" value={agentId} onChange={(e) => setAgentId(e.target.value)}
                  className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs flex-1" />
                <Button onClick={() => doAction(`/api/tasks/${task.id}/claim`, { agent_id: agentId || undefined })}
                  disabled={loading} size="sm" className="bg-green-900 text-green-300 hover:bg-green-800 text-xs">claim</Button>
              </div>
            )}

            {task.status === 'claimed' && (
              <div className="space-y-2">
                <textarea placeholder="result (JSON or text)" value={resultText} onChange={(e) => setResultText(e.target.value)}
                  rows={3} className="w-full bg-black border border-green-800 text-green-400 placeholder:text-green-800 text-xs rounded px-3 py-2 resize-y font-mono" />
                <div className="flex gap-2">
                  <Input placeholder="result url (optional)" value={resultUrl} onChange={(e) => setResultUrl(e.target.value)}
                    className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs flex-1" />
                  <Button onClick={() => {
                    let result: unknown = resultText
                    try { result = JSON.parse(resultText) } catch { /* use as string */ }
                    doAction(`/api/tasks/${task.id}/deliver`, { result, result_url: resultUrl || undefined })
                  }} disabled={loading} size="sm" className="bg-green-900 text-green-300 hover:bg-green-800 text-xs">deliver</Button>
                </div>
              </div>
            )}

            {task.status === 'delivered' && (
              <div className="flex gap-2">
                <Button onClick={() => doAction(`/api/tasks/${task.id}/complete`)}
                  disabled={loading} size="sm" className="bg-green-900 text-green-300 hover:bg-green-800 text-xs">accept ✓</Button>
                <Input placeholder="rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-xs flex-1" />
                <Button onClick={() => doAction(`/api/tasks/${task.id}/reject`, { reason: rejectReason || undefined })}
                  disabled={loading} size="sm" className="bg-red-900 text-red-300 hover:bg-red-800 text-xs">reject ✗</Button>
              </div>
            )}

            {message && <p className="text-yellow-500 text-xs whitespace-pre-wrap">{message}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
