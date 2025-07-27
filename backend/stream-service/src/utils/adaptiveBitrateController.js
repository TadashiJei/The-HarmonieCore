const logger = require('./logger');

class AdaptiveBitrateController {
  constructor() {
    this.streams = new Map();
    this.connectionMonitors = new Map();
    this.optimizationIntervals = new Map();
  }

  // Initialize adaptive bitrate for a stream
  initializeStream(streamId, clientInfo = {}) {
    const config = {
      streamId,
      clientInfo,
      currentQuality: 'ultraLow',
      currentBitrate: 150000,
      targetBitrate: 150000,
      measuredBitrate: 0,
      packetLoss: 0,
      rtt: 0,
      bufferLevel: 1.0,
      adaptationEnabled: true,
      lastAdjustment: Date.now(),
      adjustmentInterval: 2000, // 2 seconds
      
      // Quality thresholds
      thresholds: {
        packetLoss: { poor: 0.05, fair: 0.02, good: 0.01 },
        rtt: { poor: 500, fair: 200, good: 100, excellent: 50 },
        buffer: { critical: 0.2, low: 0.5, good: 0.8 }
      }
    };

    this.streams.set(streamId, config);
    this.startMonitoring(streamId);
    
    logger.info(`Adaptive bitrate initialized for stream ${streamId}`, {
      initialBitrate: config.currentBitrate,
      clientInfo
    });

    return config;
  }

  // Real-time network monitoring
  startMonitoring(streamId) {
    if (this.connectionMonitors.has(streamId)) {
      clearInterval(this.connectionMonitors.get(streamId));
    }

    const monitor = setInterval(() => {
      this.analyzeNetworkConditions(streamId);
    }, 1000); // Monitor every second

    this.connectionMonitors.set(streamId, monitor);
  }

  // Analyze network conditions and adjust quality
  analyzeNetworkConditions(streamId) {
    const config = this.streams.get(streamId);
    if (!config || !config.adaptationEnabled) return;

    const now = Date.now();
    if (now - config.lastAdjustment < config.adjustmentInterval) return;

    const networkScore = this.calculateNetworkScore(config);
    const newQuality = this.determineOptimalQuality(networkScore, config);

    if (newQuality !== config.currentQuality) {
      this.adjustQuality(streamId, newQuality);
    }
  }

