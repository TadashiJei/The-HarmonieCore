const optimizedWebRTCConfig = {
  // Ultra-optimized ICE servers for speed
  iceServers: [
    // Primary: Google STUN (fastest)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Optimized TURN with UDP (faster than TCP)
    {
      urls: 'turn:openrelay.metered.ca:80?transport=udp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=udp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],

  // Ultra-fast WebRTC configuration
  peerConnectionConfig: {
    iceServers: [],
    iceCandidatePoolSize: 5, // Reduced for faster connection
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all',
    // Enable aggressive ICE gathering
    iceCandidateTimeout: 1000, // Faster candidate discovery
    iceConnectionTimeout: 3000 // Faster connection establishment
  },

  // Data-optimized media constraints
  mobileUltraLowData: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000, // Reduced from 44100 for 64% less audio data
      channelCount: 1,   // Mono instead of stereo (50% reduction)
      bitrate: 16000,    // 16kbps audio (90% reduction)
      opusStereo: false,
      opusFec: true,     // Forward error correction
      opusDtx: true      // Discontinuous transmission for silence
    },
    video: {
      width: { ideal: 320, max: 640 },   // Ultra-low resolution
      height: { ideal: 240, max: 480 },
      frameRate: { ideal: 15, max: 24 }, // Lower frame rate
      facingMode: 'user',
      // Advanced video optimizations
      advanced: [
        { googCpuOveruseDetection: true },
        { googCpuOveruseEncodeUsage: true },
        { googCpuOveruseThreshold: 85 },
        { googPayloadPadding: false },
        { googScreencastMinBitrate: 50 }
      ]
    }
  },

  // Progressive quality tiers based on connection
  qualityTiers: {
    ultraLow: {
      name: 'Ultra Low Data',
      video: { width: 320, height: 240, fps: 15, bitrate: 150000 },
      audio: { bitrate: 16000 },
      dataUsage: '~0.2 MB/min'
    },
    low: {
      name: 'Low Data',
      video: { width: 480, height: 360, fps: 20, bitrate: 300000 },
      audio: { bitrate: 32000 },
      dataUsage: '~0.5 MB/min'
    },
    medium: {
      name: 'Balanced',
      video: { width: 640, height: 480, fps: 24, bitrate: 600000 },
      audio: { bitrate: 64000 },
      dataUsage: '~1 MB/min'
    },
    high: {
      name: 'High Quality',
      video: { width: 1280, height: 720, fps: 30, bitrate: 1200000 },
      audio: { bitrate: 128000 },
      dataUsage: '~2 MB/min'
    }
  },

  // Adaptive bitrate algorithm
  adaptiveBitrate: {
    initialBitrate: 300000, // Start low
    minBitrate: 100000,     // Never go below this
    maxBitrate: 2000000,    // Cap for mobile
    stepUp: 1.2,            // Increase by 20%
    stepDown: 0.7,          // Decrease by 30%
    measurementInterval: 1000, // Check every second
    bufferThreshold: 0.5    // React faster to buffer changes
  },

  // Connection optimization
  connectionOptimization: {
    // Faster ICE gathering
    iceCandidatePolicy: 'relay', // Prefer relay for consistent performance
    iceTransportPolicy: 'relay', // Force relay for mobile optimization
    
    // Reduced handshake time
    dtlsHandshakeTimeout: 3000,
    sctpPort: 5000, // Optimized port
    
    // Buffer management
    bufferSize: 65536, // 64KB buffer (reduced from default)
    maxRetransmits: 1,  // Minimal retransmits for speed
    
    // Compression settings
    enableCompression: true,
    compressionLevel: 6 // Balanced compression
  },

  // Network adaptation
  networkAdaptation: {
    // Detect connection type and optimize
    connectionProfiles: {
      'slow-2g': { videoBitrate: 50000, audioBitrate: 8000, fps: 10 },
      '2g': { videoBitrate: 100000, audioBitrate: 12000, fps: 12 },
      '3g': { videoBitrate: 250000, audioBitrate: 24000, fps: 15 },
      '4g': { videoBitrate: 800000, audioBitrate: 48000, fps: 24 },
      'wifi': { videoBitrate: 1200000, audioBitrate: 64000, fps: 30 },
      'ethernet': { videoBitrate: 2000000, audioBitrate: 128000, fps: 30 }
    },
    
    // RTT-based adaptation
    rttThresholds: {
      excellent: 50,   // < 50ms
      good: 100,       // 50-100ms
      fair: 200,       // 100-200ms
      poor: 500        // > 200ms
    }
  },

  // Data channel optimization for chat/tips
  dataChannel: {
    ordered: false,    // Unordered for speed
    maxRetransmits: 0, // No retransmits for real-time
    maxPacketLifeTime: 1000, // 1 second max lifetime
    priority: 'high'
  },

  // Screen sharing optimization
  screenSharing: {
    constraints: {
      video: {
        width: { max: 1920 },
        height: { max: 1080 },
        frameRate: { max: 5 }, // Lower for screen sharing
        cursor: 'always'
      }
    },
    bitrate: 500000 // Lower bitrate for screen sharing
  }
};

// Smart quality selector based on network conditions
const getOptimizedQuality = (connectionType, rtt, bandwidth) => {
  const profile = optimizedWebRTCConfig.networkAdaptation.connectionProfiles[connectionType] || 
                  optimizedWebRTCConfig.networkAdaptation.connectionProfiles['wifi'];
  
  // Adjust based on RTT
  let multiplier = 1.0;
  if (rtt > 500) multiplier = 0.3;
  else if (rtt > 200) multiplier = 0.5;
  else if (rtt > 100) multiplier = 0.7;
  else if (rtt > 50) multiplier = 0.9;
  
  // Adjust based on bandwidth
  if (bandwidth < 100000) multiplier *= 0.3;
  else if (bandwidth < 500000) multiplier *= 0.5;
  else if (bandwidth < 1000000) multiplier *= 0.7;
  
  return {
    videoBitrate: Math.max(profile.videoBitrate * multiplier, 50000),
    audioBitrate: Math.max(profile.audioBitrate * multiplier, 8000),
    fps: Math.max(Math.round(profile.fps * multiplier), 10)
  };
};

// Ultra-fast connection establishment
const getFastConnectionConfig = (isMobile = false) => {
  return {
    ...optimizedWebRTCConfig.peerConnectionConfig,
    iceServers: optimizedWebRTCConfig.iceServers,
    ...optimizedWebRTCConfig.connectionOptimization,
    mediaConstraints: isMobile ? 
      optimizedWebRTCConfig.mobileUltraLowData : 
      optimizedWebRTCConfig.qualityTiers.medium
  };
};

// Data usage calculator
const calculateDataUsage = (durationMinutes, qualityTier) => {
  const tier = optimizedWebRTCConfig.qualityTiers[qualityTier];
  if (!tier) return 'Unknown';
  
  const totalBits = (tier.video.bitrate + tier.audio.bitrate) * durationMinutes * 60;
  return `${(totalBits / 8 / 1024 / 1024).toFixed(2)} MB`;
};

module.exports = {
  optimizedWebRTCConfig,
  getOptimizedQuality,
  getFastConnectionConfig,
  calculateDataUsage
};
