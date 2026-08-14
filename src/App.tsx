/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  FlaskConical, 
  Settings, 
  Play, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Info,
  ArrowRight,
  Loader2,
  Sparkles,
  Dna,
  Zap,
  Globe,
  Maximize2,
  RefreshCw,
  Key,
  X,
  Eye,
  EyeOff,
  Check,
  Users,
  Code2,
  ExternalLink,
  Moon,
  Sun
} from 'lucide-react';
import { generateExperiment, type AIProvider } from './services/gemini';
import ReactMarkdown from 'react-markdown';
import p5 from 'p5';

interface ExperimentSpec {
  meta: {
    title: string;
    subject: string;
    topic: string;
    gradeLevel: string;
    estimatedDurationMinutes: number;
  };
  visualSimulation: {
    sceneDescription: string;
    simulationCode: string;
    objects: any[];
    controls: any[];
    visualBehaviors: any[];
    measurementDisplays: any[];
  };
  labGuide: {
    learningObjectives: string[];
    materials: string[];
    procedure: string[];
    safetyPrecautions: string[];
    scienceExplanation: {
      intuitiveOverview: string;
      formalExplanation: string;
      keyEquations: string[];
    };
    checkYourUnderstanding: any[];
  };
  phetAnalogy: {
    description: string;
    recommendedPhETCategory: string;
  };
}

