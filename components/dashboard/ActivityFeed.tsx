// components/dashboard/ActivityFeed.tsx
import { ArrowDownLeft, ArrowUpRight, ShoppingBag, Users, Landmark, Vote } from 'lucide-react'

const TX_ICONS: Record<string, React.ReactNode> = {
  contribution:          <Users className="w-4 h-4" />,
  loan_disbursement:     <Landmark className="w-4 h-4" />,
  loan_repayment:        <Landmark className="w-4 h-4" />,
  marketplace_payment:   <ShoppingBag className="w-4 h-4" />,
  marketplace_payout:    <ShoppingBag className="w-4 h-4" />,
  chama_payout:          <Users className="w-4 h-4" />,
  transfer_sent:         <ArrowUpRight className="w-4 h-4" />,
  transfer_received:     <ArrowDownLeft className="w-4 h-4" />,
  dividend:              <Vote className="w-4 h-4" />,
}

const TX_LABELS: Record<string, string> = {
  contribution:          'Savings contribution',
  loan_disbursement:     'Loan received',
  loan_repayment:        'Loan repayment',
  marketplace_payment:   'Marketplace purchase',
  marketplace_payout:    'Marketplace sale',
  chama_payout:          'Savings payout',
  transfer_sent:         'Transfer sent',
  transfer_received:     'Transfer received',
  dividend:              'Investment dividend',
}

export default function ActivityFeed({ transactions }: {
  transactions: Array<{ id: string; type: string; amount: number; direction: string; created_at: string }>
}) {
  if (!transactions.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-earth-400">No transactions yet</p>
        <p className="text-xs text-earth-300 mt-1">Activity will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map(tx => (
        <div key={tx.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-earth-50 transition-colors">
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
            ${tx.direction === 'in' ? 'bg-forest-400/10 text-forest-500' : 'bg-earth-100 text-earth-600'}`}>
            {TX_ICONS[tx.type] || <ArrowUpRight className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink-800 truncate">{TX_LABELS[tx.type] || tx.type}</p>
            <p className="text-xs text-earth-400">{new Date(tx.created_at).toLocaleDateString()}</p>
          </div>
          <span className={`text-sm font-medium flex-shrink-0 ${tx.direction === 'in' ? 'text-forest-600' : 'text-earth-700'}`}>
            {tx.direction === 'in' ? '+' : '-'}KES {tx.amount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
