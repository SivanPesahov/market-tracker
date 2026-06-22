import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import axios from 'axios';
import {
  Search,
  X,
  Eye,
  Trash2,
  Target,
  Clock,
  ArrowUpDown,
  Filter,
  ImagePlus,
} from 'lucide-react';

const outcomeColors = (outcome) => {
  switch (outcome) {
    case 'Win': return { bg: 'bg-trade-green/10', text: 'text-trade-green', border: 'border-trade-green/20', dot: 'bg-trade-green' };
    case 'Loss': return { bg: 'bg-trade-red/10', text: 'text-trade-red', border: 'border-trade-red/20', dot: 'bg-trade-red' };
    default: return { bg: 'bg-trade-blue/10', text: 'text-trade-blue', border: 'border-trade-blue/20', dot: 'bg-trade-blue' };
  }
};

const TradeHistory = () => {
  const [trades, setTrades] = useState([]);
  const [search, setSearch] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [filterSession, setFilterSession] = useState('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    axios.get('/api/trades').then(r => setTrades(r.data)).catch(console.error);
  }, []);

  const markets = useMemo(() => ['all', ...new Set(trades.map(t => t.market))], [trades]);
  const sessions = ['all', 'London', 'NY AM', 'NY PM', 'Asian', 'Off-Session'];

  const filtered = useMemo(() => {
    let result = [...trades];
    if (filterOutcome !== 'all') result = result.filter(t => t.outcome === filterOutcome);
    if (filterMarket !== 'all') result = result.filter(t => t.market === filterMarket);
    if (filterSession !== 'all') result = result.filter(t => t.session === filterSession);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.market.toLowerCase().includes(q) ||
        (t.narrative || '').toLowerCase().includes(q) ||
        (t.concepts || []).some(c => c.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => sortDesc
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date)
    );
    return result;
  }, [trades, filterOutcome, filterMarket, filterSession, search, sortDesc]);

  const handleDelete = async (id) => {
    setIsDeleting(true);
    try {
      await axios.delete(`/api/trades/${id}`);
      setTrades(prev => prev.filter(t => t._id !== id));
      setDeleteConfirm(null);
      if (viewingTrade?._id === id) setViewingTrade(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageUpload = async (tradeId, files) => {
    if (!files?.length) return;
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('images', file));
      const { data } = await axios.put(`/api/trades/${tradeId}`, formData);
      setTrades(prev => prev.map(t => (t._id === tradeId ? data : t)));
      setViewingTrade(prev => (prev?._id === tradeId ? data : prev));
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const selectStyle = "bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="p-3 lg:p-6 space-y-4 animate-fade-in">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Trade History</h1>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search market, narrative, concept..."
            className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg pl-8 pr-4 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>

        <select className={selectStyle} value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}>
          <option value="all">All Outcomes</option>
          <option value="Win">Win</option>
          <option value="Loss">Loss</option>
          <option value="Breakeven">Breakeven</option>
        </select>

        <select className={selectStyle} value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
          {markets.map(m => <option key={m} value={m}>{m === 'all' ? 'All Markets' : m}</option>)}
        </select>

        <select className={selectStyle} value={filterSession} onChange={e => setFilterSession(e.target.value)}>
          {sessions.map(s => <option key={s} value={s}>{s === 'all' ? 'All Sessions' : s}</option>)}
        </select>

        <button
          onClick={() => setSortDesc(p => !p)}
          className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-700 transition-all"
        >
          <ArrowUpDown size={13} />
          {sortDesc ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* ─── Trade List ──────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-24 flex flex-col items-center text-slate-600">
          <Filter size={48} className="mb-4 opacity-20" />
          <p className="font-black uppercase tracking-tighter text-lg">No trades match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t, i) => {
            const colors = outcomeColors(t.outcome);
            return (
              <motion.div
                key={t._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all"
              >
                <div className="p-4 flex items-center gap-4">
                  {/* Outcome dot */}
                  <div className={`w-2 h-10 rounded-full shrink-0 ${colors.dot}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm">{t.market}</span>
                        {t.direction && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${t.direction === 'Long' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10'}`}>
                            {t.direction}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">{format(new Date(t.date), 'MMM d, yyyy')}</p>
                    </div>

                    <div className="hidden md:block">
                      <span className={`px-2 py-1 text-[9px] font-black uppercase rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {t.outcome}
                      </span>
                    </div>

                    <div className="hidden md:block">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">RR</p>
                      <p className={`text-sm font-black ${t.outcome === 'Win' ? 'text-emerald-400' : t.outcome === 'Loss' ? 'text-red-400' : 'text-blue-400'}`}>
                        {t.outcome === 'Win' ? '+' : t.outcome === 'Loss' ? '-' : ''}{t.rrRatio}R
                      </p>
                    </div>

                    <div className="hidden md:flex flex-wrap gap-1">
                      {(t.concepts || []).slice(0, 3).map(c => (
                        <span key={c} className="text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                      {(t.concepts || []).length > 3 && <span className="text-[9px] text-slate-600 font-bold">+{t.concepts.length - 3}</span>}
                    </div>

                    <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                      <Clock size={11} />
                      {t.session || '—'}
                      {t.disciplineRating && <span className="ml-2 text-yellow-500">★ {t.disciplineRating}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setViewingTrade(t)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(t._id)}
                      className="p-2 bg-trade-red/10 hover:bg-trade-red/20 text-trade-red rounded-lg transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Inline delete confirm */}
                <AnimatePresence>
                  {deleteConfirm === t._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-trade-red/20 bg-trade-red/5 px-4 py-3 flex items-center justify-between"
                    >
                      <p className="text-[11px] text-trade-red font-bold">Delete this trade permanently?</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(t._id)} disabled={isDeleting} className="px-3 py-1.5 bg-trade-red text-white text-[11px] font-black rounded-lg">
                          {isDeleting ? '...' : 'Delete'}
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 bg-slate-700 text-slate-300 text-[11px] font-black rounded-lg">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {viewingTrade && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md" onClick={() => setViewingTrade(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-dark-850 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-3xl border border-dark-700 relative z-[101]"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const t = viewingTrade;
                const colors = outcomeColors(t.outcome);
                return (
                  <>
                    <div className="flex items-center justify-between p-6 border-b border-dark-700 bg-dark-800/50">
                      <div>
                        <h3 className="text-xl font-black text-white">{t.market}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">#{t._id.slice(-8)}</p>
                      </div>
                      <button onClick={() => setViewingTrade(null)} className="p-2 rounded-xl bg-dark-700 hover:bg-dark-600 transition-all text-gray-300">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar space-y-8">
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
                              {(t.concepts || []).map(c => (
                                <span key={c} className="text-[11px] font-bold bg-dark-800 text-trade-blue border border-trade-blue/20 px-4 py-2 rounded-xl">{c}</span>
                              ))}
                              {!t.concepts?.length && <p className="text-sm text-gray-600">None tagged.</p>}
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
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Visual Evidence</h4>
                            <label className={`flex items-center gap-1.5 text-[10px] font-black text-trade-blue px-3 py-1.5 rounded-lg border border-trade-blue/20 bg-trade-blue/10 hover:bg-trade-blue/20 transition-all cursor-pointer ${isUploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                              <ImagePlus size={13} />
                              {isUploadingImage ? 'Uploading...' : 'Add Image'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png"
                                multiple
                                className="hidden"
                                onChange={e => {
                                  handleImageUpload(t._id, e.target.files);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            {(t.images || []).filter(Boolean).map((img, idx) => (
                              <div key={idx} className="relative group cursor-zoom-in rounded-2xl overflow-hidden border border-dark-700 shadow-xl aspect-video" onClick={() => setLightboxImage(img)}>
                                <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" />
                                <div className="absolute inset-0 bg-dark-950/0 group-hover:bg-dark-950/40 transition-all flex items-center justify-center">
                                  <Eye size={32} className="text-white opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                              </div>
                            ))}
                            {!t.images?.filter(Boolean).length && <p className="text-sm text-gray-600">No charts attached.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
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
              src={lightboxImage} className="max-w-full max-h-full rounded-2xl object-contain"
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

export default TradeHistory;
