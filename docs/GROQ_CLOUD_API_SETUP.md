# Meridian AI: Groq Cloud API Integration

## Overview

**Meridian AI** now uses **Groq Cloud API** for lightning-fast financial intelligence. This eliminates the need for local model downloads and provides enterprise-grade performance.

## Why Groq?

| Feature | Benefit |
|---------|---------|
| **Speed** | Groq's LPU (Language Processing Unit) is the fastest inference engine on the market |
| **Scalability** | No local memory constraints; scales with your SACCO's needs |
| **Models** | Access to DeepSeek-R1, Llama 3.3 70B, and other state-of-the-art models |
| **Cost** | Free tier available; pay-as-you-go pricing for production use |
| **Reliability** | 99.9% uptime SLA for enterprise deployments |

## Setup Instructions

### Step 1: Get Your Groq API Key

1. Visit [https://console.groq.com](https://console.groq.com)
2. Sign up or log in with your account
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (keep it secret!)

### Step 2: Configure Your Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then edit `.env` and add your Groq API key:

```
GROQ_API_KEY=gsk_your_actual_api_key_here
```

### Step 3: Start the API Server

```bash
cd /home/ubuntu/kenyan-sacco-ide
npx tsx server_standalone.js
```

You should see:
```
🚀 Meridian AI API Server running on port 3001
📊 Using Groq Cloud API with DeepSeek-R1-Distill-Llama-70B
⚡ Lightning-fast financial intelligence for Kenyan SACCOs
```

### Step 4: Test the Integration

```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Meridian AI, are you working?"}'
```

You should receive a response within milliseconds!

## Available Models

The backend is pre-configured to use **DeepSeek-R1-Distill-Llama-70B**, but you can switch to other models:

| Model | Best For | Speed |
|-------|----------|-------|
| **deepseek-r1-distill-llama-70b** | Financial reasoning, complex analysis | ⚡⚡⚡ |
| **llama-3.3-70b-versatile** | General-purpose, coding | ⚡⚡⚡ |
| **llama-3.1-8b-instant** | Fast responses, lower cost | ⚡⚡⚡⚡ |
| **mixtral-8x7b-32768** | Large context, long documents | ⚡⚡ |

To change the model, edit `server_standalone.js` and update the `model` parameter in the Groq API calls.

## API Endpoints

### 1. Upload Files
```
POST /api/upload
Content-Type: multipart/form-data

files: [member_list.csv, mpesa_statements.csv]
```

### 2. Chat with AI
```
POST /api/ai/chat
Content-Type: application/json

{"message": "Analyze the phantom savings in this audit"}
```

### 3. Run Forensic Audit
```
POST /api/audit
Content-Type: application/json
```

### 4. Generate Boardroom Report
```
POST /api/generate-report
Content-Type: application/json
```

### 5. Health Check
```
GET /api/health
```

## Groq Free Tier Limits

| Metric | Limit |
|--------|-------|
| Requests per Minute (RPM) | 30 |
| Requests per Day (RPD) | 14,400 |
| Tokens per Minute (TPM) | 6,000 |
| Tokens per Day (TPD) | 500,000 |

For production use, contact Groq for higher limits.

## Troubleshooting

### "Invalid API Key" Error
- Verify your API key is correct in `.env`
- Ensure the key hasn't expired
- Check that you're using the full key (including the `gsk_` prefix)

### "Rate Limit Exceeded" Error
- You've hit the free tier limits
- Wait for the rate limit to reset
- Consider upgrading to a paid tier for higher limits

### "Model Not Found" Error
- Ensure the model name is spelled correctly
- Check Groq's supported models list

## Production Deployment

For production use:

1. **Use Environment Variables:** Store your API key in your deployment platform's secret manager
2. **Monitor Usage:** Track your token usage via Groq's dashboard
3. **Implement Caching:** Cache frequently asked questions to reduce API calls
4. **Set Rate Limits:** Implement rate limiting on your API endpoints
5. **Error Handling:** Implement graceful fallbacks for API failures

## Security Best Practices

- **Never commit your API key** to version control
- **Rotate keys regularly** in production
- **Use environment variables** for sensitive data
- **Monitor API usage** for unusual patterns
- **Implement request validation** to prevent injection attacks

## Support

For issues or questions:
- Groq Support: [https://support.groq.com](https://support.groq.com)
- Meridian AI Issues: Create an issue in the GitHub repository

## Next Steps

1. Get your Groq API key
2. Configure the `.env` file
3. Start the server
4. Test with the sample data
5. Deploy to production

**Meridian AI is now ready to revolutionize financial intelligence for Kenyan SACCOs!** 🚀
