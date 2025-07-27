/**
 * Discord Webhook Test Script
 * Quick test to verify Discord webhook integration
 */

const axios = require('axios');
const DiscordWebhookService = require('./src/utils/discordWebhook');

// Test Discord webhook with your actual webhook URL
const webhookUrl = 'https://discord.com/api/webhooks/your-webhook-id/your-webhook-token';

async function testDiscordWebhook() {
  console.log('🧪 Testing Discord Webhook Integration...\n');

  // Test 1: Direct webhook call
  console.log('📤 Test 1: Direct webhook call');
  try {
    const payload = {
      username: 'HarmonieCDN Bot',
      content: '🎉 CDN Discord Integration Test',
      embeds: [{
        title: '✅ Webhook Test Successful',
        description: 'Your Discord webhook is working perfectly!',
        color: 5763719,
        fields: [
          {
            name: 'Service',
            value: 'HarmonieCore CDN',
            inline: true
          },
          {
            name: 'Status',
            value: '✅ Active',
            inline: true
          },
          {
            name: 'Timestamp',
            value: new Date().toLocaleString(),
            inline: false
          }
        ],
        footer: {
          text: 'HarmonieCore CDN',
          icon_url: 'https://harmoniecore.com/logo.png'
        }
      }]
    };

    const response = await axios.post(webhookUrl, payload);
    console.log('✅ Direct webhook test: SUCCESS');
    console.log(`   Response status: ${response.status}\n`);
  } catch (error) {
    console.log('❌ Direct webhook test: FAILED');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 2: Using DiscordWebhookService
  console.log('🤖 Test 2: DiscordWebhookService integration');
  try {
    process.env.ALERT_WEBHOOK_URL = webhookUrl;
    const discord = new DiscordWebhookService();
    
    await discord.sendAlert('success', 'CDN Service Test', 'Discord integration is working perfectly!');
    console.log('✅ DiscordWebhookService test: SUCCESS\n');
  } catch (error) {
    console.log('❌ DiscordWebhookService test: FAILED');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 3: Health alert simulation
  console.log('🏥 Test 3: Health alert simulation');
  try {
    const discord = new DiscordWebhookService();
    await discord.sendHealthAlert('us-east-1', 'healthy', { responseTime: 45 });
    console.log('✅ Health alert test: SUCCESS\n');
  } catch (error) {
    console.log('❌ Health alert test: FAILED');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 4: Performance metrics
  console.log('📊 Test 4: Performance metrics');
  try {
    const discord = new DiscordWebhookService();
    const mockMetrics = {
      cacheHitRate: 87,
      totalRequests: 15420,
      mobileDataSaved: 1024000,
      bandwidthSaved: 5120000,
      edgeNodes: [
        { region: 'us-east-1', status: 'active' },
        { region: 'us-west-2', status: 'active' },
        { region: 'eu-west-1', status: 'active' }
      ]
    };
    
    await discord.sendMetricsAlert(mockMetrics);
    console.log('✅ Performance metrics test: SUCCESS\n');
  } catch (error) {
    console.log('❌ Performance metrics test: FAILED');
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('🎯 All Discord webhook tests completed!');
  console.log('Check your Discord channel for the test messages.');
}

// Run the test
if (require.main === module) {
  testDiscordWebhook().catch(console.error);
}

module.exports = { testDiscordWebhook };
