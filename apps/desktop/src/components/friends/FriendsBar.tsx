import { ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { useBentoLayout } from '../../hooks/useBentoLayout';
import { useBentoDrag } from '../../hooks/useBentoDrag';
import { useBentoResize } from '../../hooks/useBentoResize';
import ResizeHandle from '../layout/ResizeHandle';
import FriendAvatar from './FriendAvatar';
import AddFriendPopover from './AddFriendPopover';
import PendingRequestsBadge from './PendingRequestsBadge';
import { FriendsBarProps } from '../../models/social/friendsBarProps.model';

/**
 * Floating friends bar panel driven by the Bento layout engine.
 * Orientation is derived from dimensions: w >= h → horizontal, otherwise vertical.
 */
const FriendsBar = ({
    friends, pending,
    onSendRequest, onAccept, onReject,
}: FriendsBarProps) => {
    const { x, y, w, h, onMove, onResize, onSwap } = useBentoLayout('friends-bar');
    const handleDragStart = useBentoDrag(onMove);
    const handleResizeStart = useBentoResize(onResize, 'corner');

    const isHorizontal = w >= h;

    return (
        <div
            className="absolute z-25"
            style={{ left: x, top: y, width: w, height: h, overflow: 'visible' }}
        >
            <div className={`relative w-full h-full glass-heavy rounded-2xl border border-white/6
                shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex
                ${isHorizontal ? 'flex-row items-center' : 'flex-col items-center'}`}
            >
                {/* Drag handle */}
                <div
                    onMouseDown={handleDragStart}
                    className={`shrink-0 cursor-grab active:cursor-grabbing flex items-center justify-center
                        hover:bg-white/5 transition-colors
                        ${isHorizontal ? 'h-full w-5 rounded-l-2xl' : 'w-full h-5 rounded-t-2xl'}`}
                >
                    <div className={`rounded-full bg-cyan-400/20
                        ${isHorizontal ? 'w-1 h-6' : 'h-1 w-6'}`}
                    />
                </div>

                {/* Toolbar */}
                <div className={`shrink-0 flex items-center gap-1.5 px-1.5
                    ${isHorizontal ? 'flex-row' : 'flex-col py-1.5 px-0'}`}
                >
                    <button
                        onClick={onSwap}
                        title={isHorizontal ? 'Switch to vertical' : 'Switch to horizontal'}
                        className="w-7 h-7 rounded-lg bg-[#0a0b14] border border-cyan-500/20
                            flex items-center justify-center text-cyan-400/50 hover:text-cyan-300
                            hover:border-cyan-400 transition-all duration-300 cursor-pointer shrink-0"
                    >
                        {isHorizontal ? <ArrowUpDown size={13} /> : <ArrowLeftRight size={13} />}
                    </button>
                    <AddFriendPopover onSend={onSendRequest} />
                    <PendingRequestsBadge pending={pending} onAccept={onAccept} onReject={onReject} />
                </div>

                {/* Separator */}
                <div className={`shrink-0 rounded-full opacity-40
                    ${isHorizontal
                        ? 'w-px h-6 bg-linear-to-b from-transparent via-cyan-500/30 to-transparent mx-1'
                        : 'h-px w-6 bg-linear-to-r from-transparent via-cyan-500/30 to-transparent my-1'}`}
                />

                {/* Friends list */}
                <div className={`flex-1 min-w-0 min-h-0 flex gap-2 p-1.5 custom-scrollbar
                    ${isHorizontal
                        ? 'flex-row items-center overflow-x-auto overflow-y-hidden'
                        : 'flex-col items-center overflow-y-auto overflow-x-hidden'}`}
                >
                    {friends.length === 0 ? (
                        <span className="text-[11px] text-cyan-500/30 font-medium whitespace-nowrap px-2">
                            No friends yet
                        </span>
                    ) : (
                        friends.map(f => (
                            <FriendAvatar
                                key={f.id}
                                avatar={f.avatar}
                                displayName={f.displayName}
                                username={f.username}
                                publicKey={f.publicKey}
                            />
                        ))
                    )}
                </div>

                <ResizeHandle onMouseDown={handleResizeStart} />
            </div>
        </div>
    );
};

export default FriendsBar;




