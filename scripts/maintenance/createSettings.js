const fetch = require('node-fetch');

async function createSettings() {
  const response = await fetch('http://localhost:3000/v1/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backgroundImageUrl: null })
  });
  const data = await response.json();
  console.log(data);
}

createSettings().catch(console.error);