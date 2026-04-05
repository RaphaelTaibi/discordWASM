import { useEffect, useRef } from 'react';
import UserContextMenuProps from '../../models/userContextMenuProps.model';

export const UserContextMenu = ({ x, y, username, volume, onVolumeChange, onClose }: UserContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            style={{ top: y, left: x }}
            className="fixed z-50 w-56 bg-[#050511]/95 backdrop-blur-md rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.15)] border border-cyan-500/30 p-2 text-cyan-100 font-sans animate-in fade-in zoom-in duration-200"
        >
            <div className="px-2 py-1.5 text-[12px] font-black uppercase tracking-widest text-cyan-500/70 border-b border-cyan-500/20 mb-2 truncate">
                {username}
            </div>

            <div className="px-2 py-1.5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[12px] font-bold text-cyan-300">
                    <span className="uppercase tracking-wide">Volume</span>
                    <span className="font-mono bg-cyan-950/50 px-1.5 rounded shadow-[0_0_10px_rgba(34,211,238,0.2)]">{Math.round(volume * 100)}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                />
            </div>
        </div>
    );
};
