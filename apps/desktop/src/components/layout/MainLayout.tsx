/**
 * MainLayout handles the central panel and the floating sidebar (Discord-like layout).
 * Sidebar position/size is driven by Tauri/Rust via useBentoLayout.
 */
import MainLayoutProps from "../../models/mainLayoutProps.model";
import ChannelPanel from "./ChannelPanel";
import SidebarPanel from "./SidebarPanel";
import { useBentoLayout } from "../../hooks/useBentoLayout";

const MainLayout = ({
    sidebar,
    children,
    sidebarFooter,
    channelName,
    isInVoice = false,
}: MainLayoutProps) => {
    const { x, y, w, h, onMove, onResize } = useBentoLayout("sidebar");

    return (
        <div className="relative h-full w-full text-gray-200 select-none overflow-hidden font-sans">
            <ChannelPanel channelName={channelName} isInVoice={isInVoice}>
                {children}
            </ChannelPanel>
            <SidebarPanel
                x={x}
                y={y}
                w={w}
                h={h}
                onMove={(dx, dy) => onMove({ dx, dy })}
                onResize={(dw, dh) => onResize({ dw, dh })}
                sidebar={sidebar}
                sidebarFooter={sidebarFooter}
            />
        </div>
    );
};

export default MainLayout;

