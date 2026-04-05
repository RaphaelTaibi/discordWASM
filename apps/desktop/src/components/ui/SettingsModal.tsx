import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SettingsModalProps } from '../../models/settingsModalProps.model';
import { ProfileSettings } from '../settings/ProfileSettings';
import { VoiceVideoSettings } from '../settings/VoiceVideoSettings';
import { ActivitySettings } from '../settings/ActivitySettings';
import { UpdateSettings } from '../settings/UpdateSettings';

export const SettingsModal = ({ isOpen, onClose, updateAvailable, updateStatus, triggerUpdate, checkForUpdate }: SettingsModalProps) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'voice' | 'activity' | 'update'>('profile');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        
        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
        }
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#000000]/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex w-[800px] h-[600px] bg-[#050511] rounded-xl overflow-hidden shadow-2xl relative">
                
                {/* Sidebar */}
                <div className="w-[240px] bg-[#020205] flex flex-col py-6 px-4 shrink-0 relative z-10">
                    <nav className="w-full flex flex-col gap-1">
                        <div className="px-2 pb-2 text-[10px] font-black text-cyan-500 uppercase tracking-widest">Paramètres Utilisateur</div>
                        
                        <button 
                            className={`flex items-center gap-3 px-3 py-2 rounded font-bold text-[13px] transition-all duration-200 ${
                                activeTab === 'profile' 
                                ? 'text-white bg-[#0f111a]' 
                                : 'text-gray-400 hover:bg-[#0f111a]/50 hover:text-gray-200'
                            }`}
                            onClick={() => setActiveTab('profile')}
                        >
                            Mon Profil
                        </button>
                        
                        <button 
                            className={`flex items-center gap-3 px-3 py-2 rounded font-bold text-[13px] transition-all duration-200 ${
                                activeTab === 'voice' 
                                ? 'text-white bg-[#0f111a]' 
                                : 'text-gray-400 hover:bg-[#0f111a]/50 hover:text-gray-200'
                            }`}
                            onClick={() => setActiveTab('voice')}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                            Voix & Vidéo
                        </button>
                    </nav>
                    
                    <div className="my-4 h-px bg-white/5 mx-2" />
                    
                    <nav className="w-full flex flex-col gap-1">
                        <div className="px-2 pb-2 text-[10px] font-black text-cyan-500 uppercase tracking-widest">Paramètres d'activité</div>
                        <button 
                            className={`flex items-center gap-3 px-3 py-2 rounded font-bold text-[13px] transition-all duration-200 ${
                                activeTab === 'activity' 
                                ? 'text-white bg-[#0f111a]' 
                                : 'text-gray-400 hover:bg-[#0f111a]/50 hover:text-gray-200'
                            }`}
                            onClick={() => setActiveTab('activity')}
                        >
                            Jeux enregistrés
                        </button>
                    </nav>
                    
                    <div className="my-4 h-px bg-white/5 mx-2" />
                    
                    <nav className="w-full flex flex-col gap-1">
                        <div className="px-2 pb-2 text-[10px] font-black text-cyan-500 uppercase tracking-widest">Système</div>
                        <button 
                            className={`flex items-center justify-between px-3 py-2 rounded font-bold text-[13px] transition-all duration-200 ${
                                activeTab === 'update' 
                                ? 'text-white bg-[#0f111a]' 
                                : 'text-gray-400 hover:bg-[#0f111a]/50 hover:text-gray-200'
                            }`}
                            onClick={() => setActiveTab('update')}
                        >
                            Mises à jour 
                            {updateAvailable && <span className="w-2.5 h-2.5 bg-red-400 rounded-full" />}
                        </button>
                    </nav>
                </div>
                
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative bg-[#0a0b14] z-10 w-full">
                    <div className="absolute top-6 right-6 z-50">
                        <button 
                            className="w-8 h-8 rounded-full border border-[#1a3a4c] text-gray-400 flex items-center justify-center hover:text-white hover:border-cyan-400 transition-colors"
                            onClick={onClose}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar relative">
                        <div className="max-w-[500px] h-full">
                            {activeTab === 'profile' && <ProfileSettings />}
                            {activeTab === 'voice' && <VoiceVideoSettings />}
                            {activeTab === 'activity' && <ActivitySettings />}
                            {activeTab === 'update' && (
                                <UpdateSettings 
                                    updateAvailable={updateAvailable}
                                    updateStatus={updateStatus}
                                    triggerUpdate={triggerUpdate}
                                    checkForUpdate={checkForUpdate}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default SettingsModal;
