import { useState, useEffect, useMemo } from 'react';
import Calendar from 'react-calendar';
import { motion, AnimatePresence } from 'framer-motion';
import { isSameDay, isToday, format, startOfWeek, startOfMonth, isAfter } from 'date-fns';
import axios from 'axios';
import {
  TrendingUp,
  Target,
  Eye,
  Trash2,
  ArrowLeft,
  X,
  Clock,
  Activity,
  BarChart2,
} from 'lucide-react';

// ─── Equity Curve SVG ───────────────────────────────────────────────
const EquityCurve = ({ trades }) => {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let cumR = 0;
  const points = [{ x: 0, y: 0 }, ...sorted.map((t, i) => {
    if (t.outcome === 'Win') cumR += (t.rrRatio || 0);
    else if (t.outcome === 'Loss') cumR -= 1;
    return { x: i + 1, y: cumR };
  })];

  if (points.length < 2) return (
    <div className="flex items-center justify-center h-full text-slate-600 text-xs font-bold uppercase tracking-widest">No trade data yet</div>
  );

  const W = 500, H = 100, PAD = 8;
  const ys = points.map(p => p.y);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const rangeY = maxY - minY || 1;
  const maxX = points[points.length - 1].x || 1;

  const toX = x => PAD + (x / maxX) * (W - 2 * PAD);
  const toY = y => H - PAD - ((y - minY) / rangeY) * (H - 2 * PAD);

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ');
  const zeroY = toY(0).toFixed(1);
  const areaD = `${d} L ${toX(maxX).toFixed(1)} ${zeroY} L ${toX(0).toFixed(1)} ${zeroY} Z`;
  const isPositive = cumR >= 0;
  const color = isPositive ? '#10b981' : '#ef4444';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="4 3" />
      <path d={areaD} fill="url(#eqGrad)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(points[points.length - 1].x)} cy={toY(points[points.length - 1].y)} r="3" fill={color} />
    </svg>
  );
};

// ─── Streak Calculator ──────────────────────────────────────────────
const calcStreaks = (trades) => {
  const sorted = [...trades].filter(t => t.outcome !== 'Breakeven').sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sorted.length === 0) return { current: 0, currentType: null, bestWin: 0, bestLoss: 0 };

  let current = 1;
  const currentType = sorted[0].outcome;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].outcome === currentType) current++;
    else break;
  }

  let bestWin = 0, bestLoss = 0, runW = 0, runL = 0;
  [...trades].filter(t => t.outcome !== 'Breakeven').sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    if (t.outcome === 'Win') { runW++; runL = 0; bestWin = Math.max(bestWin, runW); }
    else { runL++; runW = 0; bestLoss = Math.max(bestLoss, runL); }
  });

  return { current, currentType, bestWin, bestLoss };
};

// ─── Concept Performance ────────────────────────────────────────────
const calcConceptStats = (trades) => {
  const map = {};
  trades.forEach(t => {
    (t.concepts || []).forEach(c => {
      if (!map[c]) map[c] = { wins: 0, total: 0 };
      map[c].total++;
      if (t.outcome === 'Win') map[c].wins++;
    });
  });
  return Object.entries(map)
    .map(([concept, s]) => ({ concept, winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0, total: s.total }))
    .sort((a, b) => b.winRate - a.winRate);
};

