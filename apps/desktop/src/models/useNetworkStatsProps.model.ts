export default interface UseNetworkStatsProps {
  pc: RTCPeerConnection | null;
  isConnected: boolean;
  wasmReady: boolean;
}
