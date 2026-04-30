import { createPortal } from 'react-dom';
import { UserPlus, Search, Loader2 } from 'lucide-react';
import { AddFriendPopoverProps } from '../../models/social/friendsBarProps.model';
import { useAddFriendPopover } from '../../hooks/useAddFriendPopover';

const MIN_QUERY_LENGTH = 2;

/**
 * Compact "+" button with a portal-rendered search popover.
 * Searches by tag (pseudo#XXXX) or public key.
 */
const AddFriendPopover = ({ onSend }: AddFriendPopoverProps) => {
    const {
        isOpen, query, results, loading, sent, pos,
        btnRef, popoverRef, inputRef, isInvalidFormat,
        handleToggle, handleInputChange, handleSend,
    } = useAddFriendPopover(onSend);

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleToggle}
                className="w-7 h-7 rounded-lg bg-[#0a0b14] border border-cyan-500/20 flex items-center justify-center
                    text-cyan-400/50 hover:text-cyan-300 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(34,211,238,0.4)]
                    transition-all duration-300 cursor-pointer shrink-0"
            >
                <UserPlus size={14} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={popoverRef}
                    className="fixed z-50 w-[300px] glass-heavy rounded-xl border border-white/6 shadow-2xl
                        animate-in fade-in zoom-in-95 duration-150"
                    style={{ top: pos.top, left: pos.left }}
                >
                    {/* Header */}
                    <div className="px-3 pt-3 pb-2">
                        <p className="text-[11px] text-cyan-500/60 font-bold uppercase tracking-wider mb-2">
                            Ajouter un ami
                        </p>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/40" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => handleInputChange(e.target.value)}
                                placeholder="Tag (Pseudo#a1b2) ou clé publique…"
                                className="w-full bg-[#0a0b14]/60 border border-cyan-500/20 rounded-lg pl-9 pr-3 py-2
                                    text-cyan-100 text-sm placeholder-cyan-500/30 focus:outline-none
                                    focus:border-cyan-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar px-2 pb-2">
                        {loading && (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 size={18} className="text-cyan-400 animate-spin" />
                            </div>
                        )}

                        {!loading && isInvalidFormat && (
                            <p className="text-center text-cyan-500/40 text-[12px] py-4 px-2 leading-relaxed">
                                Format attendu : <span className="font-mono text-cyan-300/70">Pseudo#a1B2</span><br/>
                                ou clé publique complète.
                            </p>
                        )}

                        {!loading && !isInvalidFormat && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0 && (
                            <p className="text-center text-cyan-500/40 text-[12px] py-4">Aucun résultat</p>
                        )}

                        {!loading && results.map(user => {
                            const _suffix = user.publicKey && user.publicKey.length >= 4
                                ? user.publicKey.slice(-4).toUpperCase()
                                : null;
                            const _isSent = sent === user.id;

                            return (
                                <div key={user.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/4 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-[#0a0b14] border border-cyan-500/20
                                        flex items-center justify-center shrink-0 overflow-hidden"
                                    >
                                        {user.avatar ? (
                                            <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <span className="text-cyan-200/70 text-xs font-bold">
                                                {(user.displayName || user.username || '?').charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-baseline gap-1">
                                        <span className="text-[13px] text-cyan-100 font-bold truncate">
                                            {user.displayName || user.username}
                                        </span>
                                        {_suffix && (
                                            <span className="text-[11px] font-mono text-cyan-400/60 shrink-0">
                                                #{_suffix}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleSend(user.id)}
                                        disabled={_isSent}
                                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all
                                            ${_isSent
                                                ? 'bg-green-600/20 border border-green-500/30 text-green-400 cursor-default'
                                                : 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/40'}`}
                                    >
                                        {_isSent ? 'Envoyé ✓' : 'Ajouter'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};

export default AddFriendPopover;

