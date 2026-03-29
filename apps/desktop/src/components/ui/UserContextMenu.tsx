import { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import UserContextMenuProps from '../../models/userContextMenuProps.model';

export const UserContextMenu = ({ x, y, username, volume, onVolumeChange, onClose }: UserContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-64 bg-[#111214] rounded-md shadow-xl border border-black/20 p-2 py-3 animate-in fade-in zoom-in duration-100"
            style={{ top: y, left: x }}
        >
            <div className="px-2 mb-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Volume de l'utilisateur
                </div>
                <div className="text-sm text-white font-medium mb-3 truncate">
                    {username}
                </div>
            </div>

            <div className="px-2 py-1 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                    <Volume2 size={14} />
                    <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => onVolumeChange(Number(e.target.value))}
                    className="w-full h-1.5 accent-[#5865f2] bg-[#2b2d31] rounded-full appearance-none cursor-pointer"
                />
            </div>
            
            <div className="mt-3 pt-2 border-t border-white/5">
                <div className="px-2 py-1.5 rounded hover:bg-[#4752c4] hover:text-white text-[#dbdee1] text-sm cursor-pointer transition-colors" onClick={onClose}>
                    Fermer
                </div>
            </div>
        </div>
    );
};
