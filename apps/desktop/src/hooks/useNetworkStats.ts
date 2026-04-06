import { useEffect, useState } from 'react';
import { process_network_stats } from '../pkg/core_wasm';
import UseNetworkStatsProps from '../models/useNetworkStatsProps.model';

export const useNetworkStats = ({ pc, isConnected, wasmReady }: UseNetworkStatsProps) => {
    const [networkQuality, setNetworkQuality] = useState<0 | 1 | 2 | 3>(3);
    const [ping, setPing] = useState<number>(0);
    const [averagePing, setAveragePing] = useState<number>(0);
    const [packetLoss, setPacketLoss] = useState<number>(0);

    useEffect(() => {
        if (!isConnected || !wasmReady) return;

        let pingSum = 0;
        let pingCount = 0;

        const interval = setInterval(async () => {
            try {
                if (pc && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed')) {
                    const stats = await pc.getStats();
                    let totalRTT = 0, count = 0, totalLoss = 0, totalJitter = 0;
                    let candidatePairRTT = 0;
                    let fallbackRTT = 0;

                    stats.forEach(r => {
                        if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.nominated) && r.currentRoundTripTime !== undefined) {
                            candidatePairRTT = r.currentRoundTripTime * 1000;
                        }
                        if (r.type === 'remote-inbound-rtp' && r.roundTripTime !== undefined) {
                            totalRTT += r.roundTripTime * 1000;
                            count++;
                        }
                        if (r.type === 'outbound-rtp' && r.packetsSent) {
                            const remoteStats = Array.from(stats.values()).find(s => s.type === 'remote-inbound-rtp' && s.ssrc === r.ssrc);
                            if (remoteStats && remoteStats.fractionLost !== undefined) {
                                totalLoss += remoteStats.fractionLost;
                                count++;
                            }
                        }
                        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
                            const total = (r.packetsLost || 0) + (r.packetsReceived || 0);
                            if (total > 0) {
                                totalLoss += (r.packetsLost || 0) / total;
                            }
                            if (r.jitter !== undefined) totalJitter += r.jitter * 1000;
                        }

                        // Capture roundTripTime or currentRoundTripTime from other stats as fallback
                        if (r.type !== 'candidate-pair' && r.type !== 'remote-inbound-rtp') {
                            if (r.roundTripTime !== undefined) fallbackRTT = r.roundTripTime * 1000;
                            else if (r.currentRoundTripTime !== undefined) fallbackRTT = r.currentRoundTripTime * 1000;
                        }
                    });

                    if (typeof process_network_stats === 'function') {
                        // Use WASM for calculation
                        const results = process_network_stats(totalRTT, count, candidatePairRTT, fallbackRTT, totalLoss, totalJitter);
                        // results: [final_ping, packet_loss_pct, final_jitter, quality, final_rtt]
                        const currentPing = Math.max(1, results[0]);
                        
                        setPing(currentPing);
                        
                        pingSum += currentPing;
                        pingCount += 1;
                        setAveragePing(Math.round(pingSum / pingCount));
                        
                        setPacketLoss(results[1]);
                        setNetworkQuality(results[3] as 0 | 1 | 2 | 3);
                    } else {
                        // Fallback purely JS in case wasm is missing
                        // which normally should not happen as we check typeof.
                        let finalRTT = 0;
                        if (count > 0) {
                            finalRTT = totalRTT / count;
                        } else if (candidatePairRTT > 0) {
                            finalRTT = candidatePairRTT;
                        } else {
                            finalRTT = fallbackRTT;
                        }

                        if (finalRTT > 0) {
                            const currentPing = Math.max(1, Math.round(finalRTT));
                            setPing(currentPing);
                            
                            pingSum += currentPing;
                            pingCount += 1;
                            setAveragePing(Math.round(pingSum / pingCount));
                            
                            setPacketLoss(count > 0 ? (totalLoss / count) * 100 : 0);
                            // quality is omitted in fallback JS for simplicity
                        }
                    }
                }
            } catch (e) {
                // Ignore stats errors
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isConnected, wasmReady, pc]);

    return { networkQuality, ping, averagePing, packetLoss };
};
