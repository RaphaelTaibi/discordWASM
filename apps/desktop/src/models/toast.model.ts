import { ToastType } from '../types/toastType.type';

export default interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

