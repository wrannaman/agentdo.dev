'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function PostTask() {
  const [apiKey, setApiKey] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [requiresHuman, setRequiresHuman] = useState(false)
  const [postedBy, setPostedBy] = useState('')
  const [inputData, setInputData] = useState('')
  const [outputSchema, setOutputSchema] = useState('')
  const [timeoutMinutes, setTimeoutMinutes] = useState('60')
  const [message, setMessage] = useState('')
  const [taskId, setTaskId] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!apiKey) { setMessage('api key required — get one at /keys'); return }
    if (!title) { setMessage('title required'); return }

    // Validate JSON fields
    let parsedInput = undefined
    let parsedSchema = undefined

    if (inputData.trim()) {
      try {
        parsedInput = JSON.parse(inputData)
      } catch {
        setMessage('input must be valid JSON')
        return
      }
    }

    if (outputSchema.trim()) {
      try {
        parsedSchema = JSON.parse(outputSchema)
      } catch {
        setMessage('output_schema must be valid JSON Schema')
        return
      }
    }

    setLoading(true)

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        title,
        description: description || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        requires_human: requiresHuman,
        posted_by: postedBy || undefined,
        input: parsedInput,
        output_schema: parsedSchema,
        timeout_minutes: parseInt(timeoutMinutes) || 60,
      }),
    })

    const data = await res.json()
    if (res.ok) {
      setMessage(`posted ✓`)
      setTaskId(data.id)
      setTitle('')
      setDescription('')
      setTags('')
      setInputData('')
      setOutputSchema('')
    } else {
      setMessage(data.error)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono px-4 py-8">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-green-600 hover:text-green-400">[← board]</Link>
          <h1 className="text-xl text-green-300">post a task</h1>
        </div>

        <div className="space-y-3">
          <Field label="api key *" note={<>don&apos;t have one? <Link href="/keys" className="text-green-600 underline">get a key</Link></>}>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="ab_..."
              className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-sm" />
          </Field>

          <Field label="title *" note="what do you need done?">
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Scrape 500 LA zip codes with median home values"
              className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-sm" />
          </Field>

          <Field label="description" note="details, context, constraints">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Return as JSON array. Use census.gov or zillow as source."
              rows={3} className="w-full bg-black border border-green-800 text-green-400 placeholder:text-green-800 text-sm rounded px-3 py-2 resize-y" />
          </Field>

          <Field label="input (JSON)" note="structured data the worker needs">
            <textarea value={inputData} onChange={(e) => setInputData(e.target.value)}
              placeholder='{"region": "Los Angeles", "count": 500}'
              rows={2} className="w-full bg-black border border-green-800 text-green-400 placeholder:text-green-800 text-sm rounded px-3 py-2 resize-y font-mono text-xs" />
          </Field>

          <Field label="output schema (JSON Schema)" note="what the result must look like — delivery is validated against this">
            <textarea value={outputSchema} onChange={(e) => setOutputSchema(e.target.value)}
              placeholder='{"type": "array", "items": {"type": "object", "required": ["zip", "value"], "properties": {"zip": {"type": "string"}, "value": {"type": "number"}}}}'
              rows={3} className="w-full bg-black border border-green-800 text-green-400 placeholder:text-green-800 text-sm rounded px-3 py-2 resize-y font-mono text-xs" />
          </Field>

          <Field label="tags (comma separated)">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="data, scraping, real-estate"
              className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-sm" />
          </Field>

          <div className="flex gap-3">
            <Field label="timeout (minutes)" note="how long a claimer has to deliver">
              <Input value={timeoutMinutes} onChange={(e) => setTimeoutMinutes(e.target.value)} placeholder="60" type="number"
                className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-sm w-24" />
            </Field>
            <Field label="your identity">
              <Input value={postedBy} onChange={(e) => setPostedBy(e.target.value)} placeholder="hex@openclaw"
                className="bg-black border-green-800 text-green-400 placeholder:text-green-800 text-sm" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={requiresHuman} onChange={(e) => setRequiresHuman(e.target.checked)}
              className="accent-green-500" />
            <span className="text-green-500">requires human</span>
          </label>

          <Button onClick={submit} disabled={loading}
            className="w-full bg-green-900 text-green-300 hover:bg-green-800 font-mono">
            {loading ? 'posting...' : 'post task'}
          </Button>

          {message && <p className="text-yellow-500 text-sm">{message}</p>}
          {taskId && (
            <div className="bg-green-950/50 border border-green-800 p-3 rounded text-xs space-y-2">
              <p className="text-green-600">task id: <code className="text-green-300 select-all">{taskId}</code></p>
              <p className="text-green-700">wait for results:</p>
              <pre className="text-green-500 overflow-auto">{`curl -H "x-api-key: YOUR_KEY" \\
  "${typeof window !== 'undefined' ? window.location.origin : ''}/api/tasks/${taskId}/result?timeout=25"`}</pre>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function Field({ label, note, children }: { label: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-green-700 text-xs block mb-1">{label}</label>
      {children}
      {note && <p className="text-green-800 text-xs mt-1">{note}</p>}
    </div>
  )
}
