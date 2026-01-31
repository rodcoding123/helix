// WebRTC Voice Connection for Helix Code Interface

export type VoiceState = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error';

export interface VoiceConfig {
  signalingUrl: string;
  instanceKey: string;
  authToken: string;
  onStateChange: (state: VoiceState) => void;
  onAudioLevel: (level: number) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError: (error: Error) => void;
}

export class WebRTCVoice {
  private config: VoiceConfig;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalingWs: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  private state: VoiceState = 'idle';

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.setState('connecting');

    try {
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Set up audio analysis
      this.setupAudioAnalysis();

      // Connect to signaling server
      await this.connectSignaling();

      // Create peer connection
      this.createPeerConnection();

      this.setState('connected');
    } catch (error) {
      this.setState('error');
      this.config.onError(error instanceof Error ? error : new Error('Failed to connect'));
      throw error;
    }
  }

  private setupAudioAnalysis(): void {
    if (!this.localStream) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    const source = this.audioContext.createMediaStreamSource(this.localStream);
    source.connect(this.analyser);

    this.startLevelMonitoring();
  }

  private startLevelMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkLevel = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalizedLevel = average / 255;

      this.config.onAudioLevel(normalizedLevel);

      // Update state based on audio level
      if (this.state === 'connected' || this.state === 'speaking' || this.state === 'listening') {
        if (normalizedLevel > 0.1) {
          this.setState('speaking');
        } else if (this.state === 'speaking') {
          this.setState('listening');
        }
      }

      this.animationFrame = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }

  private async connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.signalingWs = new WebSocket(this.config.signalingUrl);

      this.signalingWs.onopen = () => {
        // Authenticate
        this.signalingWs?.send(JSON.stringify({
          type: 'auth',
          instanceKey: this.config.instanceKey,
          token: this.config.authToken,
        }));
        resolve();
      };

      this.signalingWs.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        await this.handleSignalingMessage(message);
      };

      this.signalingWs.onerror = () => {
        reject(new Error('Signaling connection failed'));
      };

      this.signalingWs.onclose = () => {
        if (this.state !== 'idle') {
          this.setState('error');
          this.config.onError(new Error('Signaling connection closed'));
        }
      };
    });
  }

  private createPeerConnection(): void {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    this.peerConnection = new RTCPeerConnection(config);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      // Play remote audio
      const audio = new Audio();
      audio.srcObject = this.remoteStream;
      audio.play().catch(console.error);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingWs?.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
        }));
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      switch (this.peerConnection?.connectionState) {
        case 'connected':
          this.setState('connected');
          break;
        case 'disconnected':
        case 'failed':
          this.setState('error');
          this.config.onError(new Error('Peer connection failed'));
          break;
      }
    };
  }

  private async handleSignalingMessage(message: Record<string, unknown>): Promise<void> {
    switch (message.type) {
      case 'offer':
        await this.handleOffer(message.sdp as RTCSessionDescriptionInit);
        break;
      case 'answer':
        await this.handleAnswer(message.sdp as RTCSessionDescriptionInit);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(message.candidate as RTCIceCandidateInit);
        break;
      case 'transcript':
        this.config.onTranscript?.(
          message.text as string,
          message.isFinal as boolean
        );
        break;
    }
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.signalingWs?.send(JSON.stringify({
      type: 'answer',
      sdp: answer,
    }));
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async startCall(): Promise<void> {
    if (!this.peerConnection) return;

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.signalingWs?.send(JSON.stringify({
      type: 'offer',
      sdp: offer,
    }));
  }

  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  disconnect(): void {
    this.setState('idle');

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }
  }

  private setState(state: VoiceState): void {
    this.state = state;
    this.config.onStateChange(state);
  }

  get currentState(): VoiceState {
    return this.state;
  }
}
