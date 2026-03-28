import { useToast } from '../../context/ToastContext';
import { UserPlus, UserMinus, Info } from 'lucide-react';

const iconMap = {
    join: <UserPlus size={14} className="text-green-400" />,
    leave: <UserMinus size={14} className="text-red-400" />,
    info: <Info size={14} className="text-blue-400" />,
};

const borderMap = {
    join: 'border-l-green-500',
    leave: 'border-l-red-500',
    info: 'border-l-blue-500',
};

export const ToastContainer = () => {
    const { toasts } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg bg-[#2b2d31] border border-black/30 border-l-4 ${borderMap[toast.type]} shadow-xl backdrop-blur-sm animate-[slideIn_0.3s_ease-out,fadeOut_0.3s_ease-in_3.2s_forwards]`}
                >
                    {iconMap[toast.type]}
                    <span className="text-sm text-gray-200">{toast.message}</span>
                </div>
            ))}
        </div>
    );
};

