import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useServer } from '../../context/ServerContext';
import { X, Globe, Plus } from 'lucide-react';

interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerModal = ({ isOpen, onClose }: ServerModalProps) => {
  const { createServer, joinServer } = useServer();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (tab === 'create') {
      createServer(inputValue);
    } else {
      joinServer(inputValue);
    }
    setInputValue('');
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#000000]/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-[450px] bg-[#0a0b14] border border-cyan-500/30 rounded-2xl overflow-hidden text-cyan-100 shadow-[0_0_50px_rgba(34,211,238,0.15)] relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 flex justify-center">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80 blur-[4px]"></div>
            <div className="absolute w-1/2 h-full bg-cyan-200 blur-[2px]"></div>
        </div>

        <div className="flex justify-between items-center px-6 py-5 bg-[#050511]/80 border-b border-cyan-500/10">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 tracking-wider">
            {tab === 'create' ? 'Créer un Serveur' : 'Rejoindre un Serveur'}
          </h2>
          <button onClick={onClose} className="text-cyan-500/50 hover:text-cyan-300 hover:scale-110 transition-all duration-200 focus:outline-none">
            <X size={22} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-8 bg-[#050511] p-1.5 rounded-lg border border-cyan-500/20">
            <button
              onClick={() => setTab('create')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-bold rounded-md transition-all duration-300 ${
                tab === 'create' 
                ? 'bg-cyan-500/20 text-cyan-50 shadow-[0_0_15px_rgba(34,211,238,0.15)] outline outline-1 outline-cyan-500/30' 
                : 'text-cyan-500/50 hover:text-cyan-300 hover:bg-cyan-500/5'
              }`}
            >
              <Plus size={16} /> Créer
            </button>
            <button
              onClick={() => setTab('join')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-bold rounded-md transition-all duration-300 ${
                tab === 'join' 
                ? 'bg-cyan-500/20 text-cyan-50 shadow-[0_0_15px_rgba(34,211,238,0.15)] outline outline-1 outline-cyan-500/30' 
                : 'text-cyan-500/50 hover:text-cyan-300 hover:bg-cyan-500/5'
              }`}
            >
              <Globe size={16} /> Rejoindre
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label className="block text-[11px] font-black text-cyan-500/70 uppercase tracking-widest mb-3">
                {tab === 'create' ? 'Nom du Serveur' : 'Code d\'invitation ou ID'}
              </label>
              <div className="relative group">
                  <div className="absolute inset-0 bg-cyan-400/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={tab === 'create' ? 'Mon super serveur...' : 'ex: ds9f8-dsv88...'}
                    className="w-full relative bg-[#050511] text-cyan-50 px-4 py-3 rounded-lg border border-cyan-500/30 focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all placeholder-cyan-500/30 font-medium"
                    autoFocus
                  />
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-cyan-500/10">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-5 py-2.5 text-[14px] font-bold text-cyan-500/70 hover:text-cyan-300 transition-colors"
              >
                Annuler
              </button>
              <button 
                type="submit" 
                disabled={!inputValue.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[14px] font-bold rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                {tab === 'create' ? 'Initialiser' : 'Connexion'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
