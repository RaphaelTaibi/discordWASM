import {AuthProvider} from './context/AuthContext';
import {StreamProvider} from './context/StreamContext';
import {VoiceProvider} from './context/VoiceContext';
import {ChatProvider} from './context/ChatContext';
import {ToastProvider} from './context/ToastContext';
import {ServerProvider} from './context/ServerContext';
import {ToastContainer} from './components/ui/ToastContainer';
import {TitleBar} from './components/layout/TitleBar';
import AuthenticatedView from './components/AuthenticatedView';
import bgImage from './assets/background.png';
import {BentoLayoutProvider} from "./context/BentoLayoutContext";

/**
 * Root application component. Only handles providers and global layout shell.
 */
export default function App() {
    return (
        <div
            className="flex flex-col h-screen overflow-hidden relative"
            style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <div className="absolute inset-0 bg-[#020208]/35 pointer-events-none z-0" />
            <TitleBar />
            <AuthProvider>
                <ToastProvider>
                    <ServerProvider>
                        <VoiceProvider>
                            <ChatProvider>
                                <StreamProvider>
                                    <BentoLayoutProvider>
                                        <div className="flex-1 flex relative overflow-hidden w-full h-full">
                                            <AuthenticatedView />
                                            <ToastContainer />
                                        </div>
                                    </BentoLayoutProvider>
                                </StreamProvider>
                            </ChatProvider>
                        </VoiceProvider>
                    </ServerProvider>
                </ToastProvider>
            </AuthProvider>
        </div>
    );
}
