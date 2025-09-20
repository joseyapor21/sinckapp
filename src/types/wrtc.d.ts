declare module '@roamhq/wrtc' {
  export class RTCPeerConnection {
    constructor(configuration?: RTCConfiguration);
    localDescription: RTCSessionDescription | null;
    remoteDescription: RTCSessionDescription | null;
    connectionState: RTCPeerConnectionState;
    iceConnectionState: RTCIceConnectionState;
    iceGatheringState: RTCIceGatheringState;
    
    onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
    onconnectionstatechange: (() => void) | null;
    ondatachannel: ((event: RTCDataChannelEvent) => void) | null;
    
    createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
    createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
    createDataChannel(label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
    close(): void;
  }

  export class RTCDataChannel {
    readyState: RTCDataChannelState;
    label: string;
    
    onopen: (() => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: (() => void) | null;
    
    send(data: string | Blob | ArrayBuffer | ArrayBufferView): void;
    close(): void;
  }

  export interface RTCPeerConnectionIceEvent {
    candidate: RTCIceCandidate | null;
  }

  export interface RTCDataChannelEvent {
    channel: RTCDataChannel;
  }
}