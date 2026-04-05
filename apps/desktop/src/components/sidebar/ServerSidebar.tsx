import { useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { ServerModal } from '../ui/ServerModal';

export const ServerSidebar = () => {
    const { servers, activeServerId, setActiveServerId } = useServer();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <nav className="hidden group relative md:flex w-20 flex-col items-center py-4 gap-4 bg-[#030308]/90 backdrop-blur-3xl border-r border-cyan-500/20 shrink-0 z-20 shadow-[4px_0_30px_rgba(0,0,0,0.8)] before:absolute before:inset-0 before:bg-gradient-to-b before:from-cyan-900/5 before:to-transparent before:pointer-events-none">
            {/* SOS Pill - Default Server */}
            <div 
                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold transition-all duration-300 cursor-pointer overflow-hidden group/sos
                    ${activeServerId === 'sos' 
                        ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.5)] border border-cyan-400/50' 
                        : 'bg-[#0a0b14] border border-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:rounded-xl'}`}
                onClick={() => setActiveServerId('sos')}
            >
                <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-400/20 to-blue-400/20 opacity-0 transition-opacity duration-300 ${activeServerId !== 'sos' ? 'group-hover/sos:opacity-100' : ''}`} />
                <span className="relative z-10 text-[10px] uppercase tracking-widest font-black">SOS</span>
            </div>
            
            {/* Separator */}
            <div className="w-10 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent rounded-full opacity-50" />
            
            {/* Server List */}
            <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto overflow-x-hidden custom-scrollbar py-2 px-1">
                {servers.map(server => (
                    <div 
                        key={server.id}
                        title={server.name}
                        className={`relative w-12 h-12 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden group/srv
                        ${activeServerId === server.id 
                            ? 'rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-[0_0_20px_rgba(129,140,248,0.5)] border border-indigo-400/50' 
                            : 'rounded-2xl bg-[#0a0b14] text-cyan-200/60 border border-white/5 hover:border-indigo-500/40 hover:text-white hover:shadow-[0_0_15px_rgba(129,140,248,0.3)] hover:rounded-xl'}
                        `}
                        onClick={() => setActiveServerId(server.id)}
                    >
                        {server.icon ? (
                           <img src={server.icon} alt={server.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/srv:scale-110" />
                        ) : (
                           <span className="relative z-10 font-bold text-xs text-center tracking-wider">
                               {server.name.substring(0, 3).toUpperCase()}
                           </span>
                        )}
                        <div className={`absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 opacity-0 transition-opacity duration-300 ${activeServerId !== server.id ? 'group-hover/srv:opacity-100' : ''}`} />
                    </div>
                ))}
            </div>

            {/* Create Server Button */}
            <div 
                className="relative mt-2 w-12 h-12 bg-[#0a0b14] border border-cyan-500/20 rounded-2xl flex items-center justify-center text-cyan-400/50 hover:text-cyan-300 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:bg-cyan-900/40 transition-all duration-300 cursor-pointer overflow-hidden group/add"
                onClick={() => setIsModalOpen(true)}
            >
                <div className="absolute inset-0 scale-0 rounded-full bg-cyan-400/20 transition-transform duration-300 group-hover/add:scale-[2]" />
                <span className="relative z-10 text-xl font-light leading-none mb-1">+</span>
            </div>
            
            <ServerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </nav>
    );
};
