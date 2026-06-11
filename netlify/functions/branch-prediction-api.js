exports.handler = async function (event, context) {
  // CORS Headers for client safety
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: { message: 'Method Not Allowed' } })
    };
  }

  try {
    const { model, max_tokens, temperature, messages } = JSON.parse(event.body);
    const apiKey = process.env.GROQ_API_KEY;
    const baseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions';

    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: { message: 'GROQ_API_KEY environment variable is not configured.' } })
      };
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature,
        messages
      })
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error('Error in branch-prediction-api function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
