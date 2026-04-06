import { ReactNode } from "react";

export default interface MainLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarFooter?: ReactNode;
  channelName?: string;
  isInVoice?: boolean;
}

