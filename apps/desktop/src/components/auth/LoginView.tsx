// src/components/auth/LoginView.tsx
import { useState } from 'react';
import LoginViewProps from '../../models/loginViewProps.model';

export const LoginView = ({ onLogin }: LoginViewProps) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim().length >= 2) {
            onLogin(name.trim());
        }
    };

    return (
        <div className="h-screen w-full bg-[#313338] flex items-center justify-center p-4">
            <div className="w-full max-w-[480px] bg-[#2b2d31] rounded-lg shadow-xl p-8 flex flex-col items-center">
                <h1 className="text-2xl font-bold text-white mb-2 text-center">
                    Discord de Secours
                </h1>
                <p className="text-[#b5bac1] text-center mb-6">
                    Identifie-toi pour rejoindre le salon vocal.
                </p>

                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <div>
                        <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2">
                            Nom d'utilisateur
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-[#1e1f22] p-2.5 rounded border-none text-[#dbdee1] focus:outline-none focus:ring-2 focus:ring-[#5865f2] transition-all"
                            placeholder="Ex: Raph"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={name.trim().length < 2}
                        className="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:bg-[#4752c4]/50 text-white font-medium py-2.5 rounded transition-colors cursor-pointer"
                    >
                        Rejoindre
                    </button>
                </form>

                <span className="mt-6 text-[12px] text-gray-500 italic">
          Statut : Persistence Locale Active (Zéro DB)
        </span>
            </div>
        </div>
    );
};