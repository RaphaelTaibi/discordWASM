import { useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { ServerModal } from '../ui/ServerModal';
import bgImage from '../../assets/background.png';

export const ServerSidebar = () => {
    const { servers, activeServerId, setActiveServerId } = useServer();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <nav className="relative flex items-center px-2 gap-2 glass-heavy shrink-0 z-20 shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden rounded-xl h-10 ml-auto mr-2 mt-1 border border-white/[0.06]">
            {/* VOID Logo — Home */}
            <div
                className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold transition-all duration-300 cursor-pointer overflow-hidden shrink-0 group/sos
                    ${activeServerId === null
                        ? 'shadow-[0_0_15px_rgba(34,211,238,0.5)] border border-cyan-400/50'
                        : 'border border-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]'}`}
                onClick={() => setActiveServerId(null)}
            >
                <img src={bgImage} alt="VOID" className="absolute inset-0 w-full h-full object-cover object-left-top scale-[3] opacity-90" />
                <div className="absolute inset-0 bg-[#020208]/30" />
                <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-400/20 to-blue-400/20 opacity-0 transition-opacity duration-300 ${activeServerId !== null ? 'group-hover/sos:opacity-100' : ''}`} />
                <span className="relative z-10 text-[12px] font-black text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">V</span>
            </div>

            {/* Separator */}
            <div className="w-0.5 h-6 bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent rounded-full opacity-50 shrink-0" />

            {/* Server List */}
            <div className="flex-1 flex items-center gap-2 overflow-x-auto overflow-y-hidden custom-scrollbar py-1">
                {servers.map(server => (
                    <div
                        key={server.id}
                        title={server.name}
                        className={`relative w-9 h-9 shrink-0 flex items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden group/srv
                        ${activeServerId === server.id
                            ? 'rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-[0_0_15px_rgba(129,140,248,0.5)] border border-indigo-400/50'
                            : 'rounded-xl bg-[#0a0b14] text-cyan-200/60 border border-white/5 hover:border-indigo-500/40 hover:text-white hover:shadow-[0_0_12px_rgba(129,140,248,0.3)] hover:rounded-lg'}
                        `}
                        onClick={() => setActiveServerId(server.id)}
                    >
                        {server.icon ? (
                            <img src={server.icon} alt={server.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/srv:scale-110" />
                        ) : (
                            <span className="relative z-10 font-bold text-[10px] text-center tracking-wider">
                                {server.name.substring(0, 3).toUpperCase()}
                            </span>
                        )}
                        <div className={`absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 opacity-0 transition-opacity duration-300 ${activeServerId !== server.id ? 'group-hover/srv:opacity-100' : ''}`} />
                    </div>
                ))}
            </div>

            {/* Create Server Button */}
            <div
                className="relative w-9 h-9 shrink-0 bg-[#0a0b14] border border-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-400/50 hover:text-cyan-300 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:bg-cyan-900/40 transition-all duration-300 cursor-pointer overflow-hidden group/add"
                onClick={() => setIsModalOpen(true)}
            >
                <div className="absolute inset-0 scale-0 rounded-full bg-cyan-400/20 transition-transform duration-300 group-hover/add:scale-[2]" />
                <span className="relative z-10 text-lg font-light leading-none">+</span>
            </div>

            <ServerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </nav>
    );
};
