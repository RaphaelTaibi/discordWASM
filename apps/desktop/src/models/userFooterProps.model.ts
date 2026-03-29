import UserBarProps from './userBarProps.model';

export default interface UserFooterProps extends UserBarProps {
    onLeave?: () => void;
    onLogout?: () => void;
    onStream?: () => void;
    isStreaming?: boolean;
    networkQuality?: 0 | 1 | 2 | 3;
    ping?: number;
    updateCheck?: () => void;
}
