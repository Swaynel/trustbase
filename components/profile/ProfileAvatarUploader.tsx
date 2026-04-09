'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'

type ProfileAvatarUploaderProps = {
  displayName: string
  cloudinaryProfileId?: string
  imageUrl?: string
}

export default function ProfileAvatarUploader({
  displayName,
  cloudinaryProfileId,
  imageUrl,
}: ProfileAvatarUploaderProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [currentCloudinaryId, setCurrentCloudinaryId] = useState(cloudinaryProfileId)
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl || '')

  async function handleFileChange(file: File) {
    setUploading(true)
    setError('')

    try {
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'trustbase/profiles' }),
      })

      if (!signRes.ok) {
        throw new Error('Could not prepare upload')
      }

      const { timestamp, signature, apiKey, cloudName, folder } = await signRes.json()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error('Upload failed')
      }

      const uploadData = await uploadRes.json()

      const saveRes = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudinaryPublicId: uploadData.public_id }),
      })

      if (!saveRes.ok) {
        throw new Error('Could not save avatar')
      }

      setCurrentCloudinaryId(uploadData.public_id)
      setCurrentImageUrl(uploadData.secure_url)
      router.refresh()
    } catch {
      setError('Image upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-14 w-14 flex-shrink-0">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative h-full w-full"
          aria-label="Upload profile photo"
          disabled={uploading}
        >
          <Avatar
            name={displayName}
            cloudinaryPublicId={currentCloudinaryId}
            imageUrl={currentImageUrl}
            size="md"
            rounded="lg"
            className="h-full w-full"
          />

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/35">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Add or change profile photo"
          className="absolute bottom-0 right-0 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-earth-600 text-white shadow-sm transition-colors hover:bg-earth-700 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={uploading}
        >
          <Plus className="h-3 w-3" />
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              void handleFileChange(file)
            }
            event.target.value = ''
          }}
        />
      </div>

      {error ? <p className="max-w-40 text-[11px] leading-relaxed text-red-600">{error}</p> : null}
    </div>
  )
}
