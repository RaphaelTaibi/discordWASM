export interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    updateAvailable: boolean;
    updateStatus: string | null;
    triggerUpdate: () => Promise<void>;
    checkForUpdate: () => Promise<void>;
}