  // Calculate comprehensive network score
  calculateNetworkScore(config) {
    let score = 100;

    // Packet loss penalty
    if (config.packetLoss > config.thresholds.packetLoss.poor) {
      score -= 40;
    } else if (config.packetLoss > config.thresholds.packetLoss.fair) {
      score -= 20;
    } else if (config.packetLoss > config.thresholds.packetLoss.good) {
      score -= 10;
    }

    // RTT penalty
    if (config.rtt > config.thresholds.rtt.poor) {
      score -= 35;
    } else if (config.rtt > config.thresholds.rtt.fair) {
      score -= 25;
    } else if (config.rtt > config.thresholds.rtt.good) {
      score -= 15;
    } else if (config.rtt > config.thresholds.rtt.excellent) {
      score -= 5;
    }

    // Buffer level bonus
    if (config.bufferLevel < config.thresholds.buffer.critical) {
      score -= 30;
    } else if (config.bufferLevel < config.thresholds.buffer.low) {
      score -= 15;
    } else if (config.bufferLevel > config.thresholds.buffer.good) {
      score += 10;
    }

    // Bandwidth utilization
    const utilization = config.measuredBitrate / config.targetBitrate;
    if (utilization < 0.5) {
      score -= 20;
    } else if (utilization > 1.2) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Determine optimal quality based on network score
  determineOptimalQuality(score, config) {
    if (score >= 90) return 'high';
    if (score >= 75) return 'medium';
    if (score >= 50) return 'low';
    return 'ultraLow';
  }

  // Smooth quality adjustment
  adjustQuality(streamId, newQuality) {
    const config = this.streams.get(streamId);
    if (!config) return;

    const qualityMap = {
      ultraLow: { bitrate: 150000, video: { width: 320, height: 240, fps: 15 } },
      low: { bitrate: 300000, video: { width: 480, height: 360, fps: 20 } },
      medium: { bitrate: 600000, video: { width: 640, height: 480, fps: 24 } },
      high: { bitrate: 1200000, video: { width: 1280, height: 720, fps: 30 } }
    };

    const newConfig = qualityMap[newQuality];
    
    // Smooth transition - don't drop more than 50% at once
    const maxDrop = config.currentBitrate * 0.5;
    const targetBitrate = Math.max(newConfig.bitrate, config.currentBitrate - maxDrop);

    config.currentQuality = newQuality;
    config.targetBitrate = targetBitrate;
    config.currentBitrate = targetBitrate;
    config.lastAdjustment = Date.now();

    logger.info(`Quality adjusted for stream ${streamId}`, {
      newQuality,
      targetBitrate,
      networkScore: this.calculateNetworkScore(config)
    });

    // Emit quality change event to client
    this.emitQualityChange(streamId, {
      quality: newQuality,
      bitrate: targetBitrate,
      video: newConfig.video
    });
  }

  // Update network metrics
  updateNetworkMetrics(streamId, metrics) {
    const config = this.streams.get(streamId);
    if (!config) return;

    Object.assign(config, metrics);
    
    // Log significant changes
    if (Math.abs(metrics.packetLoss - config.packetLoss) > 0.01 ||
        Math.abs(metrics.rtt - config.rtt) > 50) {
      logger.debug(`Network metrics updated for stream ${streamId}`, metrics);
    }
  }

  // Predictive quality adjustment based on trends
  predictQualityAdjustment(streamId, historicalData) {
    const config = this.streams.get(streamId);
    if (!config || historicalData.length < 3) return;

    // Simple trend analysis
    const recentTrends = historicalData.slice(-5);
    const packetLossTrend = this.calculateTrend(recentTrends.map(d => d.packetLoss));
    const rttTrend = this.calculateTrend(recentTrends.map(d => d.rtt));

    // Predictive adjustment
    if (packetLossTrend > 0.01 || rttTrend > 20) {
      this.adjustQuality(streamId, this.getLowerQuality(config.currentQuality));
    } else if (packetLossTrend < -0.005 && rttTrend < -10) {
      this.adjustQuality(streamId, this.getHigherQuality(config.currentQuality));
    }
  }

  // Calculate trend from data points
  calculateTrend(data) {
    if (data.length < 2) return 0;
    const recent = data.slice(-3);
    const slope = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
    return slope;
  }

  // Get next lower quality tier
  getLowerQuality(current) {
    const tiers = ['ultraLow', 'low', 'medium', 'high'];
    const index = tiers.indexOf(current);
    return index > 0 ? tiers[index - 1] : current;
  }

  // Get next higher quality tier
  getHigherQuality(current) {
    const tiers = ['ultraLow', 'low', 'medium', 'high'];
    const index = tiers.indexOf(current);
    return index < tiers.length - 1 ? tiers[index + 1] : current;
  }

  // Emergency quality drop for critical situations
  emergencyQualityDrop(streamId) {
    const config = this.streams.get(streamId);
    if (!config) return;

    logger.warn(`Emergency quality drop for stream ${streamId}`);
    this.adjustQuality(streamId, 'ultraLow');
    config.adaptationEnabled = false; // Pause adaptation for 10 seconds
    
    setTimeout(() => {
      if (this.streams.has(streamId)) {
        this.streams.get(streamId).adaptationEnabled = true;
      }
    }, 10000);
  }

  // Get current stream quality info
  getStreamQuality(streamId) {
    const config = this.streams.get(streamId);
    if (!config) return null;

    return {
      currentQuality: config.currentQuality,
      currentBitrate: config.currentBitrate,
      networkScore: this.calculateNetworkScore(config),
      packetLoss: config.packetLoss,
      rtt: config.rtt,
      bufferLevel: config.bufferLevel
    };
  }

  // Get data usage estimate
  getDataUsageEstimate(streamId, durationMinutes) {
    const config = this.streams.get(streamId);
    if (!config) return 'Unknown';

    const totalBits = config.currentBitrate * durationMinutes * 60;
    return {
      estimatedMB: (totalBits / 8 / 1024 / 1024).toFixed(2),
      quality: config.currentQuality,
      bitrate: config.currentBitrate
    };
  }

  // Stop monitoring a stream
  stopMonitoring(streamId) {
    if (this.connectionMonitors.has(streamId)) {
      clearInterval(this.connectionMonitors.get(streamId));
      this.connectionMonitors.delete(streamId);
    }
    
    if (this.optimizationIntervals.has(streamId)) {
      clearInterval(this.optimizationIntervals.get(streamId));
      this.optimizationIntervals.delete(streamId);
    }

    this.streams.delete(streamId);
    logger.info(`Stopped monitoring stream ${streamId}`);
  }

  // Emit quality change to client
  emitQualityChange(streamId, qualityData) {
    // This would typically emit via Socket.IO
    logger.info(`Emitting quality change for stream ${streamId}`, qualityData);
  }

  // Get optimization statistics
  getOptimizationStats() {
    return {
      activeStreams: this.streams.size,
      monitoredStreams: this.connectionMonitors.size,
      qualityDistribution: this.getQualityDistribution()
    };
  }

  // Get quality distribution across all streams
  getQualityDistribution() {
    const distribution = { ultraLow: 0, low: 0, medium: 0, high: 0 };
    
    for (const [_, config] of this.streams) {
      distribution[config.currentQuality]++;
    }
    
    return distribution;
  }
}

module.exports = AdaptiveBitrateController;
