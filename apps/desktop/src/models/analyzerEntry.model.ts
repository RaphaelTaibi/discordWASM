export default interface AnalyzerEntry {
    ctx: AudioContext;
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
}

