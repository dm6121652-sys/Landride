import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Plus, Wallet, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type WalletTx = {
  id: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  created_at: string
  reference: string | null
}

const naira = (v: number) => `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`

const FUND_AMOUNTS = [500, 1000, 2000, 5000]

export default function WalletPanel({ session }: { session: Session }) {
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(true)
  const [error, setError] = useState('')

  /* Fund modal state */
  const [fundOpen, setFundOpen] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [fundBusy, setFundBusy] = useState(false)
  const [fundError, setFundError] = useState('')
  const [fundSuccess, setFundSuccess] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchBalance = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('student_id', session.user.id)
      .single()
    if (error && error.code !== 'PGRST116') {
      setError(error.message)
    } else {
      setBalance(data?.balance ?? 0)
      setError('')
    }
    setLoading(false)
  }, [session.user.id])

  const fetchTransactions = useCallback(async () => {
    if (!supabase) return
    setTxLoading(true)
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('id,amount,type,description,created_at,reference')
      .eq('student_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (!error) setTransactions((data ?? []) as WalletTx[])
    setTxLoading(false)
  }, [session.user.id])

  useEffect(() => {
    void fetchBalance()
    void fetchTransactions()

    const client = supabase
    if (!client) return
    const channel = client
      .channel(`wallet-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `student_id=eq.${session.user.id}` }, () => { void fetchBalance() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `student_id=eq.${session.user.id}` }, () => { void fetchTransactions() })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [fetchBalance, fetchTransactions, session.user.id])

  function openFund() {
    setFundOpen(true)
    setFundAmount('')
    setFundError('')
    setFundSuccess('')
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  function closeFund() {
    if (fundBusy) return
    setFundOpen(false)
  }

  async function submitFund() {
    const parsed = parseFloat(fundAmount.replace(/,/g, ''))
    if (!fundAmount || isNaN(parsed) || parsed < 100) {
      setFundError('Enter a valid amount (minimum ₦100)')
      return
    }
    if (parsed > 100000) {
      setFundError('Maximum single top-up is ₦100,000')
      return
    }
    if (!supabase) { setFundError('Not connected'); return }

    setFundBusy(true)
    setFundError('')

    /* In a real app this would hit a Paystack/Flutterwave endpoint.
       For now we directly credit the wallet via an RPC that also inserts a transaction row. */
    const { error } = await supabase.rpc('fund_wallet', {
      p_student_id: session.user.id,
      p_amount: Math.round(parsed * 100) / 100,
      p_reference: `manual-${Date.now()}`,
    })

    setFundBusy(false)
    if (error) {
      setFundError(error.message)
    } else {
      setFundSuccess(`₦${Number(parsed).toLocaleString()} added to your wallet!`)
      setFundAmount('')
      await fetchBalance()
      await fetchTransactions()
      setTimeout(() => { setFundOpen(false); setFundSuccess('') }, 2200)
    }
  }

  const creditTotal = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const debitTotal = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="wallet-page">

      {/* Balance hero */}
      <div className="wallet-hero">
        <div className="wallet-hero-left">
          <span className="wallet-label">Landride Wallet</span>
          <div className="wallet-balance-row">
            {loading
              ? <span className="wallet-balance-skeleton" />
              : <strong className="wallet-balance">{naira(balance ?? 0)}</strong>}
          </div>
          <p className="wallet-sub">Available for campus rides</p>
        </div>
        <div className="wallet-hero-actions">
          <button className="button button-primary wallet-fund-btn" onClick={openFund}>
            <Plus size={16} /> Fund wallet
          </button>
        </div>
      </div>

      {/* Stat chips */}
      <div className="wallet-stats">
        <div className="wallet-stat-chip">
          <span className="wsc-icon wsc-icon-credit"><ArrowDownLeft size={15} /></span>
          <div>
            <strong>{naira(creditTotal)}</strong>
            <span>Total funded</span>
          </div>
        </div>
        <div className="wallet-stat-chip">
          <span className="wsc-icon wsc-icon-debit"><ArrowUpRight size={15} /></span>
          <div>
            <strong>{naira(debitTotal)}</strong>
            <span>Total spent</span>
          </div>
        </div>
        <div className="wallet-stat-chip">
          <span className="wsc-icon"><Wallet size={15} /></span>
          <div>
            <strong>{transactions.length}</strong>
            <span>Transactions</span>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <section className="reference-panel wallet-tx-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">TRANSACTION HISTORY</span>
            <h2>Recent activity</h2>
          </div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        {txLoading ? (
          <div className="rides-empty">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div className="rides-empty">
            <Wallet size={22} />
            <strong>No transactions yet</strong>
            <span>Fund your wallet to get started.</span>
            <button className="button button-primary button-small" onClick={openFund}>
              <Plus size={14} /> Fund wallet
            </button>
          </div>
        ) : (
          <div className="wallet-tx-list">
            {transactions.map(tx => (
              <div className="wallet-tx-row" key={tx.id}>
                <span className={`wallet-tx-icon ${tx.type === 'credit' ? 'tx-credit' : 'tx-debit'}`}>
                  {tx.type === 'credit' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                </span>
                <div className="wallet-tx-info">
                  <strong>{tx.description}</strong>
                  <span>{new Date(tx.created_at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <span className={`wallet-tx-amount ${tx.type === 'credit' ? 'tx-credit' : 'tx-debit'}`}>
                  {tx.type === 'credit' ? '+' : '−'}{naira(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fund modal */}
      {fundOpen && (
        <div className="wallet-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeFund() }}>
          <div className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="fund-modal-title">
            <div className="wallet-modal-head">
              <div>
                <span className="section-kicker">ADD MONEY</span>
                <h2 id="fund-modal-title">Fund your wallet</h2>
              </div>
              <button className="shuttle-dialog-close" onClick={closeFund} aria-label="Close" disabled={fundBusy}>
                <X size={18} />
              </button>
            </div>

            <p className="wallet-modal-desc">
              Choose an amount or enter a custom value. Funds are added instantly to your Landride wallet.
            </p>

            {/* Quick amounts */}
            <div className="wallet-quick-amounts">
              {FUND_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  className={`wallet-quick-chip ${fundAmount === String(amt) ? 'is-selected' : ''}`}
                  onClick={() => { setFundAmount(String(amt)); setFundError('') }}
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <label className="form-label" htmlFor="fund-amount-input">Or enter amount</label>
            <div className="wallet-amount-input-wrap">
              <span className="wallet-amount-prefix">₦</span>
              <input
                ref={inputRef}
                id="fund-amount-input"
                className="wallet-amount-input"
                type="number"
                min="100"
                max="100000"
                step="50"
                placeholder="0.00"
                value={fundAmount}
                onChange={e => { setFundAmount(e.target.value); setFundError('') }}
                onKeyDown={e => { if (e.key === 'Enter') void submitFund() }}
              />
            </div>

            {fundError && <div className="dashboard-error" role="alert">{fundError}</div>}
            {fundSuccess && <div className="auth-success" role="status">{fundSuccess}</div>}

            <div className="wallet-modal-notice">
              <CreditCard size={13} />
              <span>Payment gateway integration coming soon. For now, funds are added directly for testing.</span>
            </div>

            <button
              className="button button-primary wallet-fund-submit"
              onClick={() => void submitFund()}
              disabled={fundBusy || !fundAmount}
            >
              {fundBusy ? 'Processing…' : `Add ${fundAmount ? `₦${Number(fundAmount).toLocaleString()}` : 'funds'} →`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
