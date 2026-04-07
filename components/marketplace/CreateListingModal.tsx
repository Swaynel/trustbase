'use client'
// components/marketplace/CreateListingModal.tsx
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Upload, Loader2, Sparkles } from 'lucide-react'

export default function CreateListingModal() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [cloudinaryId, setCloudinaryId] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [form, setForm] = useState({ title: '', description: '', price: '' })

  async function handleImageUpload(file: File) {
    setUploading(true)
    try {
      // Get signed upload params
      const signRes = await fetch('/api/cloudinary/sign?folder=marketplace')
      const { timestamp, signature, apiKey, cloudName, folder } = await signRes.json()

      const fd = new FormData()
      fd.append('file', file)
      fd.append('timestamp', timestamp)
      fd.append('signature', signature)
      fd.append('api_key', apiKey)
      fd.append('folder', folder)

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST', body: fd,
      })
      const upData = await upRes.json()
      setCloudinaryId(upData.public_id)
      setPreviewUrl(upData.secure_url)
    } catch (e) {
      setError('Image upload failed. Please try again.')
    }
    setUploading(false)
  }

  async function handleCreate() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: Number(form.price),
          cloudinaryPublicId: cloudinaryId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }

      setOpen(false)
      setForm({ title: '', description: '', price: '' })
      setCloudinaryId(''); setPreviewUrl('')
      router.refresh()
    } catch (e) {
      setError('Failed to create listing.')
    }
    setLoading(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <Plus className="w-4 h-4" /> List item
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl fade-in overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-earth-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-earth-500" />
                <h2 className="font-display text-xl text-ink-900">New listing</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-earth-50 rounded-lg">
                <X className="w-4 h-4 text-earth-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Image upload */}
              <div>
                <label className="block text-xs font-medium text-earth-600 mb-1.5">Photo</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`relative h-32 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors
                    ${previewUrl ? 'border-earth-300' : 'border-earth-200 hover:border-earth-400 bg-earth-50'}`}
                >
                  {previewUrl
                    ? <img src={previewUrl} className="h-full w-full object-cover rounded-xl" />
                    : uploading
                      ? <Loader2 className="w-8 h-8 text-earth-400 animate-spin" />
                      : <div className="text-center"><Upload className="w-6 h-6 text-earth-400 mx-auto mb-1" /><p className="text-xs text-earth-400">Upload photo</p></div>
                  }
                </div>
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-earth-600 mb-1.5">Title</label>
                <input className="input" placeholder="What are you selling?"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-earth-600 mb-1.5">Description</label>
                <textarea className="input resize-none h-24" placeholder="Describe your item or service…"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-earth-600 mb-1.5">Price (KES)</label>
                <input className="input" type="number" placeholder="250"
                  value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>

              <p className="text-xs text-earth-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-earth-400" />
                AI will automatically categorise and moderate your listing
              </p>

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!form.title || !form.price || loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Publish listing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
