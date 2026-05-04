import axios from 'axios';

async function testCreateMaterial() {
  try {
    // 1. Login to get token
    const loginRes = await axios.post('http://localhost:3001/v1/auth/login', {
      email: 'admin@promec.com',
      password: 'admin'
    });
    const token = loginRes.data.data.token;
    console.log('Token obtained.');

    // 2. Create Material
    const materialRes = await axios.post('http://localhost:3001/v1/materials', {
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
    const listRes = await axios.get('http://localhost:3001/v1/materials', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('List count:', listRes.data.data.length);
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testCreateMaterial();
