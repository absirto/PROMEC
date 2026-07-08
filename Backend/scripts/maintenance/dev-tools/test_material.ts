import axios from 'axios';

async function testCreateMaterial() {
  try {
    const baseUrl = process.env.API_URL || 'http://localhost:3001/v1';
    const email = process.env.ADMIN_DEFAULT_EMAIL || 'admin@promec.com';
    const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';
    // 1. Login to get token
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email,
      password
    });
    const token = loginRes.data.data.token;
    console.log('Token obtained.');

    // 2. Create Material
    const materialRes = await axios.post(`${baseUrl}/materials`, {
      name: 'Teste Material ' + Date.now(),
      description: 'Descrição de teste',
      price: 15.50,
      unit: 'un',
      active: true
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Create Response:', JSON.stringify(materialRes.data, null, 2));

    // 3. List Materials
    const listRes = await axios.get(`${baseUrl}/materials`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('List count:', listRes.data.data.length);
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testCreateMaterial();
