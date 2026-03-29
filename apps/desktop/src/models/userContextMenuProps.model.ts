export default interface UserContextMenuProps {
    x: number;
    y: number;
    userId: string;
    username: string;
    volume: number;
    onVolumeChange: (volume: number) => void;
    onClose: () => void;
}
