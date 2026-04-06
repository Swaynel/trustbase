// components/dashboard/RecentChamas.tsx
import Link from 'next/link'
import { Users, Lock } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  forming: 'bg-amber-100 text-amber-700',
  active:  'bg-forest-400/10 text-forest-600',
  payout:  'bg-blue-100 text-blue-700',
  closed:  'bg-gray-100 text-gray-500',
}

export default function RecentChamas({ chamas, memberLevel }: {
  chamas: Array<{ id: string; name: string; balance: number; status: string; contribution_amount: number }>
  memberLevel: number
}) {
  if (memberLevel < 1) {
    return (
      <div className="py-8 text-center">
        <Lock className="w-8 h-8 text-earth-300 mx-auto mb-2" />
        <p className="text-sm text-earth-400">Reach Level 1 to join savings groups</p>
        <p className="text-xs text-earth-300 mt-1">Complete 1 identity pillar to unlock</p>
      </div>
    )
  }

  if (!chamas.length) {
    return (
      <div className="py-8 text-center">
        <Users className="w-8 h-8 text-earth-300 mx-auto mb-2" />
        <p className="text-sm text-earth-400">No savings groups yet</p>
        <Link href="/chama" className="text-xs text-earth-500 underline mt-1 inline-block">
          Create or join a group →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {chamas.map(c => (
        <Link key={c.id} href={`/chama/${c.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-earth-50 transition-colors">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-earth-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-earth-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink-800 truncate">{c.name}</p>
            <p className="text-xs text-earth-400">KES {c.contribution_amount}/cycle</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-medium text-ink-800">KES {c.balance.toLocaleString()}</p>
            <span className={`badge text-xs ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-500'}`}>
              {c.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