const Dashboard = () => {
  const [date, setDate] = useState(new Date());
  const [trades, setTrades] = useState([]);
  const [selectedDayTrades, setSelectedDayTrades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [startingBalance, setStartingBalance] = useState('10000');
  const [riskPerTrade, setRiskPerTrade] = useState('100');
  const [period, setPeriod] = useState('all');

  const fetchData = async () => {
    try {
      const [tradesRes, settingsRes] = await Promise.all([
        axios.get('/api/trades'),
        axios.get('/api/settings')
      ]);
      setTrades(tradesRes.data);
      if (settingsRes.data) {
        setStartingBalance(settingsRes.data.startingBalance || '10000');
        setRiskPerTrade(settingsRes.data.riskPerTrade || '100');
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await axios.patch('/api/settings', {
          startingBalance: parseFloat(startingBalance),
          riskPerTrade: parseFloat(riskPerTrade)
        });
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [startingBalance, riskPerTrade]);

  const filteredTrades = useMemo(() => {
    if (period === 'all') return trades;
    const cutoff = period === 'week'
      ? startOfWeek(new Date(), { weekStartsOn: 1 })
      : startOfMonth(new Date());
    return trades.filter(t => isAfter(new Date(t.date), cutoff));
  }, [trades, period]);

  const winCount = filteredTrades.filter(t => t.outcome === 'Win').length;
  const lossCount = filteredTrades.filter(t => t.outcome === 'Loss').length;
  const totalTradesCount = filteredTrades.length;
  const winRate = totalTradesCount > 0 ? ((winCount / totalTradesCount) * 100).toFixed(1) : '0';

  const totalRGain = filteredTrades.reduce((acc, t) => {
    if (t.outcome === 'Win') return acc + (t.rrRatio || 0);
    if (t.outcome === 'Loss') return acc - 1;
    return acc;
  }, 0).toFixed(1);

  const avgRR = winCount > 0
    ? (filteredTrades.filter(t => t.outcome === 'Win').reduce((acc, t) => acc + (t.rrRatio || 0), 0) / winCount).toFixed(2)
    : '0';

  const currentEquity = parseFloat(startingBalance || 0) + (parseFloat(totalRGain) * parseFloat(riskPerTrade || 0));

  const { current: streakCount, currentType: streakType, bestWin, bestLoss } = useMemo(() => calcStreaks(filteredTrades), [filteredTrades]);
  const conceptStats = useMemo(() => calcConceptStats(filteredTrades), [filteredTrades]);

  const handleDeleteTrade = async (tradeId) => {
    setIsDeleting(true);
    try {
      await axios.delete(`/api/trades/${tradeId}`);
      setTrades(prev => prev.filter(t => t._id !== tradeId));
      setSelectedDayTrades(prev => prev.filter(t => t._id !== tradeId));
      if (viewingTrade?._id === tradeId) setViewingTrade(null);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete trade:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeModal = () => { setIsModalOpen(false); setViewingTrade(null); setDeleteConfirm(null); };

  const tileClassName = ({ date: d, view }) => {
    if (view === 'month') {
      const today = isToday(d);
      const dayTrades = trades.filter(t => isSameDay(new Date(t.date), d));
      if (dayTrades.length > 0) {
        const hasLoss = dayTrades.some(t => t.outcome === 'Loss');
        const hasWin = dayTrades.some(t => t.outcome === 'Win');
        const ring = today ? ' !ring-2 !ring-trade-blue' : '';
        if (hasLoss && hasWin) return `!bg-gradient-to-br from-trade-green/20 to-trade-red/20 !border-dark-700 !text-white${ring}`;
        if (hasWin) return `!bg-trade-green/20 !border-trade-green/30 !text-white${ring}`;
        if (hasLoss) return `!bg-trade-red/20 !border-trade-red/30 !text-white${ring}`;
        return `!bg-dark-800 !border-dark-700 !text-white${ring}`;
      }
      if (today) return '!ring-2 !ring-trade-blue !text-white';
    }
    return null;
  };

  const tileContent = ({ date: d, view }) => {
    if (view === 'month') {
      const dayTrades = trades.filter(t => isSameDay(new Date(t.date), d));
      if (dayTrades.length > 0) {
        const winSum = dayTrades.filter(t => t.outcome === 'Win').length;
        const lossSum = dayTrades.filter(t => t.outcome === 'Loss').length;
        return (
          <div className="flex flex-col mt-2 gap-1 w-full text-[9px] font-black items-start px-1 overflow-hidden">
            {winSum > 0 && <span className="text-trade-green flex items-center gap-0.5"><div className="w-1.5 h-1.5 rounded-full bg-trade-green"/> {winSum}W</span>}
            {lossSum > 0 && <span className="text-trade-red flex items-center gap-0.5"><div className="w-1.5 h-1.5 rounded-full bg-trade-red"/> {lossSum}L</span>}
          </div>
        );
      }
    }
  };

  const onClickDay = (value) => {
    const dayTrades = trades.filter(t => isSameDay(new Date(t.date), value));
    setSelectedDayTrades(dayTrades);
    setDate(value);
    setViewingTrade(null);
    setDeleteConfirm(null);
    setIsModalOpen(true);
  };

  const outcomeColors = (outcome) => {
    switch (outcome) {
      case 'Win': return { bg: 'bg-trade-green/10', text: 'text-trade-green', border: 'border-trade-green/20', accent: 'bg-trade-green' };
      case 'Loss': return { bg: 'bg-trade-red/10', text: 'text-trade-red', border: 'border-trade-red/20', accent: 'bg-trade-red' };
      default: return { bg: 'bg-trade-blue/10', text: 'text-trade-blue', border: 'border-trade-blue/20', accent: 'bg-trade-blue' };
    }
  };

  return (
    <div className="p-3 lg:p-4 space-y-4 animate-fade-in relative">

      {/* ─── Period Filter ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {[['all', 'All Time'], ['week', 'This Week'], ['month', 'This Month']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriod(val)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
              period === val ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Top Stats Bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total trades', value: totalTradesCount, icon: BarChart2, color: 'text-blue-400' },
          { label: 'Win rate', value: `${winRate}%`, icon: Target, color: parseFloat(winRate) >= 50 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Avg Win RR', value: `${avgRR}R`, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Net P&L (R)', value: `${parseFloat(totalRGain) >= 0 ? '+' : ''}${totalRGain}R`, icon: Activity, color: parseFloat(totalRGain) >= 0 ? 'text-emerald-400' : 'text-red-400' }
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{stat.label}</p>
                <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon size={18} className="text-slate-700" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Equity Curve ─────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-full"/>
            EQUITY CURVE
          </h2>
          <span className={`text-xs font-black ${parseFloat(totalRGain) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {parseFloat(totalRGain) >= 0 ? '+' : ''}{totalRGain}R total
          </span>
        </div>
        <div className="h-28 p-2">
          <EquityCurve trades={filteredTrades} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ─── CALENDAR + CONCEPT PERFORMANCE ────────────────────── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"/>
                PROFIT CALENDAR
              </h2>
              <div className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[9px] font-bold text-slate-500 uppercase tracking-wider">Historical View</div>
            </div>
            <div className="p-2">
              <Calendar
                onChange={setDate}
                value={date}
                tileClassName={tileClassName}
                tileContent={tileContent}
                onClickDay={onClickDay}
              />
            </div>
          </div>

          {/* Concept Performance */}
          {conceptStats.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span className="w-1 h-4 bg-purple-500 rounded-full"/>
                  CONCEPT PERFORMANCE
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {conceptStats.map(({ concept, winRate: wr, total }) => (
                  <div key={concept} className="bg-slate-950/50 rounded-lg border border-slate-800 p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{concept}</p>
                    <p className={`text-lg font-black ${wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{wr}%</p>
                    <p className="text-[9px] text-slate-600 font-bold">{total} trade{total !== 1 ? 's' : ''}</p>
                    <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${wr >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${wr}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Streak Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <span className="w-1 h-4 bg-orange-500 rounded-full"/>
              STREAKS
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-3 text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Current</p>
                <p className={`text-2xl font-black ${streakType === 'Win' ? 'text-emerald-400' : streakType === 'Loss' ? 'text-red-400' : 'text-slate-500'}`}>
                  {streakCount || '—'}
                </p>
                <p className="text-[9px] font-bold text-slate-600">{streakType || 'No trades'}</p>
              </div>
              <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-3 text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Best Win</p>
                <p className="text-2xl font-black text-emerald-400">{bestWin || '—'}</p>
                <p className="text-[9px] font-bold text-slate-600">streak</p>
              </div>
            </div>
          </div>

          {/* Evaluation Panel */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span className="w-1 h-4 bg-emerald-500 rounded-full"/>
                EVALUATION
              </h2>
            </div>

            <div className="p-4 flex flex-col items-center justify-center border-b border-slate-800 bg-slate-950/20">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                  <circle
                    cx="64" cy="64" r="54"
                    stroke="currentColor" strokeWidth="8" fill="transparent"
                    strokeDasharray={339.12}
                    strokeDashoffset={339.12 - (339.12 * parseFloat(winRate)) / 100}
                    strokeLinecap="round"
                    className="text-emerald-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-white">{winRate}%</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Winrate</span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-red-500/10 flex items-center justify-center text-red-500 font-bold text-[10px]">{lossCount}</div>
                  <span className="font-bold text-[11px] text-slate-300">Losers</span>
                </div>
                <div className="text-[10px] font-bold text-red-500">-{lossCount}R</div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold text-[10px]">{winCount}</div>
                  <span className="font-bold text-[11px] text-slate-300">Winners</span>
                </div>
                <div className="text-[10px] font-bold text-emerald-500">+{totalRGain}R</div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Starting Balance</p>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                      value={startingBalance}
                      onChange={e => setStartingBalance(e.target.value)}
                      placeholder="10000"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Risk/Trade</p>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                      value={riskPerTrade}
                      onChange={e => setRiskPerTrade(e.target.value)}
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">Current Equity</p>
                  <p className={`text-xl font-black text-center tracking-tight ${currentEquity >= parseFloat(startingBalance) ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="mt-2 flex justify-center">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded bg-slate-900 border border-slate-800 ${parseFloat(totalRGain) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {parseFloat(totalRGain) >= 0 ? '+' : ''}{totalRGain}R
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TRADE DETAIL MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md" onClick={closeModal}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-dark-850 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-3xl border border-dark-700 relative z-[101]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-dark-700 bg-dark-800/50">
                <div className="flex items-center gap-3">
                  {viewingTrade && (
                    <button onClick={() => { setViewingTrade(null); setDeleteConfirm(null); }} className="p-2 rounded-xl bg-dark-700 hover:bg-dark-600 transition-all text-gray-300">
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {viewingTrade ? viewingTrade.market : format(date, 'MMMM do, yyyy')}
                    </h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                      {viewingTrade ? `Transaction ID #${viewingTrade._id.slice(-8)}` : 'Log overview for this session'}
                    </p>
                  </div>
                </div>
                <button onClick={closeModal} className="p-2 rounded-xl bg-dark-700 hover:bg-dark-600 transition-all text-gray-300">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {!viewingTrade ? (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {selectedDayTrades.length === 0 ? (
                        <div className="py-20 flex flex-col items-center text-gray-600">
                          <Activity size={48} className="mb-4 opacity-10 text-slate-700" />
                          <p className="font-black uppercase tracking-tighter text-lg">No Activity Logged</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedDayTrades.map((t) => {
                            const colors = outcomeColors(t.outcome);
                            return (
                              <div key={t._id} className="bg-dark-900 rounded-2xl border border-dark-700 overflow-hidden hover:border-trade-blue/30 transition-all">
                                <div className="p-5">
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className={`w-2 h-2 rounded-full ${colors.accent}`}/>
                                      <span className="font-black text-lg text-white">{t.market}</span>
                                      {t.direction && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${t.direction === 'Long' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10'}`}>
                                          {t.direction}
                                        </span>
                                      )}
                                    </div>
                                    <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}>
                                      {t.outcome}
                                    </span>
                                  </div>
                                  <div className="flex gap-4 text-[10px] font-bold text-gray-500 uppercase mb-4 flex-wrap">
                                    <span className="flex items-center gap-1"><Clock size={12}/> {format(new Date(t.date), 'hh:mm a')}</span>
                                    <span className="flex items-center gap-1"><Target size={12}/> RR {t.rrRatio}</span>
                                    {t.disciplineRating && <span>{t.disciplineRating}/5 disc.</span>}
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => setViewingTrade(t)} className="flex-1 py-3 px-4 bg-dark-700 hover:bg-dark-600 text-white text-xs font-black uppercase rounded-xl transition-all">
                                      Details
                                    </button>
                                    <button onClick={() => setDeleteConfirm(t._id)} className="p-3 bg-trade-red/10 text-trade-red rounded-xl hover:bg-trade-red/20 transition-all">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                  {deleteConfirm === t._id && (
                                    <div className="mt-3 p-3 bg-trade-red/10 border border-trade-red/30 rounded-xl flex gap-2">
                                      <button onClick={() => handleDeleteTrade(t._id)} disabled={isDeleting} className="flex-1 py-2 bg-trade-red text-white text-xs font-black uppercase rounded-lg">
                                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                                      </button>
                                      <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 bg-dark-700 text-gray-300 text-xs font-black rounded-lg">Cancel</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                      {(() => {
                        const t = viewingTrade;
                        const colors = outcomeColors(t.outcome);
                        return (
                          <div className="space-y-8">
                            <div className={`${colors.bg} border ${colors.border} rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6`}>
                              <div className="text-center md:text-left">
                                <p className={`text-6xl font-black ${colors.text}`}>{t.outcome}</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-2">{t.market} · RR {t.rrRatio}</p>
                                <div className="flex gap-2 mt-3 flex-wrap">
                                  {t.direction && (
                                    <span className={`text-[10px] font-black px-2 py-1 rounded border ${t.direction === 'Long' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10'}`}>
                                      {t.direction}
                                    </span>
                                  )}
                                  {t.session && <span className="text-[10px] font-black px-2 py-1 rounded border text-blue-400 border-blue-400/30 bg-blue-400/10">{t.session}</span>}
                                  {t.disciplineRating && <span className="text-[10px] font-black px-2 py-1 rounded border text-yellow-400 border-yellow-400/30 bg-yellow-400/10">Discipline {t.disciplineRating}/5</span>}
                                </div>
                              </div>
                              <div className="text-center md:text-right bg-dark-950/40 p-6 rounded-2xl border border-white/5">
                                <p className="text-gray-400 font-bold text-sm">{format(new Date(t.date), 'EEEE, MMMM do')}</p>
                                <p className="text-gray-500 text-xs mt-1">{format(new Date(t.date), 'hh:mm a')}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-6">
                                <div>
                                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">SMC Concepts</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {t.concepts?.map(c => (
                                      <span key={c} className="text-[11px] font-bold bg-dark-800 text-trade-blue border border-trade-blue/20 px-4 py-2 rounded-xl shadow-lg">{c}</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Trade Narrative</h4>
                                  <div className="bg-dark-900/50 rounded-2xl border border-dark-700 p-6">
                                    <p className="text-sm text-gray-300 leading-relaxed italic">"{t.narrative || 'No case study recorded.'}"</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Visual Evidence</h4>
                                <div className="grid grid-cols-1 gap-4">
                                  {t.images?.map((img, idx) => (
                                    <div key={idx} className="relative group cursor-zoom-in rounded-2xl overflow-hidden border border-dark-700 shadow-xl aspect-video" onClick={() => setLightboxImage(img)}>
                                      <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" />
                                      <div className="absolute inset-0 bg-dark-950/0 group-hover:bg-dark-950/40 transition-all flex items-center justify-center">
                                        <Eye size={32} className="text-white opacity-0 group-hover:opacity-100 transition-all" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Lightbox ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-dark-950/95 backdrop-blur-2xl p-4 sm:p-12"
            onClick={() => setLightboxImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              src={lightboxImage} className="max-w-full max-h-full rounded-2xl shadow-[0_0_100px_rgba(33,150,243,0.3)] object-contain"
            />
            <button className="absolute top-8 right-8 p-4 bg-dark-800 text-white rounded-full hover:bg-dark-700 ring-1 ring-white/10" onClick={() => setLightboxImage(null)}>
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
