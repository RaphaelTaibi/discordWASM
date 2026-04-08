import { VoiceTile } from './VoiceTile';
import VoiceGridProps from '../../models/voiceGridProps.model';

/**
 * Distributes participant tiles proportionally.
 * In spotlight mode, the focused stream is large and others become thumbnails.
 */
export const VoiceGrid = ({ tiles, spotlightUserId, onSpotlight, localUserId }: VoiceGridProps) => {
    if (tiles.length === 0) return <EmptyState />;

    if (spotlightUserId) {
        return (
            <SpotlightLayout
                tiles={tiles}
                spotlightUserId={spotlightUserId}
                onSpotlight={onSpotlight}
                localUserId={localUserId}
            />
        );
    }

    return (
        <GridLayout tiles={tiles} onSpotlight={onSpotlight} />
    );
};

/** Equal-sized grid distributing tiles proportionally. */
const GridLayout = ({
    tiles,
    onSpotlight,
}: {
    tiles: VoiceGridProps['tiles'];
    onSpotlight: VoiceGridProps['onSpotlight'];
}) => {
    const _cols = gridCols(tiles.length);

    return (
        <div className={`w-full h-full p-3 grid gap-2 auto-rows-fr ${_cols}`}>
            {tiles.map(tile => (
                <VoiceTile
                    key={tile.userId}
                    {...tile}
                    onClick={tile.screenStream ? () => onSpotlight(tile.userId) : undefined}
                />
            ))}
        </div>
    );
};

/** Spotlight mode: one large tile + bottom thumbnail strip. */
const SpotlightLayout = ({
    tiles,
    spotlightUserId,
    onSpotlight,
    localUserId,
}: VoiceGridProps) => {
    const _main = tiles.find(t => t.userId === spotlightUserId);
    const _others = tiles.filter(t => t.userId !== spotlightUserId);

    if (!_main) return null;

    return (
        <div className="w-full h-full flex flex-col p-3 gap-2">
            {/* Spotlight */}
            <div className="flex-1 min-h-0">
                <VoiceTile
                    {..._main}
                    isSpotlighted
                    onClick={() => onSpotlight(null)}
                />
            </div>

            {/* Thumbnail strip */}
            {_others.length > 0 && (
                <div className="flex gap-2 h-24 shrink-0 overflow-x-auto">
                    {_others.map(tile => (
                        <div
                            key={tile.userId}
                            className="h-full aspect-video shrink-0"
                        >
                            <VoiceTile
                                {...tile}
                                isWatchingSpotlight={tile.userId !== localUserId || tile.isWatchingSpotlight}
                                onClick={tile.screenStream ? () => onSpotlight(tile.userId) : undefined}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Cyberpunk loading state — shown briefly during mic/WebRTC init. */
const EmptyState = () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-5">
        {/* Hexagonal pulse ring */}
        <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-cyan-400/30 animate-[ping_1.5s_ease-in-out_infinite_0.3s]" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-lg rotate-45 border-2 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.4)] animate-[spin_3s_linear_infinite]">
                    <div className="w-full h-full rounded-sm bg-cyan-400/10 backdrop-blur-sm" />
                </div>
            </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
            <p className="text-cyan-100/50 text-[13px] font-black uppercase tracking-[0.25em]">
                Initialisation
            </p>
            <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-[pulse_1s_ease-in-out_infinite]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
            </div>
        </div>
    </div>
);

/** Returns the Tailwind grid-cols class based on participant count. */
function gridCols(count: number): string {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
}

