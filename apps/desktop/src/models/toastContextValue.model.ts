import Toast from './toast.model';
import { ToastType } from '../types/toastType.type';

export default interface ToastContextValue {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType) => void;
}

