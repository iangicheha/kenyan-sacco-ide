import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  console.log('Received message:', message);
  
  try {
    console.log('Fetching from Ollama...');
    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:7b',
        prompt: `Test prompt: ${message}`,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data: any = await response.json();
    console.log('Ollama response received');
    res.status(200).json({ response: data.response });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.listen(3005, () => {
  console.log('Test server listening on port 3005');
});
