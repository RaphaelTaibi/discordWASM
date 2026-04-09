import { useState } from 'react';
import { Hash, Volume2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import CreateChannelModalProps from '../../models/createChannelModalProps.model';
import { ChannelType } from '../../types/channelType.type';

/**
 * Modal for creating a new channel within a server.
 * Allows user to specify name and type (text/voice/video).
 */
export const CreateChannelModal = ({ isOpen, onClose, onCreate }: CreateChannelModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({ name: name.trim().toLowerCase().replace(/\s+/g, '-'), type });
    setName('');
    setType('text');
    onClose();
  };

  const typeOptions: { value: ChannelType; label: string; icon: React.ReactNode }[] = [
    { value: 'text', label: 'Texte', icon: <Hash size={20} /> },
    { value: 'voice', label: 'Vocal', icon: <Volume2 size={20} /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un salon">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Channel type selection */}
        <div>
          <label className="block text-[11px] font-black text-cyan-500/70 uppercase tracking-widest mb-3">
            Type de salon
          </label>
          <div className="flex flex-col gap-3">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-300 ${
                  type === option.value
                    ? 'glass-heavy border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                    : 'glass border-cyan-500/20 text-cyan-500/70 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/40'
                }`}
              >
                <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${type === option.value ? 'bg-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-white/[0.04]'}`}>
                  {option.icon}
                </div>
                <span className="font-bold tracking-wide">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Channel name input */}
        <div>
          <label className="block text-[11px] font-black text-cyan-500/70 uppercase tracking-widest mb-3">
            Nom du salon
          </label>
          <div className="relative group">
            <div className="absolute inset-0 bg-cyan-400/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center glass px-4 py-3 rounded-lg border border-cyan-500/30 focus-within:border-cyan-400 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all">
              <Hash size={18} className="text-cyan-500/50 shrink-0" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="nouveau-salon"
                className="w-full bg-transparent border-none focus:outline-none text-cyan-50 px-3 placeholder-cyan-500/30 font-medium"
                autoFocus
              />
            </div>
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
            disabled={!name.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white text-[14px] font-bold rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 uppercase tracking-wider"
          >
            Créer
          </button>
        </div>
      </form>
    </Modal>
  );
};
