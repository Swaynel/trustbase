// lib/cloudinary.ts
import crypto from 'crypto'

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!
const API_KEY = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!

export function generateSignedUploadParams(folder: string, publicId?: string) {
  const timestamp = Math.round(new Date().getTime() / 1000)
  const params: Record<string, string | number> = {
    timestamp,
    folder,
    ...(publicId ? { public_id: publicId } : {}),
  }

  const sortedKeys = Object.keys(params).sort()
  const stringToSign = sortedKeys
    .map(k => `${k}=${params[k]}`)
    .join('&')

  const signature = crypto
    .createHash('sha256')
    .update(stringToSign + API_SECRET)
    .digest('hex')

  return { timestamp, signature, apiKey: API_KEY, cloudName: CLOUD_NAME, folder, publicId }
}

export function getTransformUrl(publicId: string, transformation = 'f_auto,q_auto,w_400') {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformation}/${publicId}`
}

export function getProfileUrl(publicId: string) {
  return getTransformUrl(publicId, 'f_auto,q_auto,w_200,h_200,c_fill,g_face,r_max')
}

export function getListingUrl(publicId: string) {
  return getTransformUrl(publicId, 'f_auto,q_auto,w_400,h_300,c_fill')
}
