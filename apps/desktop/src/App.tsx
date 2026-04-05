import { AuthProvider, useAuth } from './context/AuthContext';
import { StreamProvider } from './context/StreamContext';
import { VoiceProvider } from './context/VoiceContext';
import { ChatProvider } from './context/ChatContext';
import { ToastProvider } from './context/ToastContext';
import { ServerProvider } from './context/ServerContext';
import { LoginView } from './components/auth/LoginView';
import { ToastContainer } from './components/ui/ToastContainer';
import Dashboard from './components/Dashboard';

/**
 * Root application component that wraps the main interface with necessary context providers.
 * Sets up authentication, toasts, voice, chat, and stream contexts before rendering
 * the application content.
 *
 * @returns {JSX.Element} The rendered application component hierarchy.
 */
export default function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <ServerProvider>
                    <VoiceProvider>
                        <ChatProvider>
                            <StreamProvider>
                                <AppContent />
                                <ToastContainer />
                            </StreamProvider>
                        </ChatProvider>
                    </VoiceProvider>
                </ServerProvider>
            </ToastProvider>
        </AuthProvider>
    );
}

/**
 * Renders the main content of the application based on the user's authentication state.
 * Displays the Dashboard for authenticated users, or the LoginView otherwise.
 *
 * @returns {JSX.Element} The conditional view component based on auth state.
 */
function AppContent() {
    const { isAuthenticated, login } = useAuth();
    return isAuthenticated ? <Dashboard /> : <LoginView onLogin={login} />;
}
