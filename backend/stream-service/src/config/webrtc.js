const webrtcConfig = {
  iceServers: [
    // Google's public STUN servers (always free)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    
    // FREE TURN servers - choose your preferred option
    
    // Option 1: Open Relay Project (FREE)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    
    // Option 2: Additional free STUN servers
    { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:stun.antisip.com:3478' },
    { urls: 'stun:stun.voipbuster.com:3478' },
    
    // Environment-based TURN (for production)
    {
      urls: process.env.TURN_SERVER_URL || 'turn:openrelay.metered.ca:80',
      username: process.env.TURN_USERNAME || 'openrelayproject',
      credential: process.env.TURN_PASSWORD || 'openrelayproject'
    }
  ],
  
  // WebRTC configuration
  peerConnectionConfig: {
    iceServers: [],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  },
  
  // Media constraints
  mediaConstraints: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 2
    },
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: 'user'
    }
  },
  
  // Mobile-optimized constraints
  mobileConstraints: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100,
      channelCount: 1
    },
    video: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 15, max: 30 }
    }
  },
  
  // Data channel configuration
  dataChannelConfig: {
    ordered: true,
    maxRetransmits: 3
  },
  
  // Connection timeouts
  timeouts: {
    iceGathering: 10000,
    connection: 30000,
    disconnection: 5000
  }
};

// Dynamic configuration based on client capabilities
const getOptimalConstraints = (userAgent) => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  return {
    iceServers: webrtcConfig.iceServers,
    mediaConstraints: isMobile ? webrtcConfig.mobileConstraints : webrtcConfig.mediaConstraints,
    isMobile
  };
};

// Bandwidth adaptation
const getBandwidthConstraints = (connectionType) => {
  const bandwidths = {
    'slow-2g': { audio: 8000, video: 50000 },
    '2g': { audio: 16000, video: 150000 },
    '3g': { audio: 32000, video: 300000 },
    '4g': { audio: 64000, video: 1000000 },
    'wifi': { audio: 128000, video: 2500000 },
    'ethernet': { audio: 256000, video: 5000000 }
  };
  
  return bandwidths[connectionType] || bandwidths['wifi'];
};

module.exports = {
  webrtcConfig,
  getOptimalConstraints,
  getBandwidthConstraints
};
