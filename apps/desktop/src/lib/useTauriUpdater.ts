import { useEffect, useRef, useCallback, useState } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';

export function useTauriUpdater(pollingIntervalMs: number = 20 * 60 * 1000) {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<string | null>(null);
    const [updateObj, setUpdateObj] = useState<Update | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkForUpdate = useCallback(async () => {
        setUpdateStatus(null);
        try {
            const update = await check();
            if (update) {
                setUpdateAvailable(true);
                setUpdateObj(update);
            } else {
                setUpdateAvailable(false);
                setUpdateObj(null);
            }
        } catch (e: any) {
            // Prevent showing an error if it's just the "Dev URL" blocking the updater locally
            if (e && typeof e.message === 'string' && e.message.includes('HTTP function')) {
                // Ignore it gracefully during development
                return;
            }
            
            console.error("Update check failed:", e);
            setUpdateStatus('Erreur lors de la vérification des mises à jour');
            setTimeout(() => setUpdateStatus(null), 5000);
        }
    }, []);

    useEffect(() => {
        checkForUpdate();
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(checkForUpdate, pollingIntervalMs);
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [checkForUpdate, pollingIntervalMs]);

    const triggerUpdate = async () => {
        if (!updateObj) return;
        setUpdateStatus('Installation de la mise à jour...');
        try {
            await updateObj.downloadAndInstall();
            setUpdateStatus(null);
            setUpdateAvailable(false);
        } catch (e) {
            setUpdateStatus('Erreur lors de l\'installation de la mise à jour');
            setTimeout(() => setUpdateStatus(null), 5000);
        }
    };

    return { updateAvailable, updateStatus, triggerUpdate, checkForUpdate };
}
