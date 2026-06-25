import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  BrainCircuit,
  Sparkles,
  Info,
  ChevronDown
} from 'lucide-react';

const AICoach = () => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Connection established. I am your EdgeWonk AI Mentor. I have analyzed your recent session data. How can I help you refine your edge today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userMessage = { role: 'user', content: prompt.trim() };
    // Send all messages except the initial greeting as history
    const history = messages.slice(1);

    setMessages(prev => [...prev, userMessage, { role: 'ai', content: '' }]);
    setPrompt('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const baseURL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseURL}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: userMessage.content, history })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'AI server error' }));
        throw new Error(err.message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'ai', content: fullContent };
          return updated;
        });
      }
    } catch (error) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'ai',
          content: `CRITICAL ERROR: ${error.message || 'Failed to connect. Ensure Ollama is running.'}`
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col animate-fade-in">
      <div className="flex-1 max-w-5xl mx-auto w-full flex flex-col relative">

        {/* Header */}
        <div className="px-4 lg:px-0 pt-4 lg:pt-12 pb-6 border-b border-dark-700 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-trade-blue/20 rounded-2xl flex items-center justify-center relative">
              <BrainCircuit className="text-trade-blue h-6 w-6" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-trade-green rounded-full border-2 border-dark-800 animate-pulse"/>
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-none mb-1 flex items-center gap-2">
                EDGE ANALYSIS ENGINE
                <span className="text-[10px] bg-trade-blue/10 text-trade-blue px-2 py-0.5 rounded-md border border-trade-blue/20 tracking-widest font-black">BETA</span>
              </h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Local LLM Interface · Context Aware</p>
            </div>
          </div>
          <button className="p-2 text-gray-500 hover:text-white transition-colors bg-dark-900 rounded-xl border border-dark-700">
             <Info size={18} />
          </button>
        </div>

        {/* Chat Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 lg:px-0 py-8 space-y-8 custom-scrollbar"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => msg.role === 'ai' && msg.content === '' ? null : (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-4 max-w-[85%] lg:max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                    msg.role === 'user' 
                      ? 'bg-white border-dark-700 text-dark-950' 
                      : 'bg-dark-800 border-dark-700 text-trade-blue shadow-lg'
                  }`}>
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className="space-y-1">
                    <p className={`text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.role === 'user' ? 'QUANT' : 'MENTOR'}
                    </p>
                    <div className={`p-5 rounded-2xl shadow-xl leading-relaxed text-sm ${
                      msg.role === 'user' 
                        ? 'bg-dark-850 border border-dark-700 text-gray-100 rounded-tr-none' 
                        : 'bg-dark-800 border-t-2 border-t-trade-blue/40 border-dark-700 text-gray-300 rounded-tl-none font-medium'
                    }`}>
                      <p className="whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="flex gap-4 max-w-[80%]">
                <div className="w-10 h-10 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-trade-blue">
                  <Bot size={18} className="animate-bounce" />
                </div>
                <div className="p-6 rounded-2xl bg-dark-800 border border-dark-700 rounded-tl-none flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-trade-blue animate-pulse"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-trade-blue animate-pulse delay-75"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-trade-blue animate-pulse delay-150"></div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 lg:px-0 pt-4 pb-6 lg:pb-12 border-t border-dark-700">
          <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto w-full group">
            <input 
              type="text" 
              placeholder="Query the mentor engine... e.g. Analyze my drawdown on NAS100"
              className="w-full bg-dark-900 border border-dark-700 text-gray-200 rounded-2xl pl-14 pr-16 py-5 focus:ring-4 focus:ring-trade-blue/10 focus:border-trade-blue transition-all outline-none text-sm font-medium shadow-2xl"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={isLoading}
            />
            <div className="absolute left-5 text-gray-600 group-focus-within:text-trade-blue transition-colors">
              <Sparkles size={20} />
            </div>
            <button 
              type="submit" 
              disabled={!prompt.trim() || isLoading}
              className="absolute right-3.5 p-3.5 bg-trade-blue hover:bg-trade-blue/80 text-white rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-trade-blue/20 active:scale-95"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="mt-4 flex justify-center items-center gap-6">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-trade-green"/> System Online
            </span>
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] flex items-center gap-2 cursor-pointer hover:text-gray-400">
              Model: Claude Sonnet <ChevronDown size={10}/>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AICoach;