const SimulationCanvas = ({ code }: { code: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Instance = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous instance
    if (p5Instance.current) {
      p5Instance.current.remove();
    }

    const sketch = (p: any) => {
      try {
        // The code from Gemini is expected to define p.setup, p.draw, etc.
        // We pass p5 as well in case the code needs to reference p5 constants or classes
        const runCode = new Function('p', 'p5', code);
        runCode(p, p5);
      } catch (err) {
        console.error('Error in simulation code:', err);
        p.setup = () => {
          p.createCanvas(800, 600);
        };
        p.draw = () => {
          p.background(255, 200, 200);
          p.fill(0);
          p.textAlign(p.CENTER, p.CENTER);
          p.text('Error loading simulation code.\nCheck console for details.', p.width / 2, p.height / 2);
        };
      }
    };

    try {
      // Ensure we are using the constructor correctly
      const P5Constructor = (p5 as any).default || p5;
      p5Instance.current = new P5Constructor(sketch, containerRef.current);
    } catch (err) {
      console.error('Failed to initialize p5:', err);
    }

    return () => {
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
    };
  }, [code]);

  return (
    <div className="relative w-full bg-white brutal-border brutal-shadow overflow-hidden group">
      <div ref={containerRef} className="w-full flex justify-center bg-[#f0f0f0]" />
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => {
            if (p5Instance.current && containerRef.current) {
              p5Instance.current.remove();
              const sketch = (p: any) => {
                const runCode = new Function('p', 'p5', code);
                runCode(p, p5);
              };
              const P5Constructor = (p5 as any).default || p5;
              p5Instance.current = new P5Constructor(sketch, containerRef.current);
            }
          }}
          className="p-2 bg-white brutal-border brutal-shadow-hover" title="Reset Simulation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [experiment, setExperiment] = useState<ExperimentSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [activeTab, setActiveTab] = useState<'simulation' | 'guide' | 'quiz'>('simulation');
  const [easterEggInfo, setEasterEggInfo] = useState<{ url: string; title: string; subtitle: string } | null>(null);
  const [isQuantumMode, setIsQuantumMode] = useState(false);
  const [isQuantumUnlocked, setIsQuantumUnlocked] = useState(false);
  const [quantumBannerMsg, setQuantumBannerMsg] = useState<string | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (promptInputRef.current) {
      promptInputRef.current.style.height = 'auto';
      promptInputRef.current.style.height = `${Math.max(80, promptInputRef.current.scrollHeight)}px`;
    }
  }, [prompt]);

  const unlockQuantumDarkMode = () => {
    setIsQuantumUnlocked(true);
    const activeQuantumMode = !isQuantumMode;
    setIsQuantumMode(activeQuantumMode);
    setQuantumBannerMsg(
      activeQuantumMode 
        ? '⚡ dark mode activated'
        : 'dark mode deactivated'
    );
    setExperiment(null);
    setPrompt('');
    setError(null);
    setEasterEggInfo(null);
  };

  // Sync quantum mode class with document body
  useEffect(() => {
    if (isQuantumMode) {
      document.body.classList.add('quantum-mode');
    } else {
      document.body.classList.remove('quantum-mode');
    }
  }, [isQuantumMode]);

  // Sync tab title with active experiment or default
  useEffect(() => {
    if (experiment?.meta?.title) {
      document.title = `${experiment.meta.title} | Thinking Physics`;
    } else {
      document.title = 'Thinking Physics';
    }
  }, [experiment]);

  // API Key management state
  const [aiProvider, setAiProvider] = useState<AIProvider>(() =>
    localStorage.getItem('scilab_ai_provider') === 'openai' ? 'openai' : 'gemini'
  );
  const keyStorageName = (provider: AIProvider) =>
    provider === 'openai' ? 'scilab_custom_openai_api_key' : 'scilab_custom_api_key';
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    const provider = localStorage.getItem('scilab_ai_provider') === 'openai' ? 'openai' : 'gemini';
    return localStorage.getItem(provider === 'openai' ? 'scilab_custom_openai_api_key' : 'scilab_custom_api_key') || '';
  });
  const [savedKey, setSavedKey] = useState(() => {
    const provider = localStorage.getItem('scilab_ai_provider') === 'openai' ? 'openai' : 'gemini';
    return localStorage.getItem(provider === 'openai' ? 'scilab_custom_openai_api_key' : 'scilab_custom_api_key') || '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showKeyText, setShowKeyText] = useState(false);
  const [keySavedMessage, setKeySavedMessage] = useState(false);

  const handleSaveKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      localStorage.setItem(keyStorageName(aiProvider), trimmed);
      setSavedKey(trimmed);
    } else {
      localStorage.removeItem(keyStorageName(aiProvider));
      setSavedKey('');
    }
    setKeySavedMessage(true);
    setTimeout(() => setKeySavedMessage(false), 2500);
    setQuotaExceeded(false);
    setError(null);
  };

  const handleClearKey = () => {
    localStorage.removeItem(keyStorageName(aiProvider));
    setApiKeyInput('');
    setSavedKey('');
    setKeySavedMessage(false);
  };

  const handleProviderChange = (provider: AIProvider) => {
    localStorage.setItem('scilab_ai_provider', provider);
    setAiProvider(provider);
    const key = localStorage.getItem(keyStorageName(provider)) || '';
    setApiKeyInput(key);
    setSavedKey(key);
    setKeySavedMessage(false);
    setError(null);
  };

  const handleSelectKey = async () => {
    try {
      if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        setQuotaExceeded(false);
        setError(null);
      } else {
        setShowKeyModal(true);
      }
    } catch (err) {
      console.error('Failed to open key selection:', err);
      setShowKeyModal(true);
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    const normalizedPrompt = prompt.trim().toLowerCase();
    if (normalizedPrompt.includes('car simulation')) {
      window.open('https://slowroads.io/#A2-0294ca62@0', '_blank', 'noopener,noreferrer');
      setEasterEggInfo({
        url: 'https://slowroads.io/#A2-0294ca62@0',
        title: 'Slow Roads Car Simulation',
        subtitle: 'Opening Slow Roads Car Simulation in a new page...'
      });
      setError(null);
      return;
    }

    if (normalizedPrompt.includes('how to declutter')) {
      window.open('https://neal.fun/stimulation-clicker/', '_blank', 'noopener,noreferrer');
      setEasterEggInfo({
        url: 'https://neal.fun/stimulation-clicker/',
        title: 'Stimulation Clicker',
        subtitle: 'Opening Stimulation Clicker in a new page...'
      });
      setError(null);
      return;
    }

    // Check for "dark mode" Quantum Mode code trigger
    if (normalizedPrompt === 'dark mode' || normalizedPrompt === 'darkmode' || normalizedPrompt.includes('dark mode')) {
      unlockQuantumDarkMode();
      return;
    } else {
      setQuantumBannerMsg(null);
    }

    setEasterEggInfo(null);
    setLoading(true);
    setError(null);
    setQuotaExceeded(false);
    try {
      const result = await generateExperiment(prompt, savedKey, isQuantumMode, aiProvider);
      setExperiment(result);
      setActiveTab('simulation');
    } catch (err: any) {
      console.error(err);
      if (err.message === 'QUOTA_EXCEEDED') {
        setQuotaExceeded(true);
        setError(`The ${aiProvider === 'openai' ? 'OpenAI' : 'shared Gemini'} API quota has been reached. Please enter a valid API key to continue.`);
        setShowKeyModal(true);
      } else {
        setError(err.message || 'Failed to generate experiment. Please check your API key and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const subjects = [
    { name: 'Physics', icon: <Zap className="w-4 h-4" />, color: 'bg-blue-500' },
    { name: 'Chemistry', icon: <FlaskConical className="w-4 h-4" />, color: 'bg-orange-500' },
    { name: 'Biology', icon: <Dna className="w-4 h-4" />, color: 'bg-green-500' },
    { name: 'Earth Science', icon: <Globe className="w-4 h-4" />, color: 'bg-brown-500' },
  ];

  return (
    <div className="min-h-screen bg-gallery-white flex flex-col">
      {/* Header */}
      <header className="brutal-border border-t-0 border-x-0 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => {
              setExperiment(null);
              setError(null);
            }}
            title="Go to Home / New Experiment"
          >
            <div className="w-10 h-10 bg-neon-green brutal-border flex items-center justify-center brutal-shadow group-hover:translate-x-[1px] group-hover:translate-y-[1px] transition-transform">
              <FlaskConical className="text-brutal-black" />
            </div>
            <h1 className="font-display text-2xl tracking-tight uppercase">Thinking Physics</h1>
          </div>
          <div className="flex items-center gap-4">
            {isQuantumUnlocked && (
              <button
                onClick={() => {
                  const next = !isQuantumMode;
                  setIsQuantumMode(next);
                  setExperiment(null);
                  setQuantumBannerMsg(
                    next 
                      ? '⚡ dark mode activated'
                      : 'dark mode deactivated'
                  );
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase brutal-border brutal-shadow-hover transition-all cursor-pointer ${
                  isQuantumMode 
                    ? 'bg-purple-900 text-cyan-300 border-cyan-400' 
                    : 'bg-gallery-white text-brutal-black'
                }`}
                title="Toggle Quantum Dark Mode"
                id="quantum-mode-toggle-btn"
              >
                <Sparkles className={`w-4 h-4 ${isQuantumMode ? 'text-cyan-300 animate-pulse' : 'text-purple-600'}`} />
                <span className="hidden sm:inline">{isQuantumMode ? 'Quantum Mode ⚡' : 'Quantum Mode'}</span>
              </button>
            )}
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gallery-white brutal-border brutal-shadow-hover text-xs font-bold uppercase transition-all"
              id="header-api-key-button"
            >
              <Key className="w-4 h-4 text-brutal-black" />
              <span>API Key</span>
              {savedKey ? (
                <span className="w-2.5 h-2.5 rounded-full bg-neon-green brutal-border inline-block" title="Custom API Key Active" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 brutal-border inline-block" title="Default / Shared Key" />
              )}
            </button>
            <nav className="flex gap-8">
              <button
                onClick={() => setShowAboutModal(true)}
                className="text-sm font-bold uppercase hover:underline underline-offset-4 cursor-pointer"
                id="header-about-button"
              >
                About
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
        {/* Quantum Mode Notification Banner */}
        {quantumBannerMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-3xl mx-auto mb-8 p-5 brutal-border flex items-center justify-between gap-4 brutal-shadow ${
              isQuantumMode ? 'bg-purple-950/80 text-cyan-300 border-cyan-400' : 'bg-emerald-100 text-brutal-black'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 shrink-0 text-cyan-400 animate-bounce" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wider">{quantumBannerMsg}</p>
              </div>
            </div>
            <button
              onClick={() => setQuantumBannerMsg(null)}
              className="p-1 hover:opacity-75 cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* Easter Egg Banner */}
        {easterEggInfo && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto mb-8 p-6 brutal-border bg-neon-green/30 flex flex-col md:flex-row items-center justify-between gap-4 brutal-shadow"
          >
            <div className="flex items-center gap-4">
              <Sparkles className="text-brutal-black w-8 h-8 shrink-0" />
              <div>
                <h4 className="font-bold text-lg uppercase tracking-tight">Easter Egg Unlocked! 🎮</h4>
                <p className="text-xs font-medium text-gray-800">{easterEggInfo.subtitle}</p>
              </div>
            </div>
            <a 
              href={easterEggInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-brutal-black text-neon-green font-bold uppercase text-xs brutal-shadow-hover flex items-center gap-2 shrink-0 cursor-pointer"
              id="easter-egg-link-btn"
            >
              <span>Launch {easterEggInfo.title}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto mb-8 p-6 brutal-border bg-red-100 flex flex-col md:flex-row items-center gap-4 brutal-shadow"
          >
            <div className="flex items-center gap-4 flex-grow">
              <AlertTriangle className="text-red-600 w-8 h-8 shrink-0" />
              <p className="font-bold text-red-900">{error}</p>
            </div>
            <button 
              onClick={() => setShowKeyModal(true)}
              className="px-6 py-2 bg-white brutal-border font-bold uppercase text-sm brutal-shadow-hover whitespace-nowrap flex items-center gap-2"
              id="error-set-api-key-btn"
            >
              <Key className="w-4 h-4" />
              Set API Key
            </button>
          </motion.div>
        )}

        {/* Hero / Input Section */}
        {!experiment && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 mb-20 text-center"
          >
            <h2 className="font-display text-6xl md:text-8xl mb-6 leading-none uppercase">
              Turn Ideas into <br />
              <span className="text-neon-green bg-brutal-black px-4">Experiments</span>
            </h2>
            <p className="text-xl max-w-2xl mx-auto mb-10 font-medium opacity-70">
              Generate interactive, visual science simulation blueprints for any topic, from quantum physics to cellular biology.
            </p>

            <form onSubmit={handleGenerate} className="max-w-3xl mx-auto relative group">
              <div className="relative flex items-end">
                <textarea 
                  ref={promptInputRef}
                  rows={1}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (prompt.trim() && !loading) {
                        handleGenerate(e);
                      }
                    }
                  }}
                  placeholder="e.g., Refraction of light for class 9..."
                  className="w-full min-h-[80px] py-5 pl-8 pr-44 text-xl brutal-border brutal-shadow focus:outline-none focus:ring-0 focus:bg-gallery-white transition-all resize-none overflow-hidden"
                />
                <button 
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="absolute right-4 top-3.5 h-12 px-6 bg-neon-green brutal-border font-bold uppercase flex items-center gap-2 brutal-shadow-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  Generate
                </button>
              </div>
              
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {['Buoyancy Basics', 'Photosynthesis Grade 7', 'Ohm\'s Law', 'Titration Curves', 'Plate Tectonics'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setPrompt(suggestion)}
                    type="button"
                    className="px-4 py-2 text-xs font-bold uppercase brutal-border bg-white hover:bg-neon-green transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </form>
          </motion.div>
        )}

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gallery-white z-[60] flex flex-col items-center justify-center p-4 text-center"
            >
              <div className="w-24 h-24 brutal-border bg-neon-green flex items-center justify-center brutal-shadow animate-bounce mb-8">
                <FlaskConical className="w-12 h-12" />
              </div>
              <h3 className="font-display text-4xl uppercase mb-4">Synthesizing Experiment...</h3>
              <p className="text-xl font-mono max-w-md">
                Calculating physical constants, designing visual layouts, and drafting lab procedures.
              </p>
              <div className="mt-8 w-64 h-2 brutal-border overflow-hidden">
                <motion.div 
                  className="h-full bg-brutal-black"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, repeat: Infinity }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Experiment View */}
        {experiment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Sidebar / Meta */}
            <aside className="lg:col-span-3 space-y-6">
              <div className="brutal-border bg-white p-6 brutal-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-1 bg-brutal-black text-neon-green text-[10px] font-bold uppercase">
                    {experiment.meta.subject}
                  </span>
                  <span className="px-2 py-1 brutal-border text-[10px] font-bold uppercase">
                    Grade {experiment.meta.gradeLevel}
                  </span>
                </div>
                <h2 className="font-display text-3xl uppercase leading-tight mb-4">
                  {experiment.meta.title}
                </h2>
                <div className="space-y-3 text-sm font-medium">
                  <div className="flex items-center gap-2 opacity-70">
                    <Settings className="w-4 h-4" />
                    <span>Topic: {experiment.meta.topic}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-70">
                    <Play className="w-4 h-4" />
                    <span>Duration: {experiment.meta.estimatedDurationMinutes} mins</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setExperiment(null)}
                  className="mt-8 w-full py-3 brutal-border font-bold uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                >
                  New Experiment
                </button>
              </div>

              <div className="brutal-border bg-neon-green p-6 brutal-shadow">
                <h4 className="font-bold uppercase text-xs mb-2">PhET Analogy</h4>
                <p className="text-sm font-medium leading-relaxed">
                  {experiment.phetAnalogy.description}
                </p>
                <div className="mt-4 pt-4 border-t border-brutal-black/20">
                  <span className="text-[10px] font-bold uppercase opacity-60">Category</span>
                  <p className="text-xs font-bold uppercase">{experiment.phetAnalogy.recommendedPhETCategory}</p>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="lg:col-span-9 space-y-8">
              {/* Tabs */}
              <div className="flex brutal-border bg-white brutal-shadow overflow-hidden">
                {(['simulation', 'guide', 'quiz'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-4 font-display text-xl uppercase transition-colors ${
                      activeTab === tab ? 'bg-brutal-black text-neon-green' : 'hover:bg-gallery-white'
                    } ${tab !== 'quiz' ? 'border-r-2 border-brutal-black' : ''}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="min-h-[600px]">
                {activeTab === 'simulation' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    {/* Interactive Simulation */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-2xl uppercase flex items-center gap-2">
                          <Play className="w-6 h-6 fill-current" />
                          Interactive Simulation
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase opacity-50">
                          <Info className="w-3 h-3" />
                          <span>Powered by p5.js</span>
                        </div>
                      </div>
                      <SimulationCanvas code={experiment.visualSimulation.simulationCode} />
                    </div>

                    {/* Scene Blueprint */}
                    <div className="brutal-border bg-white p-8 brutal-shadow relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <FlaskConical className="w-64 h-64" />
                      </div>
                      
                      <h3 className="font-display text-2xl uppercase mb-6 flex items-center gap-2">
                        <Play className="w-6 h-6 fill-current" />
                        Simulation Blueprint
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                          <h4 className="text-xs font-bold uppercase mb-4 text-gray-500">Scene Layout</h4>
                          <p className="text-lg font-medium leading-relaxed mb-8">
                            {experiment.visualSimulation.sceneDescription}
                          </p>
                          
                          <h4 className="text-xs font-bold uppercase mb-4 text-gray-500">Interactive Objects</h4>
                          <div className="space-y-4">
                            {experiment.visualSimulation.objects.map((obj, idx) => (
                              <div key={idx} className="p-4 brutal-border bg-gallery-white">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-mono text-xs font-bold uppercase px-2 py-0.5 bg-brutal-black text-white">
                                    {obj.id}
                                  </span>
                                  <span className="text-xs font-bold uppercase opacity-60">{obj.type}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                  {Object.entries(obj.properties.initialValues || {}).map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-[10px] uppercase block opacity-50">{k}</span>
                                      <span className="font-mono text-sm">{String(v)} {obj.properties.units?.[k] || ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div>
                            <h4 className="text-xs font-bold uppercase mb-4 text-gray-500">User Controls</h4>
                            <div className="space-y-4">
                              {experiment.visualSimulation.controls.map((ctrl, idx) => (
                                <div key={idx} className="p-4 brutal-border bg-white brutal-shadow-hover cursor-default">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Settings className="w-4 h-4" />
                                    <span className="font-bold uppercase text-sm">{ctrl.label}</span>
                                    <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 brutal-border">
                                      {ctrl.controlType}
                                    </span>
                                  </div>
                                  <p className="text-xs opacity-70 mb-3">{ctrl.effectDescription}</p>
                                  {ctrl.range && (
                                    <div className="h-1 bg-gray-200 rounded-full relative">
                                      <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-3 h-3 bg-brutal-black brutal-border" />
                                      <div className="flex justify-between mt-2 text-[10px] font-mono opacity-50">
                                        <span>{ctrl.range.min}</span>
                                        <span>{ctrl.range.max}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold uppercase mb-4 text-gray-500">Measurement Displays</h4>
                            <div className="grid grid-cols-2 gap-4">
                              {experiment.visualSimulation.measurementDisplays.map((disp, idx) => (
                                <div key={idx} className="p-4 brutal-border bg-brutal-black text-neon-green font-mono">
                                  <div className="text-[10px] uppercase opacity-60 mb-1">{disp.type}</div>
                                  <div className="text-sm font-bold">{disp.shows}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visual Behaviors */}
                    <div className="brutal-border bg-white p-8 brutal-shadow">
                      <h3 className="font-display text-2xl uppercase mb-6 flex items-center gap-2">
                        <Zap className="w-6 h-6" />
                        Dynamic Behaviors
                      </h3>
                      <div className="space-y-4">
                        {experiment.visualSimulation.visualBehaviors.map((behavior, idx) => (
                          <div key={idx} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 brutal-border hover:bg-gallery-white transition-colors">
                            <div className="flex-1">
                              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">When</span>
                              <code className="font-mono text-sm bg-brutal-black text-white px-2 py-1">{behavior.when}</code>
                            </div>
                            <ArrowRight className="hidden md:block w-6 h-6 text-neon-green" />
                            <div className="flex-1">
                              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Then</span>
                              <p className="font-medium">{behavior.then}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'guide' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="md:col-span-2 space-y-8">
                        <div className="brutal-border bg-white p-8 brutal-shadow">
                          <h3 className="font-display text-2xl uppercase mb-6 flex items-center gap-2">
                            <BookOpen className="w-6 h-6" />
                            Science Explanation
                          </h3>
                          <div className="prose prose-slate max-w-none">
                            <h4 className="font-bold uppercase text-sm mb-2 text-neon-green bg-brutal-black inline-block px-2">Intuitive Overview</h4>
                            <p className="text-lg font-medium leading-relaxed mb-8">
                              {experiment.labGuide.scienceExplanation.intuitiveOverview}
                            </p>
                            
                            <h4 className="font-bold uppercase text-sm mb-2 text-neon-green bg-brutal-black inline-block px-2">Formal Explanation</h4>
                            <div className="text-base leading-relaxed space-y-4">
                              <ReactMarkdown>{experiment.labGuide.scienceExplanation.formalExplanation}</ReactMarkdown>
                            </div>

                            {experiment.labGuide.scienceExplanation.keyEquations.length > 0 && (
                              <div className="mt-8 p-6 bg-gallery-white brutal-border">
                                <h4 className="text-xs font-bold uppercase mb-4">Key Equations</h4>
                                <div className="space-y-4">
                                  {experiment.labGuide.scienceExplanation.keyEquations.map((eq, idx) => (
                                    <div key={idx} className="font-mono text-xl text-center py-4 bg-white brutal-border">
                                      {eq}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="brutal-border bg-white p-8 brutal-shadow">
                          <h3 className="font-display text-2xl uppercase mb-6 flex items-center gap-2">
                            <Settings className="w-6 h-6" />
                            Procedure
                          </h3>
                          <div className="space-y-6">
                            {experiment.labGuide.procedure.map((step, idx) => (
                              <div key={idx} className="flex gap-6 items-start">
                                <div className="w-10 h-10 shrink-0 brutal-border bg-brutal-black text-neon-green flex items-center justify-center font-display text-xl">
                                  {idx + 1}
                                </div>
                                <p className="text-lg font-medium pt-1">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div className="brutal-border bg-white p-6 brutal-shadow">
                          <h4 className="font-display text-xl uppercase mb-4">Learning Objectives</h4>
                          <ul className="space-y-3">
                            {experiment.labGuide.learningObjectives.map((obj, idx) => (
                              <li key={idx} className="flex gap-2 items-start text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-neon-green" />
                                <span>{obj}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="brutal-border bg-white p-6 brutal-shadow">
                          <h4 className="font-display text-xl uppercase mb-4">Materials Needed</h4>
                          <ul className="space-y-3">
                            {experiment.labGuide.materials.map((mat, idx) => (
                              <li key={idx} className="flex gap-2 items-start text-sm font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-brutal-black mt-1.5 shrink-0" />
                                <span>{mat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="brutal-border bg-red-50 p-6 brutal-shadow">
                          <h4 className="font-display text-xl uppercase mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Safety
                          </h4>
                          <ul className="space-y-3">
                            {experiment.labGuide.safetyPrecautions.map((safe, idx) => (
                              <li key={idx} className="text-xs font-bold uppercase leading-tight">
                                • {safe}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'quiz' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="max-w-3xl mx-auto space-y-8"
                  >
                    <div className="text-center mb-12">
                      <h3 className="font-display text-4xl uppercase mb-4">Check Your Understanding</h3>
                      <p className="text-lg opacity-70">Test your knowledge of the concepts covered in this experiment.</p>
                    </div>

                    {experiment.labGuide.checkYourUnderstanding.map((q, qIdx) => (
                      <div key={qIdx} className="brutal-border bg-white p-8 brutal-shadow">
                        <div className="flex gap-4 mb-6">
                          <span className="font-display text-2xl opacity-20">Q{qIdx + 1}</span>
                          <h4 className="text-xl font-bold leading-tight">{q.question}</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {q.options.map((opt: string, oIdx: number) => (
                            <button
                              key={oIdx}
                              className="p-4 brutal-border text-left font-medium hover:bg-neon-green transition-colors group flex items-center justify-between"
                            >
                              <span>{opt}</span>
                              <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                        <div className="mt-8 pt-8 border-t-2 border-dashed border-brutal-black/10">
                          <details className="group">
                            <summary className="cursor-pointer list-none flex items-center gap-2 font-bold uppercase text-xs text-gray-400 hover:text-brutal-black transition-colors">
                              <Info className="w-4 h-4" />
                              Show Correct Answer & Explanation
                            </summary>
                            <div className="mt-4 p-4 bg-neon-green/10 brutal-border">
                              <p className="font-bold mb-2">Correct Answer: {q.options[q.correctOptionIndex]}</p>
                              <p className="text-sm leading-relaxed">{q.explanation}</p>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="brutal-border border-b-0 border-x-0 bg-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-neon-green brutal-border flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-brutal-black" />
            </div>
            <span className="font-display text-xl uppercase">Thinking Physics</span>
          </div>
          <div className="text-xs font-mono opacity-50">
            © 2026 Quantum Coders. All rights reserved.
          </div>
        </div>
      </footer>

      {/* About Modal */}
      <AnimatePresence>
        {showAboutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowAboutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white brutal-border brutal-shadow max-w-2xl w-full p-6 sm:p-8 relative my-8 max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b-2 border-brutal-black mb-6 sticky top-0 bg-white z-10 pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-neon-green brutal-border flex items-center justify-center font-bold">
                    <FlaskConical className="w-5 h-5 text-brutal-black" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl uppercase tracking-tight">About Thinking Physics</h3>
                    <p className="text-xs font-mono text-gray-600">AI-Powered Visual Science Simulations</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="p-1.5 hover:bg-gallery-white brutal-border transition-colors cursor-pointer"
                  id="close-about-modal-btn"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              <div className="space-y-6 text-sm leading-relaxed text-brutal-black">
                {/* Description */}
                <div className="space-y-3 bg-gallery-white p-4 brutal-border">
                  <p>
                    <strong>Thinking Physics</strong> is an AI-powered tool that turns simple text prompts into interactive, visual science simulations. Instead of reading a static explanation of a concept, students can type in a topic anything from &quot;refraction of light for class 9&quot; to &quot;photosynthesis grade 7&quot; and instantly get a working, explorable simulation built around it. The goal is to make abstract scientific ideas tangible, so learning feels like experimenting rather than memorizing.
                  </p>
                  <p className="text-gray-700">
                    Under the hood, the project uses gemini api to generate simulation blueprints from natural language prompts, converting them into interactive visual experiments that students and teachers can use directly in the classroom or for self-study.
                  </p>
                </div>

                {/* Our Team */}
                <div className="border-t-2 border-brutal-black pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-brutal-black" />
                    <h4 className="font-display text-lg uppercase tracking-tight">Our Team</h4>
                  </div>
                  <p className="text-xs font-semibold mb-3">This project was built by a team of three students:</p>
                  <ul className="space-y-2.5">
                    <li className="p-3 bg-white brutal-border brutal-shadow-hover text-xs">
                      <span className="font-bold text-black text-sm">Nandan Lakshmanan (12B)</span>
                      <span className="block text-gray-700 mt-0.5">— Worked on the project development, helping bring the simulation generation pipeline to life.</span>
                    </li>
                    <li className="p-3 bg-white brutal-border brutal-shadow-hover text-xs">
                      <span className="font-bold text-black text-sm">Puneet Deepak (12A)</span>
                      <span className="block text-gray-700 mt-0.5">— Worked on the project development, helping bring the simulation generation pipeline to life.</span>
                    </li>
                    <li className="p-3 bg-white brutal-border brutal-shadow-hover text-xs">
                      <span className="font-bold text-black text-sm">Yogith Kumaran (12C)</span>
                      <span className="block text-gray-700 mt-0.5">— Contributed the informational content across multiple pages of the project and maintained the project log book, documenting the development process from start to finish.</span>
                    </li>
                  </ul>
                </div>

                {/* Tech Stack & Message */}
                <div className="border-t-2 border-brutal-black pt-5 space-y-4">
                  <div className="flex items-start gap-2 text-xs bg-emerald-50 p-3.5 brutal-border">
                    <Code2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      The project is made using various tools such as <strong>React</strong> frontend using <strong>TypeScript</strong>, <strong>Tailwind CSS</strong>, <strong>Lucide icons</strong>, <strong>Framer Motion</strong>, and <strong>p5.js</strong>, powered by a <strong>Node.js/Express</strong> backend with <strong>SQLite</strong> (<code className="font-mono bg-emerald-100 px-1 py-0.5 border border-emerald-300 rounded-xs">better-sqlite3</code>) and integrated with the <strong>Google Gemini API</strong>.
                    </span>
                  </div>

                  <div className="text-center p-4 bg-neon-green/20 brutal-border space-y-1">
                    <p className="font-bold text-sm">
                      Hope it helps all of you learn and study 😄😄😄
                    </p>
                    <p className="text-xs font-mono uppercase tracking-wide text-gray-800">
                      all the best at whatever you are trying to learn.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
            onClick={() => setShowKeyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white brutal-border brutal-shadow max-w-md w-full p-6 relative"
            >
              <div className="flex items-center justify-between pb-4 border-b-2 border-brutal-black mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-neon-green brutal-border flex items-center justify-center font-bold">
                    <Key className="w-4 h-4 text-brutal-black" />
                  </div>
                  <h3 className="font-display text-2xl uppercase tracking-tight">API Key Settings</h3>
                </div>
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="p-1.5 hover:bg-gallery-white brutal-border transition-colors cursor-pointer"
                  id="close-key-modal-btn"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <form onSubmit={handleSaveKey} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2">AI Provider</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleProviderChange('gemini')}
                        className={`py-2 brutal-border font-bold uppercase text-xs cursor-pointer ${aiProvider === 'gemini' ? 'bg-neon-green' : 'bg-white'}`}
                      >
                        Gemini
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProviderChange('openai')}
                        className={`py-2 brutal-border font-bold uppercase text-xs cursor-pointer ${aiProvider === 'openai' ? 'bg-neon-green' : 'bg-white'}`}
                      >
                        OpenAI
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2">
                      Enter {aiProvider === 'openai' ? 'OpenAI' : 'Gemini'} API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKeyText ? "text" : "password"}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={aiProvider === 'openai' ? 'sk-...' : 'AIzaSy...'}
                        className="w-full px-4 py-3 pr-10 text-sm font-mono brutal-border focus:outline-none bg-gallery-white"
                        id="api-key-input-field"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyText(!showKeyText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black cursor-pointer"
                        title={showKeyText ? "Hide API key" : "Show API key"}
                      >
                        {showKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs opacity-70 mt-1">
                      Your {aiProvider === 'openai' ? 'OpenAI' : 'Gemini'} key is saved in browser local storage and used directly for generating experiment simulations.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-neon-green brutal-border font-bold uppercase text-xs brutal-shadow-hover flex items-center justify-center gap-2 cursor-pointer"
                      id="save-api-key-btn"
                    >
                      <Check className="w-4 h-4" />
                      Save & Use Key
                    </button>
                    {savedKey && (
                      <button
                        type="button"
                        onClick={handleClearKey}
                        className="px-4 py-2.5 bg-red-100 brutal-border font-bold uppercase text-xs brutal-shadow-hover text-red-700 cursor-pointer"
                        id="clear-api-key-btn"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {keySavedMessage && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="p-2 bg-green-100 brutal-border text-xs font-bold text-green-800 text-center"
                    >
                      ✓ API Key saved!
                    </motion.div>
                  )}
                </form>

                {aiProvider === 'gemini' && <div className="border-t-2 border-brutal-black pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase">AI Studio Dialog</p>
                      <p className="text-xs opacity-70">Use platform project selector</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSelectKey();
                        setShowKeyModal(false);
                      }}
                      className="px-4 py-2 bg-white brutal-border font-bold uppercase text-xs brutal-shadow-hover cursor-pointer"
                      id="select-aistudio-key-btn"
                    >
                      Select Key
                    </button>
                  </div>
                </div>}

                <div className="text-xs bg-amber-50 p-3 brutal-border flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Need an API key? Get a {aiProvider === 'openai' ? 'key from' : 'free key at'}{' '}
                    <a
                      href={aiProvider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://aistudio.google.com/app/apikey'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold underline"
                    >
                      {aiProvider === 'openai' ? 'OpenAI Platform' : 'Google AI Studio'}
                    </a>.
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
