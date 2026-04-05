export interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    updateAvailable: boolean;
    updateStatus: any;
    triggerUpdate: () => Promise<void>;
    checkForUpdate: () => Promise<void>;
}