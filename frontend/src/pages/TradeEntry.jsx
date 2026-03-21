import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud,
  CheckCircle,
  Save,
  Target,
  Tag,
  PenTool,
  Calendar,
  Layers,
  BarChart3,
  DollarSign,
  Clock,
  Image as ImageIcon,
  ArrowUp,
  Star
} from 'lucide-react';
import axios from 'axios';

const TradeEntry = () => {
  const [formData, setFormData] = useState({
    market: 'NAS100',
    date: new Date().toISOString().split('T')[0],
    outcome: 'Win',
    rrRatio: '',
    narrative: '',
    session: 'NY AM',
    direction: 'Long',
    disciplineRating: 3,
  });
  const [concepts, setConcepts] = useState([]);
  const [images, setImages] = useState([]);

  const handleConceptChange = (e) => {
    const value = e.target.value;
    setConcepts(prev => 
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    );
  };

  const handleImageChange = (e) => {
    if (e.target.files.length > 0) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('market', formData.market);
    data.append('date', formData.date);
    data.append('outcome', formData.outcome);
    data.append('rrRatio', formData.rrRatio);
    data.append('narrative', formData.narrative);
    data.append('session', formData.session);
    data.append('direction', formData.direction);
    data.append('disciplineRating', formData.disciplineRating);
    data.append('concepts', JSON.stringify(concepts));
    
    images.forEach(image => {
      data.append('images', image);
    });

    try {
      await axios.post('/api/trades', data);
      alert('Trade Logged Successfully');
      setFormData({ market: 'NAS100', date: new Date().toISOString().split('T')[0], outcome: 'Win', rrRatio: '', narrative: '', session: 'NY AM', direction: 'Long', disciplineRating: 3 });
      setConcepts([]);
      setImages([]);
    } catch (error) {
      console.error(error);
      alert('Failed to log trade');
    }
  };

  const ICT_CONCEPTS = ['MSS', 'BOS', 'FVG', 'IFVG', 'Order Block', 'Liquidity Sweep', 'CISD', 'SMT'];

  const inputStyles = "w-full bg-dark-900 border border-dark-700 text-gray-200 rounded-xl focus:ring-2 focus:ring-trade-blue/40 focus:border-trade-blue transition-all p-4 text-sm font-medium placeholder-gray-600 outline-none";
  const labelStyles = "flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3";

  return (
    <div className="p-4 lg:p-12 max-w-6xl mx-auto animate-fade-in">
      <div className="relative">
        {/* Decor */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-trade-green/5 blur-[120px] rounded-full pointer-events-none"/>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-trade-blue/5 blur-[120px] rounded-full pointer-events-none"/>

        <div className="bg-dark-850 rounded-3xl border border-dark-700 shadow-2xl overflow-hidden relative z-10">
          <div className="p-8 lg:p-12 border-b border-dark-700 bg-gradient-to-br from-dark-800/80 to-transparent">
            <h1 className="text-4xl font-black text-white tracking-tighter mb-2">NEW CASE STUDY</h1>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Documentation and journaling engine</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 lg:p-12 space-y-12">
            
            {/* Section 1: Execution Stats */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-trade-blue/10 flex items-center justify-center text-trade-blue"><BarChart3 size={18}/></div>
                <h3 className="font-black text-white uppercase tracking-tight">Execution Metrics</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className={labelStyles}><Layers size={12}/> Market</label>
                  <select 
                    className={inputStyles}
                    value={formData.market}
                    onChange={e => setFormData({...formData, market: e.target.value})}
                  >
                    <option value="NAS100">NAS100</option>
                    <option value="US500">US500</option>
                    <option value="EURUSD">EURUSD</option>
                    <option value="GBPUSD">GBPUSD</option>
                    <option value="XAUUSD">XAUUSD</option>
                  </select>
                </div>
                
                <div>
                  <label className={labelStyles}><Calendar size={12}/> Session Date</label>
                  <input 
                    type="date" 
                    className={inputStyles}
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <label className={labelStyles}><Target size={12}/> Outcome</label>
                  <div className="grid grid-cols-3 gap-2 bg-dark-900 p-1.5 rounded-xl border border-dark-700">
                    {['Win', 'Loss', 'BE'].map(o => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setFormData({...formData, outcome: o === 'BE' ? 'Breakeven' : o})}
                        className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                          (formData.outcome === (o === 'BE' ? 'Breakeven' : o))
                          ? (o === 'Win' ? 'bg-trade-green text-dark-950 shadow-lg' : o === 'Loss' ? 'bg-trade-red text-white shadow-lg' : 'bg-trade-blue text-white shadow-lg')
                          : 'text-gray-500 hover:bg-dark-800'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelStyles}><Clock size={12}/> Session</label>
                  <div className="grid grid-cols-5 gap-1 bg-dark-900 p-1.5 rounded-xl border border-dark-700">
                    {['London', 'NY AM', 'NY PM', 'Asian', 'Off'].map(s => {
                      const val = s === 'Off' ? 'Off-Session' : s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, session: val})}
                          className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                            formData.session === val
                              ? 'bg-trade-blue text-white shadow-lg'
                              : 'text-gray-500 hover:bg-dark-800'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className={labelStyles}><ArrowUp size={12}/> Direction</label>
                  <div className="grid grid-cols-2 gap-2 bg-dark-900 p-1.5 rounded-xl border border-dark-700">
                    {['Long', 'Short'].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFormData({...formData, direction: d})}
                        className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                          formData.direction === d
                            ? d === 'Long' ? 'bg-trade-green text-dark-950 shadow-lg' : 'bg-trade-red text-white shadow-lg'
                            : 'text-gray-500 hover:bg-dark-800'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelStyles}><Star size={12}/> Discipline Rating</label>
                  <div className="flex gap-2 bg-dark-900 p-1.5 rounded-xl border border-dark-700 justify-center">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFormData({...formData, disciplineRating: n})}
                        className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${
                          formData.disciplineRating >= n
                            ? 'bg-trade-gold text-dark-950 shadow-lg'
                            : 'text-gray-600 hover:bg-dark-800'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelStyles}><DollarSign size={12}/> R:R Multiplier</label>
                  <input 
                    type="number" step="0.01" 
                    placeholder="2.50"
                    className={inputStyles}
                    value={formData.rrRatio}
                    onChange={e => setFormData({...formData, rrRatio: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Confluences */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-trade-green/10 flex items-center justify-center text-trade-green"><Tag size={18}/></div>
                <h3 className="font-black text-white uppercase tracking-tight">Technical confluences</h3>
              </div>

              <div className="flex flex-wrap gap-3">
                {ICT_CONCEPTS.map((concept) => (
                  <label 
                    key={concept} 
                    className={`
                      group cursor-pointer flex items-center px-4 py-3 rounded-2xl border transition-all duration-300
                      ${concepts.includes(concept) 
                        ? 'bg-trade-blue/10 border-trade-blue text-trade-blue ring-4 ring-trade-blue/5 shadow-xl shadow-trade-blue/10' 
                        : 'bg-dark-900 border-dark-700 text-gray-500 hover:border-gray-600'
                      }
                    `}
                  >
                    <input 
                      type="checkbox" 
                      value={concept} 
                      className="hidden"
                      checked={concepts.includes(concept)}
                      onChange={handleConceptChange}
                    />
                    <div className={`w-4 h-4 rounded flex items-center justify-center border mr-3 transition-colors ${concepts.includes(concept) ? 'bg-trade-blue border-trade-blue' : 'border-gray-700'}`}>
                      {concepts.includes(concept) && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">{concept}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Section 3: Charts & Narrative */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-trade-gold/10 flex items-center justify-center text-trade-gold"><ImageIcon size={18}/></div>
                  <h3 className="font-black text-white uppercase tracking-tight">Visual Journal</h3>
                </div>

                <div className="relative group">
                  <div className="w-full h-48 border-2 border-dashed border-dark-700 rounded-3xl group-hover:border-trade-blue transition-all flex flex-col items-center justify-center bg-dark-900/50 cursor-pointer overflow-hidden p-8 text-center ring-0 group-hover:ring-8 ring-trade-blue/5">
                    <UploadCloud size={32} className="text-gray-600 mb-4 group-hover:text-trade-blue transition-colors" />
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-300">Drop screenshot or browse</p>
                    <p className="text-[10px] text-gray-700 mt-2 font-bold">(Up to 3 high-resolution charts)</p>
                    <input 
                      type="file" multiple accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleImageChange}
                    />
                  </div>
                  {images.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex gap-2">
                       {images.map((img, i) => (
                         <div key={i} className="px-3 py-1.5 bg-trade-green/10 text-trade-green border border-trade-green/20 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">
                           <CheckCircle size={10}/> Attached
                         </div>
                       ))}
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500"><PenTool size={18}/></div>
                  <h3 className="font-black text-white uppercase tracking-tight">Psychology & Narrative</h3>
                </div>

                <textarea 
                  rows="6" 
                  placeholder="Record your mindset before execution, performance during hold, and lessons learned..."
                  className={`${inputStyles} resize-none min-h-[192px]`}
                  value={formData.narrative}
                  onChange={e => setFormData({...formData, narrative: e.target.value})}
                  required
                ></textarea>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-6 bg-white text-dark-950 hover:bg-gray-100 rounded-2xl font-black text-base uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(255,255,255,0.05)] transition-all flex justify-center items-center gap-3 active:scale-[0.98]"
            >
              <Save size={20} />
              Commit to Journal
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TradeEntry;
