'use client'

import Image from 'next/image'
import clsx from 'clsx'
import { getProfileUrl } from '@/lib/cloudinary'

type AvatarProps = {
  name?: string | null
  cloudinaryPublicId?: string
  imageUrl?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  rounded?: 'full' | 'lg'
  className?: string
  fallbackClassName?: string
}

const SIZE_CLASSES = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-2xl',
  lg: 'h-16 w-16 text-2xl',
}

const SIZE_PIXELS = {
  sm: '40px',
  md: '56px',
  lg: '64px',
}

export default function Avatar({
  name,
  cloudinaryPublicId,
  imageUrl,
  alt,
  size = 'md',
  rounded = 'lg',
  className,
  fallbackClassName,
}: AvatarProps) {
  const label = name || 'Member'
  const initial = label.charAt(0).toUpperCase() || '?'
  const src = imageUrl || (cloudinaryPublicId ? getProfileUrl(cloudinaryPublicId) : '')

  return (
    <div
      className={clsx(
        'relative shrink-0 overflow-hidden bg-earth-500 text-white',
        SIZE_CLASSES[size],
        rounded === 'full' ? 'rounded-full' : 'rounded-lg',
        className
      )}
      aria-label={alt || `${label} avatar`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt || `${label} profile photo`}
          fill
          sizes={SIZE_PIXELS[size]}
          className="object-cover"
        />
      ) : (
        <div
          className={clsx(
            'flex h-full w-full items-center justify-center font-display',
            fallbackClassName
          )}
        >
          {initial}
        </div>
      )}
    </div>
  )
}
