import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import Toast from '../models/toast.model';
import ToastContextValue from '../models/toastContextValue.model';
import { ToastType } from '../types/toastType.type';

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counterRef = useRef(0);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = `toast-${Date.now()}-${counterRef.current++}`;
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3500);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};